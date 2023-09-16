// HydraBot <https://github.com/msikma/hydrabot>
// © MIT license

import compact from 'lodash.compact'
import fetch from 'node-fetch'
import {getBufferRepInfo} from 'bwrepinfo'
import {BwMapImage} from 'bwmapimage'
import {EmbedBuilder, MessageFlags, AttachmentBuilder} from 'discord.js'
import {makeEmojiDecorator} from '../../lib/remote.js'
import {wrapCodeBlock, formatFilesize, formatGameDuration} from '../../util/format.js'
import {levelsToLinear} from '../../util/image.js'

const BATTLE_NET_LOGO = `https://i.imgur.com/C8izhrY.png`
const BATTLE_NET_COLOR = 0x0074e0
const BW_MAP_IMAGE_OPTIONS = {
  encoderType: 'webp',
  encoderOptions: {
    quality: 80
  },
  tileSize: 8,
  targetWidth: 1024,
  preHook: image => image.linear(...levelsToLinear(0, 150))
}

/**
 * Returns a buffer for a map image.
 */
async function fetchMapImage(repBuffer, rep, logger) {
  // Attempt to generate the image.
  try {
    const mapImage = new BwMapImage(Buffer.from(repBuffer), BW_MAP_IMAGE_OPTIONS)
    // const mapMetadata = await mapImage.getMapMetadata()
    // TODO: check if we've generated this before.
    const [buffer, metadata] = await mapImage.renderMapImage()
    const filename = `${metadata.mapHash}${metadata.extension}`
    const attachment = new AttachmentBuilder(buffer, {name: filename})
    return {
      attachment,
      buffer,
      filename,
      metadata
    }
  }
  catch (err) {
    console.log(err)
    logger.logWarn`Could not create map image for url: ${rep.url}`
  }
}

/**
 * Fetches an attached replay file from Discord's CDN.
 */
async function fetchReplay(rep) {
  const res = await fetch(rep.url)
  return res.arrayBuffer()
}

/**
 * Parses the given replay and returns information about it.
 */
async function getReplayInfo(attachment, repBuffer) {
  try {
    const data = await getBufferRepInfo(repBuffer)
    return {
      success: true,
      attachment,
      data
    }
  }
  catch (err) {
    return {
      success: false,
      attachment,
      data: {},
      error: {
        errorObject: err,
        errorType: String(err).includes('Unsupported replay version') ? 'UNSUPPORTED_OLD' : 'UNKNOWN'
      }
    }
  }
}

/**
 * Creates a Discord Embed object from parsed replay data.
 */
function makeReplayEmbed(replayData, attachment, replayImage, formatEmoji) {
  const e = new EmbedBuilder()
  e.setColor(BATTLE_NET_COLOR)
  e.setAuthor({name: 'Replay file information', iconURL: BATTLE_NET_LOGO})
  e.setURL(attachment.url)
  e.setTimestamp()
  
  e.setTitle(formatEmoji(replayData.title))
  // e.setThumbnail('https://i.imgur.com/AfFp7pu.png') // add the map image here
  e.addFields(
    {name: `Players`, value: `${replayData.players.list.map(player => formatEmoji(player.nameFormatted)).map(str => `• ${str}`).join('\n')}`, inline: false},
    {name: `Map`, value: `🗺️ ${replayData.map.originalName}`, inline: true},
    {name: `Length`, value: `${replayData.time.duration}`, inline: true},
    {name: `Played`, value: `${replayData.time.startTimeEmoji} ${replayData.time.startTime}, ${replayData.time.startTimeRel}`, inline: false},
    // {name: '\u200b', value: '\u200b', inline: true},
    {name: `Download`, value: `📁 [${attachment.name} (${replayData.file.size})](${attachment.url})`, inline: false},
    {name: `Chat messages (click to reveal)`, value: `${replayData.messages === '' ? `*No messages.*` : replayData.messages}`, inline: false}
  )

  if (replayImage) {
    e.setThumbnail(`attachment://${replayImage.filename}`)
  }

  return e
}

/**
 * Creates a Discord embed indicating the total duration of all replays posted.
 */
function makeSummaryEmbed(embedNumber, duration, formatEmoji) {
  const e = new EmbedBuilder()
  e.setColor(BATTLE_NET_COLOR)
  e.setDescription(`**Summary:** ${embedNumber} replay${embedNumber === 1 ? '' : 's'} for a total length of ${formatGameDuration(duration)}.`)
  return e
}

/**
 * Returns a Markdown error message in case we could not parse the replay file.
 */
function makeErrorMessage(replayError, attachment) {
  const {errorType, errorObject} = replayError
  const base = `Could not parse the replay file \`${attachment.name}\` (${formatFilesize(attachment.size)}):`

  if (errorType === 'UNSUPPORTED_OLD') {
    return `${base} only *StarCraft: Remastered* replay files are supported.`
  }

  return `${base} unknown what went wrong. Here's the error:\n${wrapCodeBlock(String(errorObject))}`
}

/**
 * Returns the duration of the replay in milliseconds.
 */
function getReplayDuration(replayData) {
  return replayData._baseInfo.game.durationMs
}

/**
 * Returns all valid replay file attachments.
 */
function getReplayAttachments(attachments) {
  if (!attachments || !attachments.size) {
    return []
  }
  
  // List of attachments that are replay files.
  const repMap = attachments.filter(attachment => attachment.name.endsWith('.rep') && attachment.contentType === 'application/vnd.businessobjects')
  const repList = Array.from(repMap.values())
  if (!repList.length) {
    return []
  }

  return repList
}

export default {
  manifest: {
    name: 'replay',
    description: 'Displays information about replay file attachments in messages.'
  },
  async applies(message) {
    const repList = getReplayAttachments(message.attachments)
    return repList.length
  },
  async handle(message, {client, logger}) {
    // Retrieve the list of attachments that are valid replay files.
    const repList = getReplayAttachments(message.attachments)

    // Retrieve the emojis for the message's guild, so we can replace emoji with their IDs.
    const formatRaceEmoji = await makeEmojiDecorator(message.guild, ['terran', 'protoss', 'zerg', 'question'], {client})

    // We have a list of replay files. Download all of the files and parse their information.
    const messages = []
    const embeds = []
    const files = []
    let totalDuration = 0
    for (const rep of repList) {
      // Fetch the replay into a buffer.
      const repBuffer = await fetchReplay(rep)
      const repImage = await fetchMapImage(repBuffer, rep, logger)
      const repData = await getReplayInfo(rep, repBuffer)
      if (repImage) {
        files.push(repImage.attachment)
      }
      if (repData.success) {
        totalDuration += getReplayDuration(repData.data)
        embeds.push(makeReplayEmbed(repData.data, rep, repImage, formatRaceEmoji))
      } else {
        messages.push(makeErrorMessage(repData.error, rep))
      }
    }

    // If more than one replay was posted, send a summary.
    if (embeds.length > 1) {
      embeds.push(makeSummaryEmbed(embeds.length, totalDuration, formatRaceEmoji))
    }

    // Send all messages as reply to the user. The user will not be pinged.
    message.reply(...compact([messages ? messages.join('\n') : null, {embeds, files, allowedMentions: {repliedUser: false}}]))

    logger.log`Parsed ${repList.length} replay file${repList.length === 1 ? '' : 's'}`
  }
}
