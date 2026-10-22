import type { ReviewRecord } from '../model/card'
import { isReliable } from '../audio/timingAnalysis'

const DAY = 24 * 3600 * 1000

export function dayKey(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

/** Consecutive days with practice, counting today or (if not yet practised today) yesterday. */
export function streak(reviews: ReviewRecord[], now = Date.now()): number {
  const days = new Set(reviews.map((r) => dayKey(r.at)))
  let n = 0
  let t = now
  if (!days.has(dayKey(t))) t -= DAY
  while (days.has(dayKey(t))) {
    n++
    t -= DAY
  }
  return n
}

/** Monday 00:00 local time of the week containing `ms`. */
export function weekStart(ms: number): number {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d.getTime()
}

export function minutesByWeek(reviews: ReviewRecord[], weeks: number, now = Date.now()) {
  const thisWeek = weekStart(now)
  const out = Array.from({ length: weeks }, (_, i) => ({
    start: thisWeek - (weeks - 1 - i) * 7 * DAY,
    minutes: 0,
  }))
  for (const r of reviews) {
    const w = out.find((x) => weekStart(r.at) === x.start)
    if (w) w.minutes += r.durationSec / 60
  }
  return out.map((w) => ({ ...w, minutes: Math.round(w.minutes) }))
}

/** Per practice day: mean absolute mic offset across reviews that had mic timing. */
export function timingByDay(reviews: ReviewRecord[]) {
  const map = new Map<string, { at: number; sum: number; n: number }>()
  for (const r of reviews) {
    // Attempts where the mic missed or invented too many notes would only add noise
    if (!r.timing || r.timing.matched < 4 || !isReliable(r.timing)) continue
    const k = dayKey(r.at)
    const e = map.get(k) ?? { at: r.at, sum: 0, n: 0 }
    e.sum += r.timing.meanAbsMs * r.timing.matched
    e.n += r.timing.matched
    map.set(k, e)
  }
  return [...map.values()]
    .sort((a, b) => a.at - b.at)
    .map((e) => ({ at: e.at, ms: Math.round((e.sum / e.n) * 10) / 10 }))
}
