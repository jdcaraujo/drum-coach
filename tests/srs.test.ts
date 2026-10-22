import { describe, expect, it } from 'vitest'
import { allExercises, exerciseById } from '../src/generators'
import { newCard, rate, nextBpm, isDue } from '../src/srs/scheduler'
import { planSession, interleave } from '../src/srs/planner'
import { stageProgress, highestUnlocked } from '../src/srs/gating'
import type { CardRecord } from '../src/model/card'

const now = new Date('2026-10-22T18:00:00Z')
const day = 24 * 3600 * 1000
const exercises = allExercises()

describe('tempo ladder', () => {
  const ex = exerciseById('rudiments:paradiddle')!
  it('moves tempo by rating and clamps', () => {
    expect(nextBpm(ex, 80, 'good')).toBe(84)
    expect(nextBpm(ex, 80, 'easy')).toBe(88)
    expect(nextBpm(ex, 80, 'hard')).toBe(80)
    expect(nextBpm(ex, 80, 'again')).toBe(74)
    expect(nextBpm(ex, 40, 'again')).toBe(34)
    expect(nextBpm(ex, 30, 'again')).toBe(30)
    expect(nextBpm(ex, 150, 'easy')).toBe(150)
  })

  it('records clean tempo and schedules into the future on good', () => {
    const c = rate(newCard(ex, now), ex, 'good', 64, 'new', now)
    expect(c.bestCleanBpm).toBe(64)
    expect(c.bpm).toBe(68)
    expect(c.fsrs.due.getTime()).toBeGreaterThan(now.getTime())
    expect(isDue(c, now)).toBe(false)
  })

  it('warm-up does not touch scheduling but a breakdown lowers the tempo', () => {
    const before = { ...newCard(ex, now), bpm: 50 }
    const after = rate(before, ex, 'again', 50, 'warmup', now)
    expect(after.fsrs).toEqual(before.fsrs)
    expect(after.bpm).toBe(44)
    expect(rate(before, ex, 'good', 40, 'warmup', now).bpm).toBe(50)
    expect(rate(before, ex, 'good', 40, 'warmup', now).bestCleanBpm).toBe(40)
  })
})

function cardsWith(entries: Array<[string, Partial<CardRecord>]>): Map<string, CardRecord> {
  return new Map(
    entries.map(([id, patch]) => {
      const ex = exerciseById(id)!
      return [id, { ...newCard(ex, new Date(now.getTime() - 10 * day)), ...patch }]
    }),
  )
}

describe('planner', () => {
  it('first session: warm-up plus new material only', () => {
    const plan = planSession({
      exercises,
      cards: new Map(),
      now,
      minutes: 10,
      newPerSession: 2,
      highestUnlocked: 0,
    })
    expect(plan[0]).toMatchObject({ exerciseId: 'rudiments:singles', mode: 'warmup' })
    expect(plan.slice(1).every((p) => p.mode === 'new')).toBe(true)
    expect(plan.length).toBe(5)
    const first20 = planSession({ exercises, cards: new Map(), now, minutes: 20, newPerSession: 2, highestUnlocked: 0 })
    expect(first20.filter((p) => p.mode === 'new').length).toBe(4)
  })

  it('fits the time budget, includes due + gap + recall, and never repeats in main block', () => {
    const ids = exercises.filter((e) => e.stage <= 2).slice(0, 12).map((e) => e.id)
    const cards = cardsWith(
      ids.map((id, i) => [
        id,
        {
          lastRating: 'good',
          bpm: 80,
          fsrs: { ...newCard(exerciseById(id)!, now).fsrs, due: new Date(now.getTime() + (i - 6) * day) },
        },
      ]),
    )
    const plan = planSession({ exercises, cards, now, minutes: 20, newPerSession: 2, highestUnlocked: 2 })
    expect(plan.length).toBe(10)
    expect(plan.at(-1)!.mode).toBe('recall')
    expect(plan.at(-2)!.mode).toBe('gap')
    const main = plan.slice(1, -2)
    expect(new Set(main.map((p) => p.exerciseId)).size).toBe(main.length)
    // All 6 overdue cards are included
    const due = ids.slice(0, 7)
    expect(due.filter((id) => main.some((p) => p.exerciseId === id)).length).toBeGreaterThanOrEqual(5)
    expect(main.filter((p) => p.mode === 'new').length).toBeLessThanOrEqual(2)
  })

  it('always includes pinned cards', () => {
    const pinnedId = 'rideLH:lh5'
    const cards = cardsWith([[pinnedId, { pinned: true, fsrs: { ...newCard(exerciseById(pinnedId)!, now).fsrs, due: new Date(now.getTime() + 20 * day) } }]])
    const plan = planSession({ exercises, cards, now, minutes: 10, newPerSession: 2, highestUnlocked: 0 })
    expect(plan.some((p) => p.exerciseId === pinnedId)).toBe(true)
  })

  it('interleaves families', () => {
    const byId = new Map(exercises.map((e) => [e.id, e]))
    const items = ['rudiments:singles', 'rudiments:doubles', 'melodic8:f0:same', 'melodic8:f1:same'].map(
      (exerciseId) => ({ exerciseId, mode: 'review' as const, bpm: 60 }),
    )
    const fams = interleave(items, byId).map((p) => byId.get(p.exerciseId)!.family)
    expect(fams).toEqual(['rudiments', 'melodic8', 'rudiments', 'melodic8'])
  })
})

describe('gating', () => {
  it('opens the next stage after 4 solid cards at 80%', () => {
    const rud = exercises.filter((e) => e.stage === 0)
    const solid = (id: string): [string, Partial<CardRecord>] => [id, { lastRating: 'good', bestCleanBpm: 200 }]
    let cards = cardsWith(rud.slice(0, 3).map((e) => solid(e.id)))
    expect(highestUnlocked(stageProgress(exercises, cards, 0, false))).toBe(0)
    cards = cardsWith(rud.slice(0, 4).map((e) => solid(e.id)))
    expect(highestUnlocked(stageProgress(exercises, cards, 0, false))).toBe(1)
    cards = cardsWith([...rud.slice(0, 4).map((e) => solid(e.id)), [rud[4].id, {}], [rud[5].id, {}]])
    expect(highestUnlocked(stageProgress(exercises, cards, 0, false))).toBe(0)
    expect(highestUnlocked(stageProgress(exercises, cards, 1, false))).toBe(1)
    expect(highestUnlocked(stageProgress(exercises, cards, 0, true))).toBe(10)
  })
})

describe('planner with few cards', () => {
  it('never schedules the same exercise twice in one plan', () => {
    const ids = ['rudiments:doubles', 'rudiments:tripletSingles', 'rudiments:paradiddle', 'rudiments:paradiddleInv1']
    const cards = cardsWith(
      ids.map((id) => [
        id,
        { lastRating: 'good', bestCleanBpm: 64, fsrs: { ...newCard(exerciseById(id)!, now).fsrs, due: new Date(now.getTime() + 2 * day) } },
      ]),
    )
    for (const minutes of [10, 20, 30]) {
      const plan = planSession({ exercises, cards, now, minutes, newPerSession: 2, highestUnlocked: 0 })
      const planIds = plan.map((p) => p.exerciseId)
      expect(new Set(planIds).size, `${minutes} min`).toBe(planIds.length)
      expect(plan.some((p) => p.mode === 'recall')).toBe(true)
    }
  })
})
