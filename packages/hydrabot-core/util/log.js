// HydraBot <https://github.com/msikma/hydrabot>
// © MIT license

import chalk from 'chalk'
import chalkTemplate from 'chalk-template'
import stripAnsi from 'strip-ansi'
import {getDateForLogger} from './time.js'
import {isString, isPlainObject, isTemplateLiteral} from './types.js'
import {progKill} from './program.js'
import {inspectObject, defaultOptions} from './inspect.js'

/** Global logger state. */
const state = {
  includeDates: false,
  externalLoggers: {}
}

/**
 * Adds a color.
 * 
 * Wrapper for Chalk color functions, to ensure they do not run if logging externally.
 */
const addColor = (colorName, levelName = null) => val => {
  if (isPlainObject(val)) {
    return {...val, colorName, levelName}
  }
  return chalk[colorName](val)
}

/**
 * Adds an external logger.
 * 
 * This is primarily used to pipe log content to a Discord channel.
 * External loggers get an object of log information containing at least a 'message' string value.
 */
export function addExternalLogger(logger, type) {
  state.externalLoggers[type] = logger
}

/**
 * Sets whether dates should be included in log files.
 */
export function setDateInclusion(val) {
  state.includeDates = val
}

/**
 * Adds timestamps to each line of a log string.
 */
const addTimestamps = val => {
  if (isPlainObject(val)) {
    return {...val, hasTimestamp: true}
  }
  const date = getDateForLogger(state.includeDates)
  const prefix = `${chalk.gray.dim('[')}${chalk.gray(date)}${chalk.gray.dim(']')}`
  const lines = val.split('\n').map(l => `${prefix} ${l}`)
  return lines.join('\n')
}

/**
 * Adds a prefix to each line of a log string.
 */
const addPrefix = (name, subName, color, colorBright) => val => {
  if (isPlainObject(val)) {
    return {...val, prefix: {name, subName}}
  }
  const prefix = `${color.dim('[')}${color(name)}${subName ? ` ${colorBright(subName)}` : ''}${color.dim(']')}`
  const lines = val.split('\n').map(l => `${prefix} ${l}`)
  return lines.join('\n')
}

/**
 * Adds a > (greater than) sign to each line of a log string.
 */
const addQuotes = val => {
  if (isPlainObject(val)) {
    return {...val, hasQuotes: true}
  }
  const lines = val.split('\n').map(l => `${chalk.gray('>')} ${l}`)
  return lines.join('\n')
}

/**
 * Adds a > (greater than) sign to a single line.
 */
const addSingleQuote = type => val => {
  if (isPlainObject(val)) {
    return {...val, hasQuotes: true}
  }
  return `${chalk.gray('>')} ${val}`
}

/**
 * Creates strings representing the contents of a given list of segments and passes them on to a logging function.
 * 
 * This function does the bulk of the actual logging work. Essentially this is similar to what console.log() does
 * in Node, but with increased flexibility and the ability to detect and format tagged template literals.
 * 
 * This way, a logging function can be used as either log(...args), or as log`tagged template literal`.
 * 
 * When a tagged template literal is used, colors can be assigned to the output using the chalkTemplate format,
 * such as log`Test: {red this text is red}, and {blue.bold this text is blue and bold}.`
 */
