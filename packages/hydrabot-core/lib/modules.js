// HydraBot <https://github.com/msikma/hydrabot>
// © MIT license

import path from 'node:path'
import fg from 'fast-glob'
import compact from 'lodash.compact'
import crc32 from 'crc32'
import {makeSubLogger} from '../util/log.js'

/**
 * Calculates the hash of all commands.
 * 
 * Used to check whether a guild's commands need to be updated.
 */
export function calcCommandHash(commands) {
  return String(crc32(JSON.stringify(commands)))
}

/**
 * Loads all command files.
 */
export async function loadCommandFiles(pathPackage) {
  const commands = await loadModuleFiles(pathPackage, 'commands', 'cmd', 'red')
  return compact(commands)
}

/**
 * Loads all message handler files.
 */
export async function loadMessageHandlers(pathPackage) {
  const handlers = await loadModuleFiles(pathPackage, 'handlers', 'msg', 'blue')
  return compact(handlers)
}

/**
 * Loads all periodical task files.
 */
export async function loadTaskFiles(pathPackage) {
  const tasks = await loadModuleFiles(pathPackage, 'tasks', 'task', 'green')
  return compact(tasks).map(task => ({...task, _isQueued: false}))
}

/**
 * Loads and imports module files.
 * 
 * This is used to import both commands and message handlers.
 */
async function loadModuleFiles(pathPackage, moduleType, modulePrefix, logColor) {
  const base = path.resolve(path.join(pathPackage, 'packages', 'hydrabot-core', moduleType))
  const files = await fg(['**/index.js'], {deep: 2, cwd: base, onlyFiles: true, absolute: true})
  return Promise.all(files.map(async file => {
    const module = (await import(file)).default
    if (!module.manifest || !module.manifest.name) {
      return null
    }
    const logger = makeSubLogger(modulePrefix, module.manifest.name, logColor)
    return {...module, logger, _filepath: path.relative(base, file)}
  }))
}
