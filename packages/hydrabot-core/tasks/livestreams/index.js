// HydraBot <https://github.com/msikma/hydrabot>
// © MIT license

import orderBy from 'lodash.orderby'
import {EmbedBuilder, MessageFlags} from 'discord.js'
import {getCurrentStreamingStatus} from '../../lib/services/twitch.js'
import {getBotRemoteSettings, getUserRoleMetadata} from '../../lib/remote.js'
import {staticMessage} from '../../lib/message.js'
import {makeEmojiDecorator} from '../../lib/remote.js'
import {formatDynamicTimestamp, formatUserReference} from '../../util/format.js'
import {readGuildCache, writeGuildCache} from '../../util/config.js'

const LIVESTREAMS_LOGO = `https://i.imgur.com/kukgWMD.png`
const LIVESTREAMS_COLOR = 0x6441a5

/**
 * Returns a link to a user's Twitch stream.
 */
function makeUserTwitchLink(userData, isLive, {formatUserEmoji}) {
  if (isLive) {
    return `[${userData.status.title}](${userData.twitchUrl})`
  }
  else {
    return `[twitch.tv/${userData.twitchUsername}](${userData.twitchUrl})`
  }
}

/**
 * Returns a string of metadata to add to a user in the list.
 */
function makeUserMetadata(user, isLiveList, isStarCraftList) {
  const items = []
  if (user.isLive) {
    if (!isStarCraftList) {
      items.push(`playing ${user.status.gameName} `)
    }
    items.push(`live to ${user.status.viewers} viewer${user.status.viewers === 1 ? '' : 's'}, since ${formatDynamicTimestamp(user.status.startDate, 'R')}`)
    return `\n ${items.join('')}`
  }
  else {
    if (user.lastLive != null) {
      items.push(`- last live ${formatDynamicTimestamp(user.lastLive, 'R')}`)
    }
    return items.length ? ` ${items.join('')}` : ''
  }
}

/**
 * Returns a list of users.
 */
function makeUserListMarkdown(userData, isLiveList, isStarCraftList, fallback, {formatUserEmoji}) {
  if (!userData || userData.length === 0) {
    return fallback
  }
  const items = []
  for (const user of userData) {
    const userObject = user.user
    const rank = user.meta?.rank ?? 'u'
    const race = user.meta?.race ?? 'question'
    const rankEmoji = `:rank${rank}:`
    const raceEmoji = `:${race}:`
    const userName = `${userObject ? formatUserReference(userObject) : user.username}`
    const userTwitchLink = `${makeUserTwitchLink(user, user.isLive, {formatUserEmoji})}`
    const streamMetadata = makeUserMetadata(user, isLiveList, isStarCraftList)
    items.push(formatUserEmoji(`* ${rankEmoji} ${raceEmoji}${userName} - ${userTwitchLink}${streamMetadata}`))
  }
  return items.join('\n')
}

/**
 * Creates a Discord Embed object displaying a list of livestreams.
 */
function makeLivestreamsEmbed(userData, userLastLiveData, {taskConfig, formatUserEmoji}) {
  const e = new EmbedBuilder()
  e.setColor(LIVESTREAMS_COLOR)
  e.setAuthor({name: 'Twitch streams', iconURL: LIVESTREAMS_LOGO})
  e.setTimestamp()

  // Add the date the user was last live at from our cache.
  const userLiveData = userData.map(user => ({
    ...user,
    lastLive: userLastLiveData[user.twitchUsername]
      ? new Date(userLastLiveData[user.twitchUsername])
      : null
  }))

  // Filter the users by online/offline, and the online users into whether they're playing StarCraft or not.
  const online = userLiveData.filter(user => user.isLive)
  const onlineBW = online.filter(user => user.status.gameName === 'StarCraft')
  const onlineOther = online.filter(user => user.status.gameName !== 'StarCraft')
  const offline = userLiveData.filter(user => !user.isLive)

  // Fallback value if the list is empty.
  const listEmpty = formatUserEmoji(`None. :harold:`)

  const listSegments = []
  listSegments.push(`Last updated ${formatDynamicTimestamp(new Date(), 't')}.`)
  listSegments.push(`### Currently live`)
  listSegments.push(`${makeUserListMarkdown(onlineBW, true, true, listEmpty, {taskConfig, formatUserEmoji})}`)
  if (onlineOther.length) {
    listSegments.push(`### Playing something else`)
    listSegments.push(`${makeUserListMarkdown(onlineOther, true, false, listEmpty, {taskConfig, formatUserEmoji})}`)
  }
  listSegments.push(`### Offline`)
  listSegments.push(`${makeUserListMarkdown(offline, true, true, listEmpty, {taskConfig, formatUserEmoji})}`)

  e.setDescription(listSegments.join('\n'))

  return e
}

/**
 * Combines all user data into one object.
 * 
 * This includes the user's Discord data as well as their Twitch stream data.
 */
function combineUserData(settings, status, metadata) {
  const users = []
  for (const item of settings.livestreams.users) {
    const userMeta = metadata[item.username]?.meta
    const userObject = metadata[item.username]?.user
    const userStatus = status[item.username].stream
    users.push({...item, meta: userMeta, user: userObject, status: userStatus, isLive: !!userStatus})
  }
  return orderBy(users, ['isLive', 'meta.rankOrder', 'meta.raceOrder', 'username'], ['desc', 'asc', 'asc', 'asc'])
}

/**
 * Updates the guild cache with the dates of users that are currently live.
 */
async function updateLiveCache(userData, userLastLiveData, guildId, pathCache) {
  const now = new Date().toISOString()

  // Users that are currently live on Twitch and the current timestamp.
  const usersCurrentlyLive = Object.fromEntries(userData
    .filter(user => user.isLive)
    .map(user => [user.twitchUsername, now]))
  
  // Updated list of when users were last live.
  const lastLive = {...userLastLiveData, ...usersCurrentlyLive}

  return writeGuildCache(pathCache, guildId, {livestreamsLastLive: lastLive})
}

async function publishLivestreams(guildData, {n, logger, client, state, task, dataConfig, twitchApiClient, twitchApiData}) {
  const guildId = guildData.id
  const guildCache = await readGuildCache(state.pathCache, guildId)
  const settingsChannelId = guildData.channelIds.settings
  const guildLastLiveData = guildCache.livestreamsLastLive || {}

  const formatUserEmoji = await makeEmojiDecorator(guildId, guildData.emojiMapping, {client})
  const settings = await getBotRemoteSettings(guildId, settingsChannelId, {client})
  const metadata = await getUserRoleMetadata(guildId, settings.livestreams.users.map(item => item.username), {client})
  const status = await getCurrentStreamingStatus(settings.livestreams.users, {twitchApiClient})
  const message = await staticMessage({guildId, channelId: settings.livestreams.channelId}, {client, logger})

  const userData = combineUserData(settings, status, metadata)
  await updateLiveCache(userData, guildLastLiveData, guildId, state.pathCache)
  await message.update({content: settings.livestreams.description, embeds: [makeLivestreamsEmbed(userData, guildLastLiveData, {taskConfig: settings.livestreams, formatUserEmoji})]})
  if (n === 0) logger.log`Initial update of the livestreams list`
}

export default {
  manifest: {
    name: 'livestreams',
    description: `Displays who's currently live on Twitch.`,
    interval: Math.floor(60000 * 1.75),
    runOnStartup: true
  },
  async run(args) {
    for (const guild of args.dataConfig.discord.guilds) {
      await publishLivestreams(guild, args)
    }
  }
}