function logSegments(segments, callerOptions = {}) {
  const opts = {...defaultOptions, ...callerOptions}
  const logFn = opts.logFn || (str => str)
  const mapFns = (opts.mapFns || []).filter(fn => fn)

  let formattedString

  // Pass on tagged template literals to chalkTemplate().
  if (isTemplateLiteral(segments)) {
    formattedString = chalkTemplate(...segments)
  }
  // Anything else is handled like console.log() handles it; strings get output directly,
  // and everything else is passed into inspectObject().
  else {
    formattedString = segments.map((obj, n) => {
      // Add spaces between items, except after a linebreak.
      const space = (n !== segments.length - 1 && !String(segments[n]).endsWith('\n') ? ' ' : '')
      return `${isString(obj) ? obj : inspectObject(obj)}${space}`
    }).join('')
  }

  // Pass log content to external loggers first.
  // The only thing we do in terms of processing is resolving template literals.
  for (const [type, logger] of Object.entries(state.externalLoggers)) {
    const msgSegments = isTemplateLiteral(segments) ? [stripAnsi(chalkTemplate(...segments))] : segments
    const logObj = mapFns.reduce((obj, fn) => fn(obj), {message: msgSegments})
    logger.log(logObj, type)
  }

  // Pass the result through any post-processing functions we may have, then pass it to the log function.
  return logFn(mapFns.reduce((str, fn) => fn(str), formattedString))
}

/**
 * Creates a logger function that can be called directly or through one of its methods.
 * 
 * The logger object will be able to log locally (to stdout) and to an external function (such as Discord).
 * 
 * The logger will have the following features:
 * 
 *     <return value>()    calls the logger directly with default options
 *     .local()            logs only locally
 *     .remote()           logs only remotely
 *     .deactivate()       makes all calls no-op
 *     .activate()         reverses .deactivate()
 *     .setRemoteLogger    sets a function to be called for remote logging
 * 
 * A log function can be called as a function or used with tagged template literals:
 * 
 *     log('this is a regular log call which takes strings, objects, or anything else', myObject, 'and more text')
 *     log`this is a tagged template literal call which lets you {blue use shorthand syntax for colors}.`
 * 
 * When a remote logger is set, it will be called for each log call alongside the local function.
 * The typical use for this is to first only log to stdout, until a connection to Discord has been made,
 * at which point all logs get mirrored to the Discord log channel.
 * 
 * Local logging uses colors (terminal escape sequences), which Discord does not support, so the remote logger
 * additionally gets a copy of what the local logger will output, stripped of escape sequences.
 * 
 * Each logger (local and remote) may have its own set of options that gets passed on to logSegments(),
 * which does the actual logging work. Remote logging can be turned off completely for a specific logger
 * (even if .setRemoteLogger() is called) by passing 'isOnlyLocal' in the remote options.
 */
export function makeLogger(localOpts = {}) {
  return (...segments) => logSegments(segments, {...localOpts, mapFns: [...localOpts.mapFns ?? []]})
}

/**
 * Creates a logger for a specific use case.
 * 
 * All lines will be prefixed with a specific identifier and colorized in a certain way.
 */
export function makeSubLogger(name, subName = null, color = 'yellow') {
  const addToolPrefix = addPrefix(name, subName, chalk[color], chalk[`${color}Bright`])
  const log = makeLogger({mapFns: [addToolPrefix, addTimestamps]})
  const logInfo = makeLogger({mapFns: [addToolPrefix, addTimestamps, addColor('cyan', 'info')]})
  const logWarn = makeLogger({mapFns: [addToolPrefix, addTimestamps, addColor('yellow', 'warn')]})
  const logError = makeLogger({mapFns: [addToolPrefix, addTimestamps, addColor('red', 'error')], logFn: console.error})
  return {
    log,
    logInfo,
    logWarn,
    logError
  }
}

/** All global logging functions. */
export const log = makeLogger({mapFns: [addTimestamps]})
export const logInfo = makeLogger({mapFns: [addTimestamps, addColor('cyan', 'info')]})
export const logWarn = makeLogger({mapFns: [addTimestamps, addColor('yellow', 'warn')]})
export const logError = makeLogger({mapFns: [addTimestamps, addColor('red', 'error')], logFn: console.error})
export const logFormat = chalkTemplate
export const inspect = makeLogger({logFn: null})

/** Exits the program with an error; works like log() otherwise. */
export const die = makeLogger({
  mapFns: [addTimestamps, addColor('red', 'error')],
  logFn: string => {
    console.error(string)
    progKill(1)
  }
})
