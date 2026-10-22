import type { Card as FsrsCard } from 'ts-fsrs'

/** Practice modes a session item can run in. */
export type Mode = 'warmup' | 'review' | 'new' | 'gap' | 'recall'

export type RatingName = 'again' | 'hard' | 'good' | 'easy'

/** Learning state for an exercise once it has been introduced. */
export interface CardRecord {
  /** Exercise id */
  id: string
  fsrs: FsrsCard
  /** Tempo to use next time */
  bpm: number
  /** Highest tempo rated Good or Easy */
  bestCleanBpm: number
  pinned: boolean
  introducedAt: number
  lastRating?: RatingName
  lastPracticedAt?: number
}

export interface TimingSummary {
  /** Signed mean offset in ms; negative = early (rushing) */
  meanMs: number
  /** Mean absolute offset in ms */
  meanAbsMs: number
  /** Standard deviation of offsets in ms */
  sdMs: number
  matched: number
  missed: number
  extra: number
}

export interface ReviewRecord {
  id?: number
  cardId: string
  at: number
  rating: RatingName
  bpm: number
  mode: Mode
  durationSec: number
  timing?: TimingSummary
  sessionId?: number
}

export interface SessionRecord {
  id?: number
  startedAt: number
  endedAt?: number
  plannedMinutes: number
  itemsDone: number
}
