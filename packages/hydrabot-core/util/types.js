// HydraBot <https://github.com/msikma/hydrabot>
// © MIT license

/** Returns true for objects (such as {} or new Object()), false otherwise. */
export const isPlainObject = obj => obj != null && typeof obj === 'object' && obj.constructor === Object

/** Checks whether something is a string. */
export const isString = obj => typeof obj === 'string' || obj instanceof String

/** Checks whether something is an integer. */
export const isInteger = obj => Number.isInteger(obj)

/** Checks whether something is any type of number (excluding NaN). */
export const isNumber = obj => !isNaN(obj) && Object.prototype.toString.call(obj) === '[object Number]'

/** Checks whether something is an array. */
export const isArray = Array.isArray

/** Checks whether something is an Error. */
export const isError = obj => Object.prototype.toString.call(obj) === '[object Error]'

/** Checks whether something is a function. */
export const isFunction = obj => typeof obj === 'function'

/** Checks whether an argument is (likely to be) a template literal. */
export const isTemplateLiteral = obj => Array.isArray(obj) && Array.isArray(obj[0]) && Array.isArray(obj[0]?.raw) && Object.isFrozen(obj[0])

/** Removes nullish values from an object. */
export const objectRemoveNullish = obj => Object.fromEntries(Object.entries(obj).filter(([k, v]) => v != null))

/** Removes empty string values from an object. */
export const objectRemoveEmptyStrings = obj => Object.fromEntries(Object.entries(obj).filter(([k, v]) => v !== ''))
