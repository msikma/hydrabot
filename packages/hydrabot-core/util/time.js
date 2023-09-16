// HydraBot <https://github.com/msikma/hydrabot>
// © MIT license

/**
 * Returns a date as two arrays of date and time string values.
 * 
 * E.g. [['2021', '04', '20'], ['14', '30', '57']].
 */
export function getDateSegments(dateObj = new Date()) {
  const [date, time] = dateObj.toISOString().split('T')
  const dateArr = date.split('-')
  const timeArr = time.slice(0, 8).split(':')
  return [dateArr, timeArr]
}

/**
 * Returns a simple date for the console logger.
 * 
 * E.g. "15:14:46Z".
 */
export function getDateForLogger(includeDate = false, dateObj = new Date()) {
  const [date, time] = getDateSegments(dateObj)
  if (includeDate) {
    return `${[date.join('-'), time.join(':')].join(' ')}Z`
  }
  else {
    return `${[time.join(':')].join(' ')}Z`
  }
}
