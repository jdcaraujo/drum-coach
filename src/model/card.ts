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
  detail?: TimingDetail
}

/** Raw-ish mic data for one attempt, to diagnose detection and per-note weaknesses. */
export interface TimingDetail {
  /** Latency subtracted from onsets, ms */
  latencyMs: number
  /** Where that latency came from */
  latencySource: 'calibrated' | 'device'
  /** Match window used, ms */
  windowMs: number
  micSensitivity: number
  /** Every matched offset in play order, ms (rounded) */
  offsetsMs: number[]
  /** Per position in the pattern: how often it was hit, missed, and how early/late on average */
  byStep: Array<{ step: number; hits: number; missed: number; meanMs: number }>
  /** Peak level of each detected onset (0..1), to tune sensitivity */
  onsetLevels: number[]
  /** Timing per bar, to spot drift (gap mode) or fatigue */
  byBar: Array<{ bar: number; hits: number; missed: number; meanMs: number; muted: boolean }>
}

export interface BpmChange {
  /** Seconds after the first beat (negative = during count-in, null = before Start) */
  atSec: number | null
  from: number
  to: number
}

export interface ReviewRecord {
  id?: number
  cardId: string
  at: number
  rating: RatingName
  /** Tempo the rating applies to: the one played longest */
  bpm: number
  /** Tempo on the dial when Stop was pressed */
  stopBpm?: number
  mode: Mode
  /** Seconds from pressing Start to rating */
  durationSec: number
  timing?: TimingSummary
  sessionId?: number
  /** Tempo suggested by the planner */
  plannedBpm?: number
  /** Tempo when Start was pressed */
  startBpm?: number
  bpmChanges?: BpmChange[]
  /** Seconds actually playing (after the count-in, until Stop) */
  playedSec?: number
  /** Complete passes through the pattern */
  loops?: number
  /** Seconds on the screen before pressing Start */
  readySec?: number
  /** Seconds between Stop and the rating */
  decideSec?: number
  guide?: boolean
  mic?: boolean
  revealed?: boolean
  /** Position in the session queue */
  queueIndex?: number
}

export interface SessionRecord {
  id?: number
  startedAt: number
  endedAt?: number
  plannedMinutes: number
  itemsDone: number
}
