import { db } from './db/dexie'

/**
 * Local usage log. Nothing leaves the phone: events are stored in IndexedDB
 * and only included in the JSON you export from Settings, so we can see how
 * the app is really used and improve it.
 */
export type EventType =
  | 'app_open'
  | 'app_hidden'
  | 'app_visible'
  | 'app_close'
  | 'error'
  | 'screen_view'
  | 'setting_change'
  | 'calibration'
  | 'pin'
  | 'stage_open'
  | 'exercise_open'
  | 'session_start'
  | 'session_end'
  | 'item_ready'
  | 'item_skip'
  | 'play_start'
  | 'play_stop'
  | 'bpm_change'
  | 'toggle'
  | 'reveal'
  | 'mic_error'
  | 'mic_test'
  | 'rate'
  | 'export'
  | 'import'

export interface EventRecord {
  id?: number
  at: number
  type: EventType
  sessionId?: number
  cardId?: string
  data?: Record<string, unknown>
}

declare const __BUILD__: string
export const BUILD = typeof __BUILD__ === 'string' ? __BUILD__ : 'dev'

let currentSession: number | undefined

/** Events logged while a session is open get its id. */
export function setTelemetrySession(id: number | undefined) {
  currentSession = id
}

export function track(type: EventType, data?: Record<string, unknown>, cardId?: string) {
  db.events
    .add({ at: Date.now(), type, sessionId: currentSession, cardId, data })
    .catch(() => {
      /* logging must never break practice */
    })
}

export function deviceInfo(): Record<string, unknown> {
  return {
    build: BUILD,
    userAgent: navigator.userAgent,
    language: navigator.language,
    standalone: matchMedia('(display-mode: standalone)').matches,
    screen: `${screen.width}x${screen.height}@${devicePixelRatio}`,
    viewport: `${innerWidth}x${innerHeight}`,
    orientation: screen.orientation?.type,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  }
}

let installed = false

/** App-level events: opens, backgrounding, closing, uncaught errors. */
export function installGlobalTracking() {
  if (installed) return
  installed = true
  track('app_open', deviceInfo())
  document.addEventListener('visibilitychange', () =>
    track(document.visibilityState === 'hidden' ? 'app_hidden' : 'app_visible'),
  )
  addEventListener('pagehide', () => track('app_close'))
  addEventListener('error', (e) => track('error', { message: e.message, source: e.filename, line: e.lineno }))
  addEventListener('unhandledrejection', (e) => track('error', { message: String(e.reason) }))
}
