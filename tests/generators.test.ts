import { describe, expect, it } from 'vitest'
import { allExercises, exerciseById } from '../src/generators'
import { STAGES, limbsUsed } from '../src/model/exercise'

describe('generators', () => {
  const all = allExercises()

  it('produces unique ids', () => {
    const ids = all.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('covers every stage', () => {
    for (const family of STAGES) {
      expect(all.some((e) => e.family === family), family).toBe(true)
    }
  })

  it('fills whole bars and never has a limb twice on one step', () => {
    for (const e of all) {
      expect(e.steps.length, e.id).toBe(e.bars * e.subdivision * e.beatsPerBar)
      for (const step of e.steps) {
        const limbs = step.map((h) => h.limb)
        expect(new Set(limbs).size, e.id).toBe(limbs.length)
      }
      expect(e.startBpm).toBeLessThan(e.targetBpm)
    }
  })

  it('paradiddle is RLRR LRLL with accents on group starts', () => {
    const p = exerciseById('rudiments:paradiddle')!
    const sticking = p.steps.map((s) => (s[0].limb === 'RH' ? 'R' : 'L')).join('')
    expect(sticking).toBe('RLRRLRLLRLRRLRLL')
    expect(p.steps.flatMap((s, i) => (s[0].accent ? [i] : []))).toEqual([0, 4, 8, 12])
    expect(p.bookPage).toBeUndefined()
  })

  it('melodic coordination plays exactly one limb per note and mirrors the second half', () => {
    const ex = all.filter((e) => e.family === 'melodic8')
    expect(ex.length).toBe(24)
    for (const e of ex) {
      for (const s of e.steps) expect(s.length).toBe(1)
      expect(e.bookPage).toBe(4)
    }
    const first = exerciseById('melodic8:f0:same')!
    expect(first.steps.map((s) => s[0].limb)).toEqual(['RF', 'RH', 'RH', 'RH', 'LF', 'LH', 'LH', 'LH'])
  })

  it('two-part identical keeps hands and feet on the same side', () => {
    const e = exerciseById('twoPart8:RRLL:RRLL:identical')!
    for (const s of e.steps) {
      expect(s.length).toBe(2)
      const hand = s.find((h) => h.limb === 'RH' || h.limb === 'LH')!.limb[0]
      const foot = s.find((h) => h.limb === 'RF' || h.limb === 'LF')!.limb[0]
      expect(hand).toBe(foot)
    }
  })

  it('four-way and ride exercises use all four limbs', () => {
    for (const e of all.filter((x) => ['fourWay8', 'fourWay3', 'rideLH'].includes(x.family))) {
      expect(limbsUsed(e)).toEqual(['RH', 'LH', 'RF', 'LF'])
    }
  })

  it('build-up adds one limb per bar', () => {
    const e = all.find((x) => x.family === 'fourWayBuild')!
    const perBar = e.subdivision * e.beatsPerBar
    expect([0, 1, 2, 3].map((b) => e.steps[b * perBar].length)).toEqual([1, 2, 3, 4])
  })
})
