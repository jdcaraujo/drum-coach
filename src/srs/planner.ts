import type { Exercise } from '../model/exercise'
import type { CardRecord, Mode } from '../model/card'
import { isDue } from './scheduler'

export interface PlanItem {
  exerciseId: string
  mode: Mode
  bpm: number
}

export interface PlanInput {
  exercises: Exercise[]
  cards: Map<string, CardRecord>
  now: Date
  minutes: number
  newPerSession: number
  highestUnlocked: number
}

/** Rough time per item: count-in, ~90 s of playing, rating. */
export const MINUTES_PER_ITEM = 2

/**
 * Build today's session:
 * warm-up → pinned → due reviews → new material (interleaved by family)
 * → gap-click timing check → one from-memory recall at the end.
 */
export function planSession(input: PlanInput): PlanItem[] {
  const { exercises, cards, now, minutes, highestUnlocked } = input
  const byId = new Map(exercises.map((e) => [e.id, e]))
  const slots = Math.max(3, Math.floor(minutes / MINUTES_PER_ITEM))
  const introduced = [...cards.values()].filter((c) => byId.has(c.id))
  const used = new Set<string>()
  const item = (c: CardRecord | Exercise, mode: Mode): PlanItem => {
    used.add(c.id)
    const bpm = 'bpm' in c ? c.bpm : c.startBpm
    return { exerciseId: c.id, mode, bpm }
  }

  // 1. Warm-up: the rudiment you haven't touched for longest, at ~80% of its tempo
  const rudimentCards = introduced
    .filter((c) => byId.get(c.id)!.family === 'rudiments')
    .sort((a, b) => (a.lastPracticedAt ?? 0) - (b.lastPracticedAt ?? 0))
  const warmCard: CardRecord | undefined = rudimentCards[0]
  const warmId = warmCard?.id ?? 'rudiments:singles'
  // The warm-up exercise doesn't come back later in the same session
  used.add(warmId)
  const warmup: PlanItem = {
    exerciseId: warmId,
    mode: 'warmup',
    bpm: Math.max(40, Math.round((warmCard?.bpm ?? byId.get(warmId)!.startBpm) * 0.8)),
  }

  const reviewed = introduced.filter((c) => c.lastRating)
  const wantGap = reviewed.length >= 2 && slots >= 5
  const wantRecall = reviewed.length >= 3 && slots >= 4
  const reserved = (wantGap ? 1 : 0) + (wantRecall ? 1 : 0)
  let budget = slots - 1 - reserved

  const main: PlanItem[] = []
  const take = (list: PlanItem[]) => {
    for (const p of list) {
      if (budget <= 0) break
      main.push(p)
      budget--
    }
  }

  // 2. Pinned ("teacher assigned") always come first
  take(introduced.filter((c) => c.pinned).map((c) => item(c, 'review')))

  // 3. New material: one from the frontier stage, the rest from the lowest stage with gaps
  const fresh = exercises.filter(
    (e) => !cards.has(e.id) && !used.has(e.id) && e.stage <= highestUnlocked,
  )
  // First session: a few more new items, but not so many that nothing gets real repetition
  const newCount = introduced.length === 0 ? Math.min(4, budget) : input.newPerSession
  const picks: Exercise[] = []
  const frontier = fresh.filter((e) => e.stage === highestUnlocked)
  if (frontier.length) picks.push(frontier[0])
  for (const e of fresh) {
    if (picks.length >= newCount) break
    if (!picks.includes(e)) picks.push(e)
  }

  const newItems = picks.slice(0, newCount).map((e) => item(e, 'new'))
  // Keep one slot for new material so a pile of reviews never stalls progress
  take(newItems.slice(0, 1))

  // 4. Due reviews, most overdue first
  take(
    introduced
      .filter((c) => !used.has(c.id) && isDue(c, now))
      .sort((a, b) => a.fsrs.due.getTime() - b.fsrs.due.getTime())
      .map((c) => item(c, 'review')),
  )

  take(newItems.slice(1))

  // 5. Gap click on something you can already play cleanly
  const unusedReviewed = () => reviewed.filter((c) => !used.has(c.id))
  const gapCard = wantGap
    ? unusedReviewed()
        .filter((c) => c.lastRating !== 'again')
        .sort((a, b) => b.bestCleanBpm - a.bestCleanBpm)[0]
    : undefined
  if (gapCard) used.add(gapCard.id)

  // 6. Recall from memory, picking what's due soonest among the rest
  const recallCard = wantRecall
    ? unusedReviewed().sort((a, b) => a.fsrs.due.getTime() - b.fsrs.due.getTime())[0]
    : undefined
  if (recallCard) used.add(recallCard.id)

  // 7. Spare time (including reserved slots nothing could fill): extra practice, due soonest first
  budget += reserved - (gapCard ? 1 : 0) - (recallCard ? 1 : 0)
  take(
    introduced
      .filter((c) => !used.has(c.id))
      .sort((a, b) => a.fsrs.due.getTime() - b.fsrs.due.getTime())
      .map((c) => item(c, 'review')),
  )

  const plan = [warmup, ...interleave(main, byId)]
  if (gapCard) plan.push({ exerciseId: gapCard.id, mode: 'gap', bpm: gapCard.bpm })
  if (recallCard) plan.push({ exerciseId: recallCard.id, mode: 'recall', bpm: recallCard.bpm })
  return plan
}

/** Reorder so consecutive items come from different families where possible. */
export function interleave(items: PlanItem[], byId: Map<string, Exercise>): PlanItem[] {
  const rest = [...items]
  const out: PlanItem[] = []
  let lastFamily: string | undefined
  while (rest.length) {
    let i = rest.findIndex((p) => byId.get(p.exerciseId)!.family !== lastFamily)
    if (i < 0) i = 0
    const [p] = rest.splice(i, 1)
    out.push(p)
    lastFamily = byId.get(p.exerciseId)!.family
  }
  return out
}
