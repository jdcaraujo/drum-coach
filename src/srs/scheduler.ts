import { createEmptyCard, fsrs, Rating } from 'ts-fsrs'
import type { Grade } from 'ts-fsrs'
import type { Exercise } from '../model/exercise'
import type { CardRecord, Mode, RatingName } from '../model/card'

/**
 * Motor skills fade differently from facts: cap intervals so every pattern
 * comes back at least every ~6 weeks, and let FSRS manage short-term steps.
 */
const scheduler = fsrs({
  request_retention: 0.9,
  maximum_interval: 42,
  enable_short_term: false,
  enable_fuzz: true,
})

const GRADE: Record<RatingName, Grade> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
}

/** BPM change applied after each rating — the tempo ladder. */
export const TEMPO_STEP: Record<RatingName, number> = {
  again: -6,
  hard: 0,
  good: 4,
  easy: 8,
}

export function newCard(ex: Exercise, now: Date, pinned = false): CardRecord {
  return {
    id: ex.id,
    fsrs: createEmptyCard(now),
    bpm: ex.startBpm,
    bestCleanBpm: 0,
    pinned,
    introducedAt: now.getTime(),
  }
}

export function nextBpm(ex: Exercise, playedBpm: number, rating: RatingName): number {
  const max = Math.round(ex.targetBpm * 1.25)
  const min = Math.max(30, Math.round(ex.startBpm * 0.6))
  return Math.min(max, Math.max(min, playedBpm + TEMPO_STEP[rating]))
}

/**
 * Apply a self-rating. Warm-ups only move the tempo marker; everything else
 * also goes through FSRS so the card's next due date reflects how it went.
 */
export function rate(
  card: CardRecord,
  ex: Exercise,
  rating: RatingName,
  playedBpm: number,
  mode: Mode,
  now: Date,
): CardRecord {
  const clean = rating === 'good' || rating === 'easy'
  const updated: CardRecord = {
    ...card,
    lastPracticedAt: now.getTime(),
    bestCleanBpm: clean ? Math.max(card.bestCleanBpm, playedBpm) : card.bestCleanBpm,
  }
  if (mode === 'warmup') return updated
  updated.bpm = nextBpm(ex, playedBpm, rating)
  updated.lastRating = rating
  updated.fsrs = scheduler.next(card.fsrs, now, GRADE[rating]).card
  return updated
}

export function isDue(card: CardRecord, now: Date): boolean {
  return card.fsrs.due.getTime() <= now.getTime()
}

/** Ready to count toward unlocking the next stage. */
export function isSolid(card: CardRecord, ex: Exercise): boolean {
  return (
    (card.lastRating === 'good' || card.lastRating === 'easy') &&
    card.bestCleanBpm >= Math.round(ex.targetBpm * 0.7)
  )
}
