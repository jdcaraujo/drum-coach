import { mergeSteps, mirrorSteps, parseSticking, repeatSteps } from '../model/exercise'
import type { Exercise, Limb, Step } from '../model/exercise'
import { make, mirrorSticking, rotate, stepsLabel } from './common'

type HandMode = 'same' | 'opposite' | 'alternate'
const HAND_MODES: HandMode[] = ['same', 'opposite', 'alternate']

/**
 * One group of melodic coordination on the right side: a single limb per note,
 * feet on `footSlots`, hands on the rest according to `mode`.
 */
function melodicGroup(size: number, footSlots: number[], mode: HandMode): Step[] {
  let handIndex = 0
  return Array.from({ length: size }, (_, i): Step => {
    if (footSlots.includes(i)) return [{ limb: 'RF' }]
    const right =
      mode === 'same' ? true : mode === 'opposite' ? false : handIndex % 2 === 0
    handIndex++
    return [{ limb: right ? 'RH' : 'LH' }]
  })
}

/** Book pp. 3–13: one hand or foot at a time, right-side group answered by the mirrored left-side group. */
export function melodic(): Exercise[] {
  const out: Exercise[] = []
  const eighthSlots = [[0], [1], [2], [3], [0, 2], [0, 3], [1, 3], [0, 1]]
  eighthSlots.forEach((slots, si) => {
    HAND_MODES.forEach((mode, mi) => {
      const g = melodicGroup(4, slots, mode)
      const steps = [...g, ...mirrorSteps(g)]
      out.push(
        make({
          id: `melodic8:f${slots.join('-')}:${mode}`,
          family: 'melodic8',
          order: si * 3 + mi,
          label: stepsLabel(steps, 4),
          subdivision: 2,
          steps,
          startBpm: 70,
          targetBpm: 160,
        }),
      )
    })
  })
  ;[[0], [1], [2]].forEach((slots, si) => {
    HAND_MODES.forEach((mode, mi) => {
      const g = melodicGroup(3, slots, mode)
      const steps = repeatSteps([...g, ...mirrorSteps(g)], 2)
      out.push(
        make({
          id: `melodic3:f${slots.join('-')}:${mode}`,
          family: 'melodic3',
          order: si * 3 + mi,
          label: stepsLabel(steps, 3),
          subdivision: 3,
          steps,
          startBpm: 60,
          targetBpm: 140,
        }),
      )
    })
  })
  return out
}

/** Sticking for a whole bar: the group followed by its mirror, repeated to fill `length`. */
function barSticking(group: string, length: number): string {
  const pair = group + mirrorSticking(group)
  return pair.repeat(Math.ceil(length / pair.length)).slice(0, length)
}

function handsAndFeet(hands: string, feet: string): Step[] {
  return mergeSteps(parseSticking(hands, 'hands'), parseSticking(feet, 'feet'))
}

/** Book pp. 14–23: hands and feet play together, identical or opposite sides, or different stickings. */
export function twoPart(): Exercise[] {
  const out: Exercise[] = []
  const groups8 = ['RLRL', 'RRLL', 'RLRR', 'RLLR', 'RRRL', 'RRLR']
  const pairs: Array<[number, number, string]> = []
  groups8.forEach((_, i) => pairs.push([i, i, 'identical']))
  groups8.forEach((_, i) => pairs.push([i, i, 'opposite']))
  groups8.forEach((_, i) => pairs.push([i, (i + 1) % groups8.length, 'cross']))
  groups8.forEach((_, i) => pairs.push([i, (i + 3) % groups8.length, 'cross']))

  pairs.forEach(([hi, fi, rel], order) => {
    const hands = barSticking(groups8[hi], 8)
    const feetBase = barSticking(groups8[fi], 8)
    const feet = rel === 'opposite' ? mirrorSticking(feetBase) : feetBase
    out.push(
      make({
        id: `twoPart8:${groups8[hi]}:${groups8[fi]}:${rel}`,
        family: 'twoPart8',
        order,
        label: `H ${spaced(hands, 4)} · F ${spaced(feet, 4)}`,
        voiceKey: `rel.${rel}`,
        subdivision: 2,
        steps: handsAndFeet(hands, feet),
        startBpm: 60,
        targetBpm: 150,
      }),
    )
  })

  const groups3 = ['RLR', 'RRL', 'RLL', 'RRR']
  let order = 0
  for (const rel of ['identical', 'opposite']) {
    for (const g of groups3) {
      const hands = barSticking(g, 12)
      const feet = rel === 'opposite' ? mirrorSticking(hands) : hands
      out.push(
        make({
          id: `twoPart3:${g}:${rel}`,
          family: 'twoPart3',
          order: order++,
          label: `H ${spaced(hands, 3)} · F ${spaced(feet, 3)}`,
          voiceKey: `rel.${rel}`,
          subdivision: 3,
          steps: handsAndFeet(hands, feet),
          startBpm: 55,
          targetBpm: 130,
        }),
      )
    }
  }
  return out
}

