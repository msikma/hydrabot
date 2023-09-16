// HydraBot <https://github.com/msikma/hydrabot>
// © MIT license

import orderBy from 'lodash.orderby'
import {getErrorMessage} from '../util/error.js'

/**
 * Returns whether a message belongs to our bot.
 */
export function isOurMessage(clientUser, message) {
  return clientUser.id === message.author.id
}

/**
 * Returns whether a given message was sent by a bot.
 */
export function isBotMessage(message) {
  return message.author.bot
}

/**
 * An object representing a specific static message, usually an editable announcement.
 * 
 * This can be instantiated by either a message id, or a guild and channel id (in which
 * case the message is expected to be the latest message made by the bot; and typically,
 * the only message in the channel).
 * 
 * This allows a message to be kept up to date with a given piece of information.
 */
export async function staticMessage({messageId, guildId, channelId}, {client, logger}) {
  const state = {
    channel: null,
    message: null,
    error: null
  }

  /** Fetches the channel that should contain the message. */
  async function fetchChannel() {
    const guild = await client.guilds.fetch(guildId)
    const channel = await guild.channels.fetch(channelId)
    state.channel = channel
  }

  /** Fetches any previously existing message. */
  async function fetchMessage() {
    try {
      if (messageId) {
        const message = await state.channel.messages.fetch(messageId)
        state.message = message
      }
    }
    catch (err) {
      if (err.rawError.message !== 'Unknown Message') {
        throw err
      }
    }
    // If at this point we do not have a message, we must find it in the channel.
    // We'll look for the latest message made by the bot and assume that's it.
    // Typically this would be used for a locked channel that only contains one message.
    if (!state.message) {
      const messages = orderBy([...(await state.channel.messages.fetch({limit: 20, cache: true})).values()], 'createdTimestamp', 'desc')
      if (messages.length) {
        state.message = messages[0]
      }
    }

    // Note: if there's still no message, we will create one at the moment we update.
  }

  /** Saves a new version of the message. If the message does not exist, it will be created. */
  async function update(messageData) {
    if (state.message) {
      state.message = await state.message.edit(messageData)
    }
    else {
      state.message = await state.channel.send(messageData)
    }
  }

  /** Initializes the object and fetches required data. */
  async function init() {
    try {
      await fetchChannel()
      await fetchMessage()
    }
    catch (err) {
      logger.logError`Static message error`
      logger.log`${getErrorMessage(err)}`
      state.error = err
    }
  }

  // Find the previously existing message, if any.
  await init()

  return {
    update
  }
}
