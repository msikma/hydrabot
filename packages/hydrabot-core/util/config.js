// HydraBot <https://github.com/msikma/hydrabot>
// © MIT license

import fs from 'fs/promises'
import path from 'path'

/**
 * Returns the content of the config file.
 */
export async function readConfig(configDir) {
  await ensureDir(configDir)
  const content = await fs.readFile(path.join(configDir, 'config.json'), 'utf8')
  return JSON.parse(content)
}

/**
 * Returns the cache for a particular guild.
 * 
 * If the cache file is not found, a new empty file is created and {} is returned.
 */
export async function readGuildCache(cacheDir, guildId) {
  await ensureDir(cacheDir)
  const filepath = path.join(cacheDir, `guild_${guildId}.json`)
  try {
    const content = await fs.readFile(filepath, 'utf8')
    return JSON.parse(content)
  }
  catch (err) {
    if (err.code === 'ENOENT') {
      await fs.writeFile(filepath, '{}', 'utf8')
      return {}
    }
    throw err
  }
}

/**
 * Writes new cache for a particular guild.
 */
export async function writeGuildCache(cacheDir, guildId, newData) {
  await ensureDir(cacheDir)
  const filepath = path.join(cacheDir, `guild_${guildId}.json`)
  const oldData = await readGuildCache(cacheDir, guildId)
  return fs.writeFile(filepath, JSON.stringify({...oldData, ...newData}, null, 2), 'utf8')
}

/**
 * Ensures that a directory exists.
 */
export async function ensureDir(dir) {
  await fs.mkdir(dir, {recursive: true})
  return dir
}
