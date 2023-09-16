// HydraBot <https://github.com/msikma/hydrabot>
// © MIT license

import {HydraBot} from './index.js'
import {progError} from './util/program.js'

/**
 * Initializes HydraBot from the command line.
 * 
 * This passes on the passed arguments and marks the bot as running from the command line.
 */
export async function initFromCli(args) {
  // Initialize hydrabot and start listening.
  const hb = new HydraBot({...args}, args.packageData, true)
  try {
    await hb.init()
    if (!args.actionTest) {
      await hb.connect()
    }
  }
  catch (err) {
    if (err.code === 'ELOCKED') {
      console.log(progError(`another instance is already running.`))
    }
    else {
      console.error(progError(`${String(err)}.`))
      if (err.stack) {
        console.error(err.stack)
      }
    }
  }
}
