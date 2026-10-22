import { useEffect, useRef, useState } from 'react'
import { useApp, getAudio } from '../state'
import { MicListener, thresholdLevel } from '../audio/mic'
import { track } from '../telemetry'

const FLOOR_DB = -60

/** 0..1 position on a -60..0 dBFS scale. */
function meterPos(level: number): number {
  const db = 20 * Math.log10(Math.max(level, 1e-6))
  return Math.min(1, Math.max(0, (db - FLOOR_DB) / -FLOOR_DB))
}

/**
 * Live input meter with the hit threshold marked and a counter that flashes
 * on every detected stroke, so sensitivity can be set by ear and eye.
 */
export function MicTest() {
  const { t, settings } = useApp()
  const [running, setRunning] = useState(false)
  const [level, setLevel] = useState(0)
  const [hits, setHits] = useState(0)
  const [flash, setFlash] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mic = useRef<MicListener | null>(null)
  const flashTimer = useRef(0)
  const stats = useRef({ startedAt: 0, hits: 0, levels: [] as number[] })

  // Follow the sensitivity slider live while testing
  useEffect(() => {
    mic.current?.setSensitivity(settings.micSensitivity)
  }, [settings.micSensitivity])

  useEffect(() => () => mic.current?.stop(), [])

  async function start() {
    setError(null)
    setHits(0)
    stats.current = { startedAt: Date.now(), hits: 0, levels: [] }
    try {
      const ctx = await getAudio()
      mic.current ??= new MicListener()
      await mic.current.start(
        ctx,
        settings.micSensitivity,
        (o) => {
          stats.current.hits++
          stats.current.levels.push(Math.round(o.level * 1000) / 1000)
          setHits((n) => n + 1)
          setFlash(true)
          window.clearTimeout(flashTimer.current)
          flashTimer.current = window.setTimeout(() => setFlash(false), 90)
        },
        (peak) => setLevel((prev) => Math.max(peak, prev * 0.85)),
      )
      setRunning(true)
    } catch (e) {
      setError((e as Error).message)
      track('mic_error', { message: (e as Error).message, where: 'mic_test' })
    }
  }

  function stop() {
    mic.current?.stop()
    setRunning(false)
    setLevel(0)
    track('mic_test', {
      seconds: Math.round((Date.now() - stats.current.startedAt) / 1000),
      hits: stats.current.hits,
      onsetLevels: stats.current.levels,
      sensitivity: settings.micSensitivity,
    })
  }

  const threshold = meterPos(thresholdLevel(settings.micSensitivity))

  return (
    <div className="mic-test">
      <strong>{t('set.micTest')}</strong>
      <p className="small muted">{t('set.micTestHint')}</p>
      <div className="mic-meter-row">
        <div className="mic-meter" aria-hidden>
          <div className="mic-meter-fill" style={{ width: `${meterPos(level) * 100}%` }} />
          <div className="mic-meter-threshold" style={{ left: `${threshold * 100}%` }}>
            <span>{t('set.micThreshold')}</span>
          </div>
        </div>
        <span className={`mic-hits ${flash ? 'flash' : ''}`} aria-live="polite">
          {t('set.micHits', { n: hits })}
        </span>
      </div>
      <button className={`btn ${running ? 'primary' : 'ghost'}`} onClick={running ? stop : start}>
        {running ? `■ ${t('set.micTestStop')}` : `▶ ${t('set.micTestStart')}`}
      </button>
      {error && <p className="error small">{t('player.micError', { msg: error })}</p>}
    </div>
  )
}
