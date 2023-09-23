// HydraBot <https://github.com/msikma/hydrabot>
// © MIT license

/**
 * Splits a Discord username string into the username and its discriminator.
 * 
 * If no discriminator exists, it is returned as null instead.
 */
export function splitDiscordUsername(username) {
  const split = username.split('#')
  if (split.length === 1) {
    return [username, null]
  }
  return split.slice(0, 2)
}
