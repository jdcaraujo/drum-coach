export interface Onset {
  /** AudioContext time the hit reached the detector, in seconds */
  time: number
  level: number
}

/** Minimum envelope level (0..1) for a hit at a given sensitivity — mirrors onset-processor.js. */
export function thresholdLevel(sensitivity: number): number {
  return 0.06 * Math.pow(10, -1.5 * sensitivity)
}

/** Listens to the microphone and reports stick hits via an AudioWorklet. */
export class MicListener {
  private stream: MediaStream | null = null
  private node: AudioWorkletNode | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private static loaded = new WeakSet<AudioContext>()

  async start(
    ctx: AudioContext,
    sensitivity: number,
    onOnset: (o: Onset) => void,
    /** Peak input level (0..1) roughly every 50 ms */
    onMeter?: (peak: number) => void,
  ) {
    this.stop()
    if (!MicListener.loaded.has(ctx)) {
      await ctx.audioWorklet.addModule(`${import.meta.env.BASE_URL}onset-processor.js`)
      MicListener.loaded.add(ctx)
    }
    // Raw signal: processing designed for voice smears or swallows drum transients
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    })
    this.source = ctx.createMediaStreamSource(this.stream)
    this.node = new AudioWorkletNode(ctx, 'onset-processor', { numberOfInputs: 1, numberOfOutputs: 0 })
    this.node.port.postMessage({ sensitivity })
    this.node.port.onmessage = (e) => {
      if (typeof e.data.meter === 'number') onMeter?.(e.data.meter)
      else onOnset(e.data as Onset)
    }
    this.source.connect(this.node)
  }

  setSensitivity(sensitivity: number) {
    this.node?.port.postMessage({ sensitivity })
  }

  stop() {
    this.source?.disconnect()
    this.node?.port.close()
    this.stream?.getTracks().forEach((t) => t.stop())
    this.source = null
    this.node = null
    this.stream = null
  }
}
