// HydraBot <https://github.com/msikma/hydrabot>
// © MIT license

import path from 'path'

/** Returns the current program name. */
export function progName() {
  return path.basename(process.argv[1])
}

/** Formats a program error string. */
export function progError(error) {
  return `${progName()}: error: ${error}`
}

/** Exits the program with a given exit code. */
export function progKill(exitCode = 0) {
  process.exit(exitCode)
}
