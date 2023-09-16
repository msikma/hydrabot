// HydraBot <https://github.com/msikma/hydrabot>
// © MIT license

import util from 'util'

/** Default options passed on to the logger. */
export const defaultOptions = {
  logDepth: 6,
  logMaxLength: null,
  logBreakLength: 120,
  logStringLength: 250,
  logFn: console.log,
  mapFns: null,
  colorize: true
}

/**
 * Returns a dump of the contents of an object.
 * 
 * This is used to log the contents of non-string objects.
 */
export function inspectObject(obj, callerOptions = {}) {
  const opts = {...defaultOptions, ...callerOptions}
  return util.inspect(obj, {
    colors: opts.colorize,
    depth: opts.logDepth,
    maxArrayLength: opts.logMaxLength,
    maxStringLength: opts.logStringLength,
    breakLength: opts.logBreakLength,
    ...opts
  })
}

/**
 * Returns a dump of the contents of an object, without colors.
 */
export const inspectObjectPlainText = obj => inspectObject(obj, {colorize: false})