function spaced(s: string, group: number): string {
  return s.match(new RegExp(`.{1,${group}}`, 'g'))!.join(' ')
}

/** Book p. 24: every limb plays the pulse; one limb is added each bar until all four play. */
export function fourWayBuild(): Exercise[] {
  const orders: Limb[][] = [
    ['RH', 'RF', 'LH', 'LF'],
    ['RH', 'LH', 'RF', 'LF'],
    ['RF', 'LF', 'RH', 'LH'],
    ['LF', 'LH', 'RF', 'RH'],
  ]
  const out: Exercise[] = []
  for (const sub of [2, 3]) {
    orders.forEach((limbs, i) => {
      const perBar = sub * 4
      const steps: Step[] = []
      for (let bar = 0; bar < 4; bar++) {
        for (let s = 0; s < perBar; s++) {
          steps.push(limbs.slice(0, bar + 1).map((limb) => ({ limb })))
        }
      }
      out.push(
        make({
          id: `fourWayBuild:${sub}:${limbs.join('-')}`,
          family: 'fourWayBuild',
          order: (sub - 2) * 10 + i,
          label: limbs.join(' → '),
          subdivision: sub,
          steps,
          startBpm: 60,
          targetBpm: 140,
        }),
      )
    })
  }
  return out
}

/** Book pp. 25–26: one side-pattern in the hands, another in the feet. */
export function fourWay(): Exercise[] {
  const out: Exercise[] = []

  const p8 = [
    ...[0, 1, 2, 3].map((o) => rotate('RRLLRRLL', o)),
    ...[0, 1].map((o) => rotate('RLRLRLRL', o)),
  ]
  pairsByDifficulty(p8, p8).forEach(([h, f], order) => {
    out.push(
      make({
        id: `fourWay8:${h}:${f}`,
        family: 'fourWay8',
        order,
        label: `H ${spaced(h, 4)} · F ${spaced(f, 4)}`,
        subdivision: 2,
        steps: handsAndFeet(h, f),
        startBpm: 60,
        targetBpm: 140,
      }),
    )
  })

  const p3 = [
    ...[0, 1, 2, 3, 4, 5].map((o) => rotate('RRRLLL'.repeat(2), o)),
    ...[0, 1].map((o) => rotate('RL'.repeat(6), o)),
  ]
  const feet3 = [p3[0], p3[3], p3[6], p3[7]]
  pairsByDifficulty(p3, feet3).forEach(([h, f], order) => {
    out.push(
      make({
        id: `fourWay3:${h}:${f}`,
        family: 'fourWay3',
        order,
        label: `H ${spaced(h, 3)} · F ${spaced(f, 3)}`,
        subdivision: 3,
        steps: handsAndFeet(h, f),
        startBpm: 50,
        targetBpm: 120,
      }),
    )
  })
  return out
}

/** All hand × feet pairs, easiest (most steps on the same side) first. */
function pairsByDifficulty(hands: string[], feet: string[]): Array<[string, string]> {
  const diff = (a: string, b: string) => [...a].filter((c, i) => c !== b[i]).length
  const pairs: Array<[string, string]> = []
  for (const h of hands) for (const f of feet) pairs.push([h, f])
  // Identical sides first, then mirror-image, then by how often hands and feet disagree
  const score = ([h, f]: [string, string]) => {
    const d = diff(h, f)
    return d === 0 ? -2 : d === h.length ? -1 : d
  }
  return pairs
    .map((p, i) => ({ p, i, s: score(p) }))
    .sort((a, b) => a.s - b.s || a.i - b.i)
    .map((x) => x.p)
}
