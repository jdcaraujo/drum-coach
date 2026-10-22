export type Limb = 'RH' | 'LH' | 'RF' | 'LF'
export const LIMBS: Limb[] = ['RH', 'LH', 'RF', 'LF']
export const HANDS: Limb[] = ['RH', 'LH']

export interface Hit {
  limb: Limb
  accent?: boolean
  /** Ride/hi-hat cymbal (drawn as an x) */
  cymbal?: boolean
}

/** One grid slot: zero or more simultaneous hits. */
export type Step = Hit[]

export type Family =
  | 'rudiments'
  | 'orchestrated'
  | 'melodic8'
  | 'melodic3'
  | 'twoPart8'
  | 'twoPart3'
  | 'fourWayBuild'
  | 'fourWay8'
  | 'fourWay3'
  | 'rideFeet'
  | 'rideLH'

/** Stage order follows the book: one limb at a time, then pairs, then all four. */
export const STAGES: Family[] = [
  'rudiments',
  'orchestrated',
  'melodic8',
  'melodic3',
  'twoPart8',
  'twoPart3',
  'fourWayBuild',
  'fourWay8',
  'fourWay3',
  'rideFeet',
  'rideLH',
]

export interface Exercise {
  id: string
  family: Family
  stage: number
  /** Order within the stage, easiest first */
  order: number
  /** Short, language-neutral label, e.g. "RLRR LRLL" or "H: RRLL · F: RLRL" */
  label: string
  /** Optional i18n key for a named pattern (e.g. "rud.paradiddle") */
  nameKey?: string
  /** Optional i18n key for the foot/limb voicing (e.g. "voice.rfQuarters") */
  voiceKey?: string
  /** Notes per beat: 2 = eighths, 3 = eighth triplets, 4 = sixteenths */
  subdivision: number
  beatsPerBar: number
  bars: number
  steps: Step[]
  /** Printed page number in 4-Way Coordination, when there is a matching section */
  bookPage?: number
  startBpm: number
  targetBpm: number
}

export function stepsPerBar(ex: Pick<Exercise, 'subdivision' | 'beatsPerBar'>): number {
  return ex.subdivision * ex.beatsPerBar
}

export function limbsUsed(ex: Exercise): Limb[] {
  const used = new Set<Limb>()
  for (const s of ex.steps) for (const h of s) used.add(h.limb)
  return LIMBS.filter((l) => used.has(l))
}

/** Parse a sticking string like "RLRR LRLL" into hand hits; spaces are ignored, "-" is a rest. */
export function parseSticking(s: string, side: 'hands' | 'feet' = 'hands'): Step[] {
  const map: Record<string, Limb> =
    side === 'hands' ? { R: 'RH', L: 'LH' } : { R: 'RF', L: 'LF' }
  const out: Step[] = []
  for (const ch of s.replace(/\s+/g, '')) {
    const upper = ch.toUpperCase()
    if (upper === '-') out.push([])
    else if (map[upper]) out.push([{ limb: map[upper] }])
    else throw new Error(`Bad sticking char "${ch}" in "${s}"`)
  }
  return out
}

/** Mark every hit on the given step indices as accented. */
export function accentAt(steps: Step[], indices: number[]): Step[] {
  const set = new Set(indices)
  return steps.map((s, i) => (set.has(i) ? s.map((h) => ({ ...h, accent: true })) : s))
}

/** A layer with a single limb on the given step indices. */
export function layerAt(length: number, limb: Limb, indices: number[], cymbal = false): Step[] {
  const set = new Set(indices)
  return Array.from({ length }, (_, i) => (set.has(i) ? [{ limb, ...(cymbal ? { cymbal } : {}) }] : []))
}

/** Merge parallel step arrays of equal length into one. */
export function mergeSteps(...layers: Step[][]): Step[] {
  const len = layers[0].length
  for (const l of layers) {
    if (l.length !== len) throw new Error(`Layer length mismatch: ${l.length} vs ${len}`)
  }
  return Array.from({ length: len }, (_, i) => layers.flatMap((l) => l[i]))
}

export function repeatSteps(steps: Step[], times: number): Step[] {
  return Array.from({ length: times }, () => steps).flat()
}

/** Swap left/right for every hit. */
export function mirrorSteps(steps: Step[]): Step[] {
  const swap: Record<Limb, Limb> = { RH: 'LH', LH: 'RH', RF: 'LF', LF: 'RF' }
  return steps.map((s) => s.map((h) => ({ ...h, limb: swap[h.limb] })))
}
