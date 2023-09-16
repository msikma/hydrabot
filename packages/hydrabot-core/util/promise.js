// HydraBot <https://github.com/msikma/hydrabot>
// © MIT license

/** Sleeps for a given amount of milliseconds. */
export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
