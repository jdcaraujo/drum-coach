import Dexie from 'dexie'
import type { Table } from 'dexie'
import type { CardRecord, ReviewRecord, SessionRecord } from '../model/card'
import type { EventRecord } from '../telemetry'

export interface Settings {
  lang: 'en' | 'pt'
  clickVolume: number
  /** Play the pattern itself (synth drums) along with the click */
  guide: boolean
  micEnabled: boolean
  /** Measured input+output latency in ms, subtracted from mic onsets */
  latencyMs: number | null
  /** Onset sensitivity, 0..1 (higher = quieter hits detected) */
  micSensitivity: number
  unlockAll: boolean
  sessionMinutes: number
  newPerSession: number
}

export const DEFAULT_SETTINGS: Settings = {
  lang: navigator.language?.toLowerCase().startsWith('pt') ? 'pt' : 'en',
  clickVolume: 0.7,
  guide: false,
  micEnabled: false,
  latencyMs: null,
  micSensitivity: 0.5,
  unlockAll: false,
  sessionMinutes: 20,
  newPerSession: 2,
}

class DrumDb extends Dexie {
  cards!: Table<CardRecord, string>
  reviews!: Table<ReviewRecord, number>
  sessions!: Table<SessionRecord, number>
  kv!: Table<{ key: string; value: unknown }, string>
  events!: Table<EventRecord, number>

  constructor() {
    super('drum-coach')
    this.version(1).stores({
      cards: 'id, introducedAt',
      reviews: '++id, cardId, at, sessionId',
      sessions: '++id, startedAt',
      kv: 'key',
    })
    this.version(2).stores({
      events: '++id, at, type, sessionId',
    })
  }
}

export const db = new DrumDb()

export async function loadSettings(): Promise<Settings> {
  const row = await db.kv.get('settings')
  return { ...DEFAULT_SETTINGS, ...((row?.value as Partial<Settings>) ?? {}) }
}

export async function saveSettings(s: Settings): Promise<void> {
  await db.kv.put({ key: 'settings', value: s })
}

/** Full JSON backup of everything the user has done, including the usage log. */
export async function exportAll(meta: Record<string, unknown>): Promise<string> {
  const [cards, reviews, sessions, kv, events] = await Promise.all([
    db.cards.toArray(),
    db.reviews.toArray(),
    db.sessions.toArray(),
    db.kv.toArray(),
    db.events.toArray(),
  ])
  return JSON.stringify({
    app: 'drum-coach',
    version: 2,
    meta: { exportedAt: new Date().toISOString(), ...meta },
    cards,
    reviews,
    sessions,
    kv,
    events,
  })
}

export async function importAll(json: string): Promise<void> {
  const data = JSON.parse(json)
  if (data.app !== 'drum-coach') throw new Error('Not a Drum Coach backup')
  // Dates come back as strings from JSON
  const cards: CardRecord[] = data.cards.map((c: CardRecord) => ({
    ...c,
    fsrs: {
      ...c.fsrs,
      due: new Date(c.fsrs.due),
      last_review: c.fsrs.last_review ? new Date(c.fsrs.last_review) : undefined,
    },
  }))
  await db.transaction('rw', [db.cards, db.reviews, db.sessions, db.kv, db.events], async () => {
    await Promise.all([
      db.cards.clear(),
      db.reviews.clear(),
      db.sessions.clear(),
      db.kv.clear(),
      db.events.clear(),
    ])
    await db.cards.bulkPut(cards)
    await db.reviews.bulkPut(data.reviews)
    await db.sessions.bulkPut(data.sessions)
    await db.kv.bulkPut(data.kv)
    if (data.events) await db.events.bulkPut(data.events)
  })
}
