// HydraBot <https://github.com/msikma/hydrabot>
// © MIT license

import cloneDeep from 'lodash.clonedeep'
import merge from 'lodash.merge'
import compact from 'lodash.compact'
import ini from 'ini'

/** Default bot settings. */
const DEFAULT_SETTINGS = {
  livestreams: {
    users: [],
    description: ''
  }
}

/**
 * Parses ini content.
 * 
 * This passes the result through the JSON encoder to clean it up.
 * The defaults are also merged in.
 */
function parseIniContent(content) {
  const parsed = ini.parse(content)
  return merge(cloneDeep(DEFAULT_SETTINGS), JSON.parse(JSON.stringify(parsed)))
}

/**
 * This function extracts data from "settings" message content.
 * 
 * The "settings" message is a special message in Discord containing bot settings.
 * Basically, it allows for the bot to receive some configuration from Discord.
 * This is used to e.g. list which streams are displayed in the "now live" list.
 */
export function extractSettingsFromMessage(content) {
  const data = parseIniContent(content)

  data.livestreams.users = compact(data.livestreams.users.map(line => {
    const matches = line.match(/^(.+?)\<(.+?)\>$/)
    if (!matches) return null
    const twitchUsername = matches[2].match(/twitch\.tv\/(.+?)$/)
    if (!twitchUsername) return null
    return {
      username: matches[1].trim(),
      twitchUrl: matches[2].trim(),
      twitchUsername: twitchUsername[1].trim()
    }
  }))

  return data
}
