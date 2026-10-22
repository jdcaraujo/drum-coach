import { STAGES } from '../model/exercise'
import type { Exercise, Family, Limb, Step } from '../model/exercise'

/** Printed page numbers in 4-Way Coordination (Dahlgren & Fine) for each family. */
export const BOOK_PAGES: Partial<Record<Family, number>> = {
  melodic8: 4,
  melodic3: 9,
  twoPart8: 15,
  twoPart3: 20,
  fourWayBuild: 24,
  fourWay8: 25,
  fourWay3: 25,
  rideFeet: 28,
  rideLH: 29,
}

type MakeInput = Omit<Exercise, 'stage' | 'beatsPerBar' | 'bars' | 'bookPage'> & {
  beatsPerBar?: number
}

export function make(input: MakeInput): Exercise {
  const beatsPerBar = input.beatsPerBar ?? 4
  const perBar = input.subdivision * beatsPerBar
  if (input.steps.length % perBar !== 0) {
    throw new Error(`${input.id}: ${input.steps.length} steps is not a whole number of bars`)
  }
  return {
    ...input,
    beatsPerBar,
    bars: input.steps.length / perBar,
    stage: STAGES.indexOf(input.family),
    bookPage: BOOK_PAGES[input.family],
  }
}

const TOKEN: Record<Limb, string> = { RH: 'R', LH: 'L', RF: 'RF', LF: 'LF' }

/** "RF R R R  LF L L L" style label, with a wider gap between groups. */
export function stepsLabel(steps: Step[], group: number): string {
  const tokens = steps.map((s) => (s.length ? s.map((h) => TOKEN[h.limb]).join('+') : '·'))
  const groups: string[] = []
  for (let i = 0; i < tokens.length; i += group) groups.push(tokens.slice(i, i + group).join(' '))
  return groups.join('  ')
}

/** Swap R/L letters in a sticking string. */
export function mirrorSticking(s: string): string {
  return s.replace(/[RL]/g, (c) => (c === 'R' ? 'L' : 'R'))
}

/** Rotate a string left by n characters. */
export function rotate(s: string, n: number): string {
  const k = ((n % s.length) + s.length) % s.length
  return s.slice(k) + s.slice(0, k)
}

/** Count name for a slot in a triplet bar: "1", "1t" (trip), "1l" (let). */
export function tripletCount(pos: number): string {
  const beat = Math.floor(pos / 3) + 1
  return `${beat}${['', 't', 'l'][pos % 3]}`
}
