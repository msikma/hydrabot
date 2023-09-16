// HydraBot <https://github.com/msikma/hydrabot>
// © MIT license

/**
 * Converts Photoshop style levels to linear multiplier/offset values.
 */
export function levelsToLinear(min, max) {
  const a = 255 / (max - min)
  const b = -min * a
  return [a, b]
}
