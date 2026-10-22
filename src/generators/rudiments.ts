import { accentAt, mergeSteps, parseSticking, layerAt } from '../model/exercise'
import type { Exercise, Step } from '../model/exercise'
import { make } from './common'

interface Rudiment {
  key: string
  sticking: string
  subdivision: number
  accents: number[]
}

/** Hand-only rudiments for the practice pad. Every pattern fills exactly one 4/4 bar. */
export const RUDIMENTS: Rudiment[] = [
  { key: 'singles', sticking: 'RLRL RLRL RLRL RLRL', subdivision: 4, accents: [0, 4, 8, 12] },
  { key: 'doubles', sticking: 'RRLL RRLL RRLL RRLL', subdivision: 4, accents: [0, 4, 8, 12] },
  { key: 'tripletSingles', sticking: 'RLR LRL RLR LRL', subdivision: 3, accents: [0, 3, 6, 9] },
  { key: 'paradiddle', sticking: 'RLRR LRLL RLRR LRLL', subdivision: 4, accents: [0, 4, 8, 12] },
  { key: 'paradiddleInv1', sticking: 'LRRL RLLR LRRL RLLR', subdivision: 4, accents: [3, 7, 11, 15] },
  { key: 'paradiddleInv2', sticking: 'RRLR LLRL RRLR LLRL', subdivision: 4, accents: [2, 6, 10, 14] },
  { key: 'paradiddleInv3', sticking: 'RLLR LRRL RLLR LRRL', subdivision: 4, accents: [1, 5, 9, 13] },
  { key: 'doubleParadiddle', sticking: 'RLRLRR LRLRLL', subdivision: 3, accents: [0, 6] },
  { key: 'paradiddlediddle', sticking: 'RLRRLL RLRRLL', subdivision: 3, accents: [0, 6] },
  { key: 'tripleParadiddle', sticking: 'RLRLRLRR LRLRLRLL', subdivision: 4, accents: [0, 8] },
]

export function rudiments(): Exercise[] {
  return RUDIMENTS.map((r, i) =>
    make({
      id: `rudiments:${r.key}`,
      family: 'rudiments',
      order: i,
      label: r.sticking,
      nameKey: `rud.${r.key}`,
      subdivision: r.subdivision,
      steps: accentAt(parseSticking(r.sticking), r.accents),
      startBpm: r.subdivision === 4 ? 60 : 70,
      targetBpm: r.subdivision === 4 ? 120 : 150,
    }),
  )
}

type Voice = 'rfQuarters' | 'bassHat' | 'lfQuarters' | 'feetAlternating' | 'kickOnAccents'

const VOICES: Voice[] = ['rfQuarters', 'lfQuarters', 'bassHat', 'feetAlternating', 'kickOnAccents']

function footLayer(voice: Voice, hands: Step[], sub: number): Step[] {
  const n = hands.length
  const beats = Array.from({ length: n / sub }, (_, b) => b * sub)
  switch (voice) {
    case 'rfQuarters':
      return layerAt(n, 'RF', beats)
    case 'lfQuarters':
      return layerAt(n, 'LF', beats, true)
    case 'bassHat':
      return mergeSteps(
        layerAt(n, 'RF', beats.filter((_, i) => i % 2 === 0)),
        layerAt(n, 'LF', beats.filter((_, i) => i % 2 === 1), true),
      )
    case 'feetAlternating': {
      // Feet alternate on the eighth-note pulse (RF on beats, LF on the "&")
      const half = sub / 2
      const eighths = Array.from({ length: n / half }, (_, i) => i * half)
      return mergeSteps(
        layerAt(n, 'RF', eighths.filter((_, i) => i % 2 === 0)),
        layerAt(n, 'LF', eighths.filter((_, i) => i % 2 === 1)),
      )
    }
    case 'kickOnAccents':
      return layerAt(
        n,
        'RF',
        hands.flatMap((s, i) => (s.some((h) => h.accent) ? [i] : [])),
      )
  }
}

/** Rudiments on the hands with a foot voice underneath — the bridge into 4-way playing. */
export function orchestrated(): Exercise[] {
  const bases = ['singles', 'doubles', 'paradiddle', 'paradiddleInv2']
  const out: Exercise[] = []
  VOICES.forEach((voice, vi) => {
    bases.forEach((key, bi) => {
      if (voice === 'kickOnAccents' && key === 'singles') return
      const r = RUDIMENTS.find((x) => x.key === key)!
      const hands = accentAt(parseSticking(r.sticking), r.accents)
      out.push(
        make({
          id: `orchestrated:${key}:${voice}`,
          family: 'orchestrated',
          order: vi * 10 + bi,
          label: r.sticking,
          nameKey: `rud.${key}`,
          voiceKey: `voice.${voice}`,
          subdivision: r.subdivision,
          steps: mergeSteps(hands, footLayer(voice, hands, r.subdivision)),
          startBpm: 50,
          targetBpm: 110,
        }),
      )
    })
  })
  return out
}
