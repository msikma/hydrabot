// HydraBot <https://github.com/msikma/hydrabot>
// © MIT license

import prettyBytes from 'pretty-bytes'
import formatDuration from 'format-duration'

/**
 * Wraps a string in a code block tag.
 */
export function wrapCodeBlock(str, type = '') {
  return `\`\`\`${type}\n${str}\n\`\`\``
}

/**
 * Extracts the content of a code block.
 */
export function unwrapCodeBlock(mdRaw) {
  const md = mdRaw.trim()
  if (!md.startsWith('```')) {
    return mdRaw
  }
  // Account for the code block type; e.g. "```js".
  const typeMatch = md.match(/^```(.*)\n(.+?)/m)
  if (!typeMatch) {
    return mdRaw
  }
  // Slice off the start and the end.
  const prefix = typeMatch[1].length + 3
  const mdNoPrefix = md.slice(prefix)
  const suffix = mdNoPrefix.indexOf('```')
  const mdNoSuffix = mdNoPrefix.slice(0, suffix)
  
  return mdNoSuffix
}

/**
 * Formats a filesize from bytes into a human readable string.
 */
export function formatFilesize(bytes) {
  return prettyBytes(bytes, {})
}

/**
 * Returns a formatted emoji embed.
 */
export function formatEmoji(emoji) {
  return `<:${emoji.name}:${emoji.id}>`
}

/**
 * Formats the duration of a game.
 */
export function formatGameDuration(durationMs) {
  return formatDuration(durationMs, {leading: false})
}

/**
 * Formats a reference to a Discord user.
 */
export function formatUserReference(user, userId) {
  return `<@${user ? user.id : userId}>`
}

/**
 * Returns a dynamic timestamp string.
 */
export function formatDynamicTimestamp(date, type) {
  return `<t:${Math.floor(Number(date) / 1000)}:${type}>`
}
