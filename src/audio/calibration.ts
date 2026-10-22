import { MicListener } from './mic'
import { click } from './sounds'
import { median } from './timingAnalysis'

export type CalibrationMethod = 'loopback' | 'tap'

export interface CalibrationResult {
  /** Median delay, or null if too few clicks/taps were heard */
  latencyMs: number | null
  samples: number
  /** Every measured delay, ms */
  diffsMs: number[]
  /** Total onsets the mic detected during the test, including noise */
  onsetCount: number
  expected: number
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Measure the delay between a click being scheduled and a hit being detected.
 *
 * - loopback: the phone speaker plays clicks and the mic hears them. Measures
 *   output + input latency with no human in the loop. Use without headphones.
 * - tap: you hit the pad along with the click. Needed for Bluetooth headphones;
 *   note it also absorbs your own habit of playing slightly ahead of the beat.
 */
export async function calibrate(
  ctx: AudioContext,
  method: CalibrationMethod,
  sensitivity: number,
  onProgress?: (fraction: number) => void,
): Promise<CalibrationResult> {
  const count = method === 'loopback' ? 10 : 20
  const interval = method === 'loopback' ? 0.6 : 60 / 90
  const skip = method === 'loopback' ? 0 : 4
  const onsets: number[] = []
  const mic = new MicListener()
  await mic.start(ctx, sensitivity, (o) => onsets.push(o.time))
  try {
    const t0 = ctx.currentTime + 0.5
    const clicks = Array.from({ length: count }, (_, i) => t0 + i * interval)
    clicks.forEach((t, i) => click(ctx, ctx.destination, t, i % 4 === 0 ? 'down' : 'beat', 1))
    const totalMs = (0.5 + count * interval + 0.5) * 1000
    for (let elapsed = 0; elapsed < totalMs; elapsed += 200) {
      onProgress?.(elapsed / totalMs)
      await wait(200)
    }
    const window = method === 'loopback' ? [0, 0.35] : [-0.25, 0.35]
    const diffs: number[] = []
    for (const t of clicks.slice(skip)) {
      const hit = onsets.find((o) => o >= t + window[0] && o <= t + window[1])
      if (hit !== undefined) diffs.push(hit - t)
    }
    const enough = diffs.length >= Math.ceil((count - skip) * 0.6)
    return {
      latencyMs: enough ? Math.round(median(diffs) * 1000) : null,
      samples: diffs.length,
      diffsMs: diffs.map((d) => Math.round(d * 1000)),
      onsetCount: onsets.length,
      expected: count - skip,
    }
  } finally {
    mic.stop()
  }
}
