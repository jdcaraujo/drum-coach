import type { BpmChange } from '../model/card'

/**
 * The tempo you spent the most playing time at during one attempt.
 * A rating describes how the exercise went overall, so it belongs to this
 * tempo, not to whatever the dial showed when you pressed Stop.
 * Changes before Start (atSec null) are already in `startBpm`; changes during
 * the count-in count from the first beat. Ties go to the later tempo.
 */
export function tempoPlayedLongest(startBpm: number, changes: BpmChange[], playedSec: number): number {
  const during = changes
    .filter((c): c is BpmChange & { atSec: number } => c.atSec !== null)
    .sort((a, b) => a.atSec - b.atSec)
  let current = startBpm
  if (playedSec <= 0) return during.at(-1)?.to ?? startBpm
  const time = new Map<number, number>()
  let t = 0
  for (const c of during) {
    const at = Math.max(0, Math.min(c.atSec, playedSec))
    time.set(current, (time.get(current) ?? 0) + (at - t))
    current = c.to
    t = at
  }
  time.set(current, (time.get(current) ?? 0) + (playedSec - t))
  let best = current
  let bestTime = time.get(current)!
  for (const [bpm, secs] of time) {
    if (secs > bestTime) {
      best = bpm
      bestTime = secs
    }
  }
  return best
}
