// zerglingbot <https://github.com/msikma/zerglingbot>
// © MIT license

import fs from 'fs/promises'
import path from 'path'

/**
 * Returns the content of the token file.
 * 
 * If the token file does not exist, an empty object is returned.
 */
export async function readTwitchToken(cacheDir, tokenName) {
  try {
    const content = JSON.parse(await fs.readFile(path.join(cacheDir, `token${tokenName ? `_${tokenName}` : ''}.json`), 'utf8'))
    return content
  }
  catch (err) {
    if (err.code === 'ENOENT') {
      return {}
    }
    throw err
  }
}

/**
 * Stores the latest token to the token file.
 */
export async function storeTwitchToken(cacheDir, tokenName, tokenData) {
  const token = await readTwitchToken(cacheDir, tokenName)
  return fs.writeFile(path.join(cacheDir, `token${tokenName ? `_${tokenName}` : ''}.json`), JSON.stringify({...token, ...tokenData}, null, 2), 'utf8')
}
