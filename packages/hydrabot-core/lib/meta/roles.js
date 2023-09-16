// HydraBot <https://github.com/msikma/hydrabot>
// © MIT license

/** Order of StarCraft races. */
const RACE_ORDER = {
  terran: 0,
  protoss: 1,
  zerg: 2,
  random: 3,
  racepicker: 4,
  racepick_random: 5,
  raceless: 6,
  unknown: 100
}

/** Order of the ranks. */
const RANK_ORDER = {
  s: 0,
  a: 1,
  b: 2,
  c: 3,
  d: 4,
  e: 5,
  f: 6,
  u: 7,
  unknown: 100
}

/**
 * Detects whether a given role object represents a meaningful role.
 */
export function detectRoleType(role) {
  const race = detectRaceRole(role)
  const rank = detectRankRole(role)
  if (race) {
    return {race, raceOrder: RACE_ORDER[race] ?? RACE_ORDER['unknown']}
  }
  if (rank) {
    return {rank, rankOrder: RANK_ORDER[rank] ?? RANK_ORDER['unknown']}
  }
  return null
}

/**
 * Returns a given StarCraft ladder rank, if a role represents one.
 */
export function detectRankRole(role) {
  const name = role.name.trim()
  const ranks = ['S', 'A', 'B', 'C', 'D', 'E', 'F', 'U']
  const [rank, label] = name.split(/\s+/)
  if (label !== 'rank') {
    return null
  }
  if (ranks.includes(rank)) {
    return rank.toLowerCase()
  }
  return null
}

/**
 * Returns a given StarCraft race term, if a role represents one.
 */
export function detectRaceRole(role) {
  const name = role.name.toLowerCase().trim()
  const races = ['terran', 'protoss', 'zerg', 'racepick/random', 'raceless']
  if (races.includes(name)) {
    return name
  }
  return null
}
