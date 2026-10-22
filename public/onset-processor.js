// Onset detector for stick hits on a practice pad.
// Tracks a fast (~1 ms) and a slow (~150 ms) energy envelope and reports a hit
// when the fast one jumps well above the slow one, with a refractory period
// so one stroke is counted once. Times are reported in AudioContext frames.
class OnsetProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.fast = 0
    this.slow = 1e-6
    this.lastFrame = -Infinity
    this.aFast = 1 - Math.exp(-1 / (0.001 * sampleRate))
    this.aSlow = 1 - Math.exp(-1 / (0.15 * sampleRate))
    this.refractory = 0.045 * sampleRate
    this.setSensitivity(0.5)
    this.port.onmessage = (e) => {
      if (typeof e.data.sensitivity === 'number') this.setSensitivity(e.data.sensitivity)
    }
  }

  // sensitivity 0..1: higher = quieter hits count
  setSensitivity(s) {
    this.ratio = 12 - 8 * s // fast/slow energy ratio, 12 .. 4
    const minLevel = 0.06 * Math.pow(10, -1.5 * s) // ~0.06 .. ~0.002 amplitude
    this.minEnergy = minLevel * minLevel
  }

  process(inputs) {
    const ch = inputs[0] && inputs[0][0]
    if (!ch) return true
    for (let i = 0; i < ch.length; i++) {
      const x = ch[i] * ch[i]
      this.fast += (x - this.fast) * this.aFast
      this.slow += (x - this.slow) * this.aSlow
      const frame = currentFrame + i
      if (
        frame - this.lastFrame > this.refractory &&
        this.fast > this.minEnergy &&
        this.fast > this.ratio * this.slow
      ) {
        this.lastFrame = frame
        this.port.postMessage({ time: frame / sampleRate, level: Math.sqrt(this.fast) })
      }
    }
    return true
  }
}

registerProcessor('onset-processor', OnsetProcessor)
