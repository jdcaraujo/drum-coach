import type { Exercise } from '../model/exercise'
import { click, drum } from './sounds'

export interface GapPattern {
  /** Bars with click */
  play: number
  /** Bars without click */
  mute: number
}

export interface MetronomeOptions {
  exercise: Exercise
  bpm: number
  volume: number
  /** Play the pattern itself with synth drums */
  guide: boolean
  gap: GapPattern | null
}

/** A scheduled grid step, in AudioContext time. */
export interface ScheduledStep {
  time: number
  /** Global step counter since the end of the count-in */
  n: number
  /** Index into exercise.steps */
  index: number
  bar: number
  muted: boolean
}

const LOOKAHEAD_S = 0.12
const TICK_MS = 25

/**
 * Look-ahead Web Audio scheduler ("A Tale of Two Clocks"): a JS timer wakes
 * every 25 ms and schedules every step falling in the next 120 ms on the
 * audio clock, so clicks stay sample-accurate even when the UI thread stutters.
 */
export class Metronome {
  readonly ctx: AudioContext
  private out: GainNode
  private timer: number | null = null
  private opts: MetronomeOptions | null = null
  private nextN = 0
  /** Anchor for step timing; moves when the tempo changes mid-play */
  playStart = 0
  /** Audio time of the first beat after the count-in; never moves */
  firstBeat = 0
  stepDur = 0
  /** Every step scheduled so far, for the UI playhead and timing analysis */
  readonly scheduled: ScheduledStep[] = []

  constructor(ctx: AudioContext) {
    this.ctx = ctx
    this.out = ctx.createGain()
    this.out.connect(ctx.destination)
  }

  get running(): boolean {
    return this.timer !== null
  }

  start(opts: MetronomeOptions) {
    this.stop()
    this.opts = opts
    const { exercise, bpm } = opts
    const beat = 60 / bpm
    this.stepDur = beat / exercise.subdivision
    const t0 = this.ctx.currentTime + 0.15
    // One bar of count-in on quarter notes
    for (let b = 0; b < exercise.beatsPerBar; b++) {
      click(this.ctx, this.out, t0 + b * beat, b === 0 ? 'down' : 'beat', opts.volume)
    }
    this.playStart = t0 + exercise.beatsPerBar * beat
    this.firstBeat = this.playStart
    this.nextN = 0
    this.scheduled.length = 0
    this.timer = window.setInterval(() => this.tick(), TICK_MS)
    this.tick()
  }

  stop() {
    if (this.timer !== null) window.clearInterval(this.timer)
    this.timer = null
  }

  /** Change tempo on the fly, continuing from the next step. */
  setBpm(bpm: number) {
    if (!this.opts || !this.running) return
    const last = this.scheduled.at(-1)
    this.opts = { ...this.opts, bpm }
    this.stepDur = 60 / bpm / this.opts.exercise.subdivision
    if (last) {
      // Re-anchor so step nextN lands one new step after the last scheduled one
      this.playStart = last.time + this.stepDur - this.nextN * this.stepDur
    }
  }

  /** Step position at the current audio time; negative during the count-in. */
  position(): { n: number; index: number; bar: number; muted: boolean } {
    const ex = this.opts!.exercise
    const n = Math.floor((this.ctx.currentTime - this.playStart) / this.stepDur)
    const perBar = ex.subdivision * ex.beatsPerBar
    const index = ((n % ex.steps.length) + ex.steps.length) % ex.steps.length
    const bar = Math.floor(n / perBar)
    return { n, index, bar, muted: n >= 0 && this.isMuted(bar) }
  }

  private isMuted(bar: number): boolean {
    const gap = this.opts?.gap
    if (!gap) return false
    return bar % (gap.play + gap.mute) >= gap.play
  }

  private tick() {
    const o = this.opts!
    const ex = o.exercise
    const perBar = ex.subdivision * ex.beatsPerBar
    const horizon = this.ctx.currentTime + LOOKAHEAD_S
    for (;;) {
      const time = this.playStart + this.nextN * this.stepDur
      if (time >= horizon) break
      const n = this.nextN++
      const index = n % ex.steps.length
      const bar = Math.floor(n / perBar)
      const muted = this.isMuted(bar)
      this.scheduled.push({ time, n, index, bar, muted })
      // If the timer was starved (tab in background), drop late sounds instead of bursting them
      if (time < this.ctx.currentTime - 0.03) continue
      if (!muted && n % ex.subdivision === 0) {
        click(this.ctx, this.out, time, n % perBar === 0 ? 'down' : 'beat', o.volume)
      }
      if (o.guide && !muted) {
        for (const hit of ex.steps[index]) drum(this.ctx, this.out, time, hit, o.volume * 0.8)
      }
    }
  }
}
