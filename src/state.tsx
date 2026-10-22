import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { db, loadSettings, saveSettings, DEFAULT_SETTINGS } from './db/dexie'
import type { Settings } from './db/dexie'
import type { CardRecord } from './model/card'
import type { Exercise } from './model/exercise'
import { allExercises } from './generators'
import { stageProgress, highestUnlocked } from './srs/gating'
import type { StageProgress } from './srs/gating'
import { translator } from './i18n'
import { track } from './telemetry'
import type { T } from './i18n'

interface AppState {
  ready: boolean
  settings: Settings
  updateSettings: (patch: Partial<Settings>) => Promise<void>
  cards: Map<string, CardRecord>
  putCard: (c: CardRecord) => Promise<void>
  exercises: Exercise[]
  progress: StageProgress[]
  unlocked: number
  t: T
  /** Bump to re-read reviews/sessions after a session ends */
  refresh: () => Promise<void>
  version: number
}

const Ctx = createContext<AppState | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [cards, setCards] = useState<Map<string, CardRecord>>(new Map())
  const [maxUnlocked, setMaxUnlocked] = useState(0)
  const [version, setVersion] = useState(0)
  const exercises = useMemo(() => allExercises(), [])

  const refresh = useCallback(async () => {
    const [s, list, unlockedRow] = await Promise.all([
      loadSettings(),
      db.cards.toArray(),
      db.kv.get('maxUnlocked'),
    ])
    setSettings(s)
    setCards(new Map(list.map((c) => [c.id, c])))
    setMaxUnlocked((unlockedRow?.value as number) ?? 0)
    setVersion((v) => v + 1)
    setReady(true)
  }, [])

  useEffect(() => {
    refresh()
    navigator.storage?.persist?.()
  }, [refresh])

  const progress = useMemo(
    () => stageProgress(exercises, cards, maxUnlocked, settings.unlockAll),
    [exercises, cards, maxUnlocked, settings.unlockAll],
  )
  const unlocked = highestUnlocked(progress)

  // Remember the furthest stage reached so a bad day never re-locks it
  useEffect(() => {
    if (!ready || settings.unlockAll || unlocked <= maxUnlocked) return
    setMaxUnlocked(unlocked)
    db.kv.put({ key: 'maxUnlocked', value: unlocked })
  }, [ready, unlocked, maxUnlocked, settings.unlockAll])

  const updateSettings = useCallback(
    async (patch: Partial<Settings>) => {
      const next = { ...settings, ...patch }
      for (const [key, value] of Object.entries(patch)) {
        const from = settings[key as keyof Settings]
        if (from !== value) track('setting_change', { key, from, to: value })
      }
      setSettings(next)
      await saveSettings(next)
    },
    [settings],
  )

  const putCard = useCallback(async (c: CardRecord) => {
    await db.cards.put(c)
    setCards((prev) => new Map(prev).set(c.id, c))
  }, [])

  const t = useMemo(() => translator(settings.lang), [settings.lang])

  useEffect(() => {
    document.documentElement.lang = settings.lang
  }, [settings.lang])

  const value: AppState = {
    ready,
    settings,
    updateSettings,
    cards,
    putCard,
    exercises,
    progress,
    unlocked,
    t,
    refresh,
    version,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useApp(): AppState {
  const v = useContext(Ctx)
  if (!v) throw new Error('useApp outside AppProvider')
  return v
}

let audioCtx: AudioContext | null = null

/** One AudioContext for the whole app, created and resumed on a user gesture. */
export async function getAudio(): Promise<AudioContext> {
  if (!audioCtx) audioCtx = new AudioContext({ latencyHint: 'interactive' })
  if (audioCtx.state !== 'running') await audioCtx.resume()
  return audioCtx
}

export function exerciseTitle(ex: Exercise, t: T): string {
  return ex.nameKey ? t(ex.nameKey as Parameters<T>[0]) : t(`family.${ex.family}` as Parameters<T>[0])
}

export function exerciseSubtitle(ex: Exercise, t: T): string | null {
  return ex.voiceKey ? t(ex.voiceKey as Parameters<T>[0]) : null
}
