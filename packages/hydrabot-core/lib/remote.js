// HydraBot <https://github.com/msikma/hydrabot>
// © MIT license

import compact from 'lodash.compact'
import orderBy from 'lodash.orderby'
import {extractSettingsFromMessage} from '../util/message.js'
import {splitDiscordUsername} from '../util/discord.js'
import {detectRoleType} from './meta/roles.js'
import {formatEmoji, unwrapCodeBlock} from '../util/format.js'

/**
 * The default emoji mapping; this maps a standard set of emoji to a server's specific names.
 * 
 * For example, this bot might post a message containing :ranks:, meaning the emoji for S rank,
 * which might be called "ranks" or "srank" or "s_rank" on a specific server.
 * 
 * Keys are our internal names for the emoji. The values are an array containing the guild's
 * specific name for that emoji, and optionally an emoji id if it's known in advance.
 */
const DEFAULT_EMOJI_MAPPING = {
  terran: ['terran'],
  protoss: ['protoss'],
  zerg: ['zerg'],
  random: ['random'],
  racepick_random: ['random'],
  racepicker: ['racepicker'],
  ranks: ['ranks'],
  ranka: ['ranka'],
  rankb: ['rankb'],
  rankc: ['rankc'],
  rankd: ['rankd'],
  ranke: ['ranke'],
  rankf: ['rankf'],
  ranku: ['ranku']
}

/**
 * The default role mapping.
 * 
 * This is as the emoji mapping, linking internal names to actual role names on the server.
 * 
 * Not all roles may be present on a given server.
 */
const DEFAULT_ROLE_MAPPING = {
  terran: ['Terran'],
  protoss: ['Protoss'],
  zerg: ['Zerg'],
  racepicker_random: ['Racepick/random'],
  racepicker: ['Racepicker'],
  random: ['Random'],
  ranks: ['S rank'],
  ranka: ['A rank'],
  rankb: ['B rank'],
  rankc: ['C rank'],
  rankd: ['D rank'],
  ranke: ['E rank'],
  rankf: ['F rank'],
  ranku: ['U rank']
}

/**
 * Fetches the list of emoji for a guild and picks out a number of specific ones.
 * 
 * Used to create an emoji decorator as well.
 */
export async function fetchGuildEmoji(guildId, emojiMapping, {client}) {
  const emojiList = Object.values(emojiMapping).map(e => e[0])
  const guild = await client.guilds.fetch(guildId)
  const cache = guild.emojis.cache
  const recognizedEmoji = cache.filter(emoji => emojiList.includes(emoji.name))
  const otherEmoji = cache.filter(emoji => !emojiList.includes(emoji.name))
  return [Array.from(recognizedEmoji.values()), Array.from(otherEmoji.values())]
}

/**
 * Creates a lookup table for a guild's specific emojis.
 */
function makeEmojiLookup(emojiMapping) {
  const emojiItems = Object.entries(emojiMapping)
  const emojiLookup = {}
  for (let n = 0; n < emojiItems.length; ++n) {
    const item = emojiItems[n]
    if (!emojiLookup[item[1]]) {
      emojiLookup[item[1]] = []
    }
    emojiLookup[item[1]].push(item[0])
  }
  return emojiLookup
}

/**
 * Returns a function that converts a number of recognized emoji into actual emoji embeds.
 * 
 * This can be used to e.g. convert :terran: into <:terran:1234567891234>.
 */
export async function makeEmojiDecorator(guildId, guildMapping = {}, {client}) {
  const emojiMapping = {...DEFAULT_EMOJI_MAPPING, ...guildMapping}
  const emojiLookup = makeEmojiLookup(emojiMapping)
  const [knownEmojiList, otherEmojiList] = await fetchGuildEmoji(guildId, emojiMapping, {client})

  return input => {
    let output = input
    // First replace all known emoji; they have precedence.
    for (const emoji of knownEmojiList) {
      const internalNames = emojiLookup[emoji.name]
      for (const internalName of internalNames) {
        if (output.includes(internalName)) {
          output = output.replace(new RegExp(`:${internalName}:`, 'g'), `${formatEmoji(emoji)}`)
        }
      }
    }
    // After that, replace whatever other emoji the guild has.
    for (const emoji of otherEmojiList) {
      output = output.replace(new RegExp(`:${emoji.name}:`, 'g'), `${formatEmoji(emoji)}`)
    }
    return output
  }
}

/**
 * Reads and extracts information from the settings channel.
 */
export async function getBotRemoteSettings(guildId, channelId, {client}) {
  const channel = await client.channels.fetch(channelId)
  const objects = await channel.messages.fetch({limit: 20, cache: true})

  // Merge all message objects into a string.
  const messages = orderBy([...objects.values()], 'createdTimestamp', 'asc')
  const content = messages.map(message => `${unwrapCodeBlock(message.content)}`)
    .map(line => line.trim())
    .filter(n => n)
    .join('\n')

  // Extract settings from the message content.
  const settings = extractSettingsFromMessage(content)

  return settings
}

/**
 * Retrieves role metadata for a number of users.
 * 
 * The metadata we return is currently limited to their StarCraft race and rank.
 * 
 * TODO: fetch in batch.
 */
export async function getUserRoleMetadata(guildId, users = [], {client}) {
  const guild = client.guilds.cache.get(guildId)
  const metadata = await Promise.all(users.map(async user => {
    const [username, discriminator] = splitDiscordUsername(user)
    let res = await guild.members.fetch({query: username, limit: 1})
    if (discriminator !== null) {
      // If this is an old username with discriminator, filter the list of results to get the right one.
      res = res.filter(guildMember => guildMember.user.discriminator === discriminator)
    }
    const memberData = [...res.values()][0]
    if (!memberData) {
      // This happens if the user is not found.
      return null
    }
    const memberRoles = [...memberData.roles.cache.values()]
    const roleMeta = compact(memberRoles.map(role => detectRoleType(role)))
      .reduce((acc, item) => ({...acc, ...item}), {})
    return [user, {meta: roleMeta, user: memberData.user}]
  }))
  return Object.fromEntries(compact(metadata))
}
