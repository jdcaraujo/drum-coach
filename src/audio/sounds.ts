import type { Hit } from '../model/exercise'

let noiseBuffer: AudioBuffer | null = null

function noise(ctx: AudioContext): AudioBuffer {
  if (!noiseBuffer || noiseBuffer.sampleRate !== ctx.sampleRate) {
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
    const d = noiseBuffer.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }
  return noiseBuffer
}

function env(ctx: AudioContext, out: AudioNode, t: number, peak: number, decay: number): GainNode {
  const g = ctx.createGain()
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(peak, t + 0.001)
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay)
  g.connect(out)
  return g
}

/** Metronome click. Downbeat is higher and louder. */
export function click(ctx: AudioContext, out: AudioNode, t: number, kind: 'down' | 'beat', volume: number) {
  const osc = ctx.createOscillator()
  osc.type = 'square'
  osc.frequency.value = kind === 'down' ? 1760 : 1175
  const g = env(ctx, out, t, (kind === 'down' ? 0.5 : 0.32) * volume, 0.04)
  osc.connect(g)
  osc.start(t)
  osc.stop(t + 0.05)
}

function noiseHit(ctx: AudioContext, out: AudioNode, t: number, type: BiquadFilterType, freq: number, peak: number, decay: number) {
  const src = ctx.createBufferSource()
  src.buffer = noise(ctx)
  const f = ctx.createBiquadFilter()
  f.type = type
  f.frequency.value = freq
  src.connect(f)
  f.connect(env(ctx, out, t, peak, decay))
  src.start(t)
  src.stop(t + decay + 0.02)
}

/** Simple synthesized kit so you can hear what the pattern should sound like. */
export function drum(ctx: AudioContext, out: AudioNode, t: number, hit: Hit, volume: number) {
  const v = volume * (hit.accent ? 1 : 0.6)
  switch (hit.limb) {
    case 'RF': {
      const osc = ctx.createOscillator()
      osc.frequency.setValueAtTime(140, t)
      osc.frequency.exponentialRampToValueAtTime(45, t + 0.12)
      osc.connect(env(ctx, out, t, 0.9 * v, 0.25))
      osc.start(t)
      osc.stop(t + 0.3)
      break
    }
    case 'LF':
      noiseHit(ctx, out, t, 'highpass', 7000, 0.35 * v, 0.04)
      break
    case 'RH':
      if (hit.cymbal) noiseHit(ctx, out, t, 'bandpass', 9000, 0.4 * v, 0.25)
      else noiseHit(ctx, out, t, 'bandpass', 2600, 0.5 * v, 0.1)
      break
    case 'LH':
      noiseHit(ctx, out, t, 'bandpass', 1800, 0.55 * v, 0.12)
      break
  }
}
