// HydraBot <https://github.com/msikma/hydrabot>
// © MIT license

/**
 * Copies over an ArrayBuffer into a new buffer.
 */
export function copyArrayBuffer(buf) {
  const copy = new ArrayBuffer(buf.byteLength)
  new Uint8Array(copy).set(new Uint8Array(buf))
  return copy
}
