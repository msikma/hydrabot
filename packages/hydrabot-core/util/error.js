// HydraBot <https://github.com/msikma/hydrabot>
// © MIT license

/**
 * Returns a user-readable version of the error object.
 */
export function getErrorMessage(error) {
  return error.stack ? `\n${error.stack}` : `${String(error)}`
}
