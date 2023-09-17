// HydraBot <https://github.com/msikma/hydrabot>
// © MIT license

import {LogLevel} from '@d-fischer/logger'
import orderBy from 'lodash.orderby'
import {ApiClient} from '@twurple/api'
import {RefreshingAuthProvider, exchangeCode} from '@twurple/auth'
import {Client, Events, GatewayIntentBits, REST, Routes} from 'discord.js'
import {findInteractionCommand, getInteractionMeta, getMessageHandlerMeta} from './lib/interaction.js'
import {sendUnknownCommandReply, sendErrorReply} from './lib/sysmsg.js'
import {isOurMessage, isBotMessage} from './lib/message.js'
import {loadCommandFiles, loadMessageHandlers, loadTaskFiles, calcCommandHash} from './lib/modules.js'
import {getProgramLock} from './util/lock.js'
import {log, makeSubLogger} from './util/log.js'
import {sleep} from './util/promise.js'
import {readTwitchToken, storeTwitchToken} from './util/twitch.js'
import {readConfig, readGuildCache, writeGuildCache} from './util/config.js'

/**
 * Discord chat bot for StarCraft.
 * 
 * This is the main entry point for the bot. It connects to all services and initializes everything.
 */
export function HydraBot(args, pkgData, fromCli) {
  const state = {
    client: null,
    clientId: null,
    botToken: null,
    rest: null,
    logger: null,
    loggerCmd: null,

    twitchAuthProvider: null,
    twitchApiClient: null,
    twitchApiData: {},

    pathConfig: null,
    pathCache: null,
    pathPackage: null,

    dataConfig: {},
    dataPackage: {},

    objCommands: [],
    objHandlers: [],
    objTasks: [],

    isFromCli: fromCli,
    isInitialized: false
  }

  /**
   * Initializes the bot and gets it ready to connect.
   */
  async function init() {
    if (state.isInitialized) {
      return
    }
    
    log`{yellow HydraBot v{yellowBright ${pkgData.version}}}`
    log`Press ^C to exit`

    await setProcessHandlers()
    await unpackArguments()
    await loadConfig()
    await loadCommands()
    await loadHandlers()
    await loadTasks()
    await getProgramLock(state.pathCache)
    await createLoggers()
    await initTwitch()

    state.isInitialized = true
  }

  /**
   * Connects the bot to Discord.
   * 
   * It's required to first call init().
   */
  async function connect() {
    if (!state.isInitialized) {
      throw new Error(`Tried to run connect() without being initialized.`)
    }

    // Initialize the REST client.
    await connectRestModule()
    await deployGuildCommands()

    // Initialize the Discord client.
    await connectDiscordClient()

    // Queue the tasks to start running.
    await queueTasks()
  }

  /**
   * Initializes the REST module.
   */
  async function connectRestModule() {
    const rest = new REST().setToken(state.botToken)
    state.rest = rest
  }

  /**
   * Initializes the Twitch API.
   */
  async function initTwitch() {
    const twitchConfig = state.dataConfig.twitch
    const authProvider = await createTwitchAuthProvider(twitchConfig.apiCredentials.authCode, 'api')
    const apiClient = new ApiClient({authProvider, logger: createTwitchLogger('api', 'blue')})

    state.twitchAuthProvider = authProvider
    state.twitchApiClient = apiClient
    state.twitchApiData.user = await apiClient.users.getUserByName(twitchConfig.apiCredentials.userName)

    state.loggerTwitch.log`Logged in as {green ${state.twitchApiData.user.name}}{yellow #${state.twitchApiData.user.id}}`
  }

  /**
   * Creates a refreshing auth provider that syncs with a local file for Twitch.
   */
  async function createTwitchAuthProvider(authCode, name) {
    const appCredentials = state.dataConfig.twitch.appCredentials
    const storedToken = await readTwitchToken(state.pathCache, name)

    // Check to see if we have a token already. If not, create a new one using the auth code.
    // Note that the auth code can only be used to generate a token once.
    // If it's lost, the authorization code grant flow needs to be manually redone.
    if (!storedToken.accessToken) {
      const code = await exchangeCode(appCredentials.clientId, appCredentials.clientSecret, authCode, appCredentials.redirectUri)
      await storeTwitchToken(state.pathCache, name, code)
    }

    const refreshConfig = {
      clientId: appCredentials.clientId,
      clientSecret: appCredentials.clientSecret,
      onRefresh: newToken => storeTwitchToken(state.pathCache, name, newToken)
    }
    const authProvider = new RefreshingAuthProvider(refreshConfig, await readTwitchToken(state.pathCache, name))
    
    return authProvider
  }

  /**
   * Deploys a new copy of the REST module commands.
   * 
   * This refreshes the slash commands on the guild.
   */
  async function deployGuildCommands() {
    const commands = orderBy(state.objCommands, 'manifest.name', 'asc').map(cmd => cmd.manifest)
    const data = commands.map(cmd => cmd.toJSON())
    const hash = calcCommandHash(data)

    // Loop through all guilds in our config file, and check to see if we're up to date.
    // If not, send a copy of our commands to the guild and update the cache for that guild.
    for (const guild of state.dataConfig.discord.guilds) {
      const cache = await readGuildCache(state.pathCache, guild.id)
      if (cache.commandHash === hash) {
        continue
      }
      const res = await state.rest.put(
        Routes.applicationGuildCommands(state.clientId, guild.id),
        {body: data},
      )
      state.logger.log`Deployed {magentaBright ${res.length}} command${res.length === 1 ? '' : 's'} to guild {magentaBright ${guild.id}}, hash {magentaBright 0x${hash}}`
      await writeGuildCache(state.pathCache, guild.id, {commandHash: hash})
    }
  }

  async function connectDiscordClient() {
    return new Promise((resolve, reject) => {
      try {
        const client = new Client({intents: [
          GatewayIntentBits.GuildMembers,
          GatewayIntentBits.GuildMessages,
          GatewayIntentBits.Guilds,
          GatewayIntentBits.MessageContent
        ]})
        client.once(Events.ClientReady, () => {
          handleClientReady()
          resolve()
        })
        client.on(Events.InteractionCreate, handleInteraction)
        client.on(Events.MessageCreate, handleMessage)
        client.login(state.botToken)
    
        state.client = client
      }
      catch (err) {
        return reject(err)
      }
    })
  }

  /**
   * Handles the "ready" event. Only occurs once on connect.
   */
  async function handleClientReady() {
    state.logger.log`Logged in as {green ${state.client.user.username}}{yellow #${state.client.user.discriminator}}`
  }

  /**
   * Handles an incoming interaction.
   */
  async function handleInteraction(interaction) {
    if (!interaction.isChatInputCommand()) return

    try {
      // Match the user's command name with a registered handler.
      const command = findInteractionCommand(interaction, state.objCommands)

      // If there is no command that can handle this interaction, relay a generic error.
      if (!command) {
        return sendUnknownCommandReply(interaction, {logger: state.logger})
      }

      // Else, execute the interaction handler.
      const interactionMeta = getInteractionMeta(interaction, command, state.dataConfig)
      state.loggerCmd.log`Command {redBright ${command.manifest.name}} used by user {yellowBright ${interaction.user.username}} ({yellow ${interaction.user.id}})`
      return command.execute(interaction, {...interactionMeta, client: state.client})
    }
    catch (err) {
      // If something went wrong while executing the command, pass on the error.
      return sendErrorReply(interaction, err, {logger: state.logger})
    }
  }

  /**
   * Handles an incoming message.
   */
  async function handleMessage(message) {
    if (isOurMessage(state.client.user, message)) return
    if (isBotMessage(message)) return

    // Run through all event handlers, and run any that apply.
    for (const handler of state.objHandlers) {
      try {
        const meta = {...getMessageHandlerMeta(message, state.dataConfig), logger: handler.logger}
        const args = {...meta, client: state.client}
        if (!await handler.applies(message, args)) {
          continue
        }
        handler.handle(message, args)
      }
      catch (err) {
        // If something went wrong while running the handler, log the error.
        state.logger.logWarn`Message handler error (id={white ${message.id}}, handler={white ${handler?.manifest?.name ?? 'unknown'}})`
      }
    }
  }

  /**
   * Unloads the bot.
   */
  async function destroy() {
    return
  }

  /**
   * Loads data from the config file.
   */
  async function loadConfig() {
    const config = await readConfig(state.pathConfig)
    const credentials = config.discord.credentials
    state.dataConfig = config
    state.dataPackage = pkgData
    state.clientId = credentials.clientId
    state.botToken = credentials.botToken
  }

  /**
   * Prepares all slash commands.
   */
  async function loadCommands() {
    state.objCommands = await loadCommandFiles(state.pathPackage)
  }

  /**
   * Prepares all message handlers.
   */
  async function loadHandlers() {
    state.objHandlers = await loadMessageHandlers(state.pathPackage)
  }

  /**
   * Prepares all periodical tasks.
   */
  async function loadTasks() {
    state.objTasks = await loadTaskFiles(state.pathPackage)
  }

  /**
   * Queues up all periodical tasks to start running regularly.
   */
  async function queueTasks() {
    for (const task of state.objTasks) {
      // Only queue tasks once.
      if (task._isQueued) {
        continue
      }

      // Wrapper for the task. Provides metadata and client references.
      const runTask = async () => {
        const taskState = {
          n: 0
        }
        const args = {
          task,
          logger: task.logger,
          state,
          client: state.client,
          dataConfig: state.dataConfig,
          twitchApiClient: state.twitchApiClient,
          twitchApiData: state.twitchApiData
        }

        // Runs the task itself and handles crashes.
        const runTaskCycle = async () => {
          try {
            await task.run({...args, n: taskState.n++})
          }
          catch (err) {
            // TODO: handle errors better.
            console.log(err)
            state.logger.logWarn`Error during queued task (name={white ${task.manifest.name}}): ${err}`
          }
        }

        // Run the task once on startup, if needed.
        if (task.manifest.runOnStartup) {
          await runTaskCycle()
        }

        // Loop forever and keep running the task.
        while (true) {
          await sleep(task.manifest.interval)
          await runTaskCycle()
        }
      }

      // Spawn the task to run forever.
      runTask()
    }
  }

  /**
   * Adds invocation arguments to the state object.
   */
  function unpackArguments() {
    for (const key of ['pathConfig', 'pathCache', 'pathPackage']) {
      state[key] = args[key]
    }
  }

  /**
   * Creates all system loggers.
   */
  function createLoggers() {
    state.logger = makeSubLogger('discord', null, 'magenta')
    state.loggerTwitch = makeSubLogger('twitch', null, 'blue')
    state.loggerCmd = makeSubLogger('cmd', null, 'red')
  }

  /**
   * Creates a logger for Twitch services.
   * 
   * A logger created by this function can be passed into Twurple constructors.
   */
  function createTwitchLogger(subsystem, color) {
    const subLogger = makeSubLogger('twitch', subsystem, color)
    return {
      custom: {
        log: (level, message) => {
          if (level === LogLevel.INFO) {
            subLogger.log(message)
          }
          if (level === LogLevel.WARNING) {
            subLogger.logWarn(message)
          }
          if (level <= LogLevel.ERROR) {
            subLogger.logError(message)
          }
        }
      }
    }
  }

  /**
   * Sets handlers for unhandled events.
   */
  function setProcessHandlers() {
    process.on('warning', e => {
      // TODO: better debugging
      console.warn(e.stack)
    })
  }

  return {
    init,
    connect,
    destroy
  }
}
