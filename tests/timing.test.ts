import { describe, expect, it } from 'vitest'
import { analyze, groupNotes, isReliable, matchWindow, median, nearestOffsetMs } from '../src/audio/timingAnalysis'

describe('timing analysis', () => {
  const step = 0.125 // 16ths at 120 BPM
  const expected = Array.from({ length: 16 }, (_, i) => 1 + i * step)

  it('reports a consistent rush as a negative mean', () => {
    const onsets = expected.map((t) => t - 0.015)
    const { summary } = analyze(expected, onsets, matchWindow(step))
    expect(summary.meanMs).toBeCloseTo(-15, 5)
    expect(summary.sdMs).toBeCloseTo(0, 5)
    expect(summary.matched).toBe(16)
    expect(summary.missed).toBe(0)
    expect(summary.extra).toBe(0)
  })

  it('counts missed notes and stray hits', () => {
    const onsets = expected.filter((_, i) => i !== 3 && i !== 9).map((t, i) => t + (i % 2 ? 0.01 : -0.01))
    onsets.push(10) // far away
    const { summary } = analyze(expected, onsets, matchWindow(step))
    expect(summary.missed).toBe(2)
    expect(summary.extra).toBe(1)
    expect(summary.meanAbsMs).toBeCloseTo(10, 5)
  })

  it('never matches one hit to two notes', () => {
    const { summary } = analyze([1, 1.05], [1.025], 0.05)
    expect(summary.matched).toBe(1)
    expect(summary.missed).toBe(1)
  })

  it('nearest offset for live feedback', () => {
    expect(nearestOffsetMs(expected, 1.13, 0.05)).toBeCloseTo(5, 5)
    expect(nearestOffsetMs(expected, 1.06, 0.05)).toBeNull()
  })

  it('median', () => {
    expect(median([5, 1, 3])).toBe(3)
    expect(median([4, 1, 3, 2])).toBe(2.5)
  })
})

describe('per-note grouping', () => {
  it('finds the weak second stroke of a double', () => {
    // RRLL at 120 BPM 16ths: every second note of each double is missed
    const step = 0.125
    const expected = Array.from({ length: 16 }, (_, i) => 1 + i * step)
    const onsets = expected.filter((_, i) => i % 2 === 0).map((t) => t + 0.01)
    const { perNote } = analyze(expected, onsets, matchWindow(step))
    const byStep = groupNotes(expected.map((_, i) => i % 4), perNote)
    expect(byStep).toEqual([
      { key: 0, hits: 4, missed: 0, meanMs: 10 },
      { key: 1, hits: 0, missed: 4, meanMs: 0 },
      { key: 2, hits: 4, missed: 0, meanMs: 10 },
      { key: 3, hits: 0, missed: 4, meanMs: 0 },
    ])
  })
})

describe('reliability', () => {
  it('flags your first export attempt as unreliable', () => {
    expect(isReliable({ matched: 263, missed: 234, extra: 67 })).toBe(false)
  })
  it('accepts a mostly caught attempt', () => {
    expect(isReliable({ matched: 90, missed: 10, extra: 5 })).toBe(true)
    expect(isReliable({ matched: 90, missed: 10, extra: 30 })).toBe(false)
    expect(isReliable({ matched: 0, missed: 0, extra: 0 })).toBe(false)
  })
})
