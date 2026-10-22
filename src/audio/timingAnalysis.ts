import type { TimingSummary } from '../model/card'

/** Largest early/late distance still counted as an attempt at a note. */
const MAX_WINDOW_S = 0.12

export function matchWindow(minSpacingS: number): number {
  return Math.min(MAX_WINDOW_S, minSpacingS * 0.45)
}

/**
 * Pair each expected note with the closest detected hit inside the window.
 * `onsets` must already be latency-corrected. Offsets are in ms, negative = early.
 */
export function analyze(expected: number[], onsets: number[], window: number): {
  offsetsMs: number[]
  summary: TimingSummary
} {
  const exp = [...expected].sort((a, b) => a - b)
  const hits = [...onsets].sort((a, b) => a - b)
  const used = new Array(hits.length).fill(false)
  const offsetsMs: number[] = []
  let missed = 0
  let j = 0
  for (const e of exp) {
    while (j < hits.length && hits[j] < e - window) j++
    let best = -1
    for (let k = j; k < hits.length && hits[k] <= e + window; k++) {
      if (!used[k] && (best < 0 || Math.abs(hits[k] - e) < Math.abs(hits[best] - e))) best = k
    }
    if (best < 0) missed++
    else {
      used[best] = true
      offsetsMs.push((hits[best] - e) * 1000)
    }
  }
  return { offsetsMs, summary: summarize(offsetsMs, missed, used.filter((u) => !u).length) }
}

export function summarize(offsetsMs: number[], missed: number, extra: number): TimingSummary {
  const n = offsetsMs.length
  const mean = n ? offsetsMs.reduce((a, b) => a + b, 0) / n : 0
  const meanAbs = n ? offsetsMs.reduce((a, b) => a + Math.abs(b), 0) / n : 0
  const sd = n > 1 ? Math.sqrt(offsetsMs.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : 0
  return {
    meanMs: Math.round(mean * 10) / 10,
    meanAbsMs: Math.round(meanAbs * 10) / 10,
    sdMs: Math.round(sd * 10) / 10,
    matched: n,
    missed,
    extra,
  }
}

/** Offset of a single live hit against the nearest expected note, or null if none is close. */
export function nearestOffsetMs(expected: number[], onset: number, window: number): number | null {
  let best: number | null = null
  for (const e of expected) {
    const d = onset - e
    if (Math.abs(d) <= window && (best === null || Math.abs(d) < Math.abs(best))) best = d
  }
  return best === null ? null : best * 1000
}

export function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
