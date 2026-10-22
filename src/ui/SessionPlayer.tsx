import { useEffect, useRef, useState } from 'react'
import { useApp, getAudio, exerciseTitle, exerciseSubtitle } from '../state'
import { db } from '../db/dexie'
import { exerciseById } from '../generators'
import { Metronome } from '../audio/metronome'
import { MicListener } from '../audio/mic'
import { analyze, matchWindow, nearestOffsetMs } from '../audio/timingAnalysis'
import { newCard, rate } from '../srs/scheduler'
import type { PlanItem } from '../srs/planner'
import type { RatingName, TimingSummary } from '../model/card'
import { HANDS } from '../model/exercise'
import { LimbGrid } from './LimbGrid'
import { TimingStrip } from './TimingStrip'

type Phase = 'ready' | 'playing' | 'rate' | 'done'

const RATINGS: RatingName[] = ['again', 'hard', 'good', 'easy']

interface Props {
  plan: PlanItem[]
  onExit: () => void
}

export function SessionPlayer({ plan, onExit }: Props) {
  const { t, settings, cards, putCard, refresh } = useApp()
  const [queue, setQueue] = useState<PlanItem[]>(plan)
  const [idx, setIdx] = useState(0)
  const [phase, setPhase] = useState<Phase>('ready')
  const [bpm, setBpm] = useState(plan[0]?.bpm ?? 60)
  const [guide, setGuide] = useState(settings.guide)
  const [micOn, setMicOn] = useState(settings.micEnabled)
  const [micError, setMicError] = useState<string | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [pos, setPos] = useState({ n: -1, index: -1, muted: false })
  const [live, setLive] = useState<number[]>([])
  const [timing, setTiming] = useState<TimingSummary | null>(null)
  const [lastResult, setLastResult] = useState<{ title: string; bpm: number } | null>(null)
  const [done, setDone] = useState(0)

  const metro = useRef<Metronome | null>(null)
  const mic = useRef<MicListener | null>(null)
  const onsets = useRef<number[]>([])
  const latency = useRef(0)
  const raf = useRef(0)
  const startedAt = useRef(0)
  const sessionId = useRef<number | null>(null)
  const sessionStart = useRef(Date.now())
  const requeued = useRef(new Set<string>())
  const wakeLock = useRef<WakeLockSentinel | null>(null)

  const item = queue[idx]
  const ex = item ? exerciseById(item.exerciseId)! : null
  const card = item ? cards.get(item.exerciseId) : undefined

  useEffect(() => {
    db.sessions
      .add({ startedAt: sessionStart.current, plannedMinutes: settings.sessionMinutes, itemsDone: 0 })
      .then((id) => (sessionId.current = id))
    return () => stopAll()
  }, [])

  function stopAll() {
    cancelAnimationFrame(raf.current)
    metro.current?.stop()
    mic.current?.stop()
    wakeLock.current?.release().catch(() => {})
    wakeLock.current = null
  }

  /** Hide the grid in recall mode, and after two loops on cards you already play cleanly. */
  const hideAfterLoops =
    item?.mode === 'recall' ? 0 : item?.mode === 'review' && (card?.lastRating === 'good' || card?.lastRating === 'easy') ? 2 : null
  const hidden =
    !revealed &&
    phase !== 'rate' &&
    hideAfterLoops !== null &&
    (hideAfterLoops === 0 || (ex !== null && pos.n >= hideAfterLoops * ex.steps.length))

  async function start() {
    if (!ex || !item) return
    const ctx = await getAudio()
    if (!metro.current) metro.current = new Metronome(ctx)
    latency.current =
      settings.latencyMs ?? Math.round(((ctx.outputLatency || 0) + (ctx.baseLatency || 0)) * 1000)
    onsets.current = []
    setLive([])
    setTiming(null)
    setMicError(null)
    if (micOn) {
      try {
        mic.current ??= new MicListener()
        await mic.current.start(ctx, settings.micSensitivity, (o) => {
          const tCorr = o.time - latency.current / 1000
          onsets.current.push(tCorr)
          const m = metro.current!
          const recent = m.scheduled
            .filter((s) => s.n >= 0 && Math.abs(s.time - tCorr) < 0.3 && ex.steps[s.index].some((h) => HANDS.includes(h.limb)))
            .map((s) => s.time)
          const off = nearestOffsetMs(recent, tCorr, matchWindow(m.stepDur))
          if (off !== null) setLive((prev) => [...prev.slice(-23), off])
        })
      } catch (e) {
        setMicError((e as Error).message)
      }
    }
    metro.current.start({
      exercise: ex,
      bpm,
      volume: settings.clickVolume,
      guide: guide && !micOn,
      gap: item.mode === 'gap' ? { play: 1, mute: 1 } : null,
    })
    startedAt.current = ctx.currentTime
    try {
      wakeLock.current = await navigator.wakeLock?.request('screen')
    } catch {
      /* not critical */
    }
    setPhase('playing')
    const loop = () => {
      const p = metro.current!.position()
      setPos({ n: p.n, index: p.n >= 0 ? p.index : -1, muted: p.muted })
      raf.current = requestAnimationFrame(loop)
    }
    loop()
  }

  function stop() {
    const m = metro.current!
    const stopTime = m.ctx.currentTime
    stopAll()
    if (micOn && ex) {
      const expected = m.scheduled
        .filter((s) => s.n >= 0 && s.time <= stopTime - 0.05)
        .filter((s) => ex.steps[s.index].some((h) => HANDS.includes(h.limb)))
        .map((s) => s.time)
      const hits = onsets.current.filter((o) => o >= m.playStart - 0.1)
      if (expected.length >= 4) setTiming(analyze(expected, hits, matchWindow(m.stepDur)).summary)
    }
    setPos({ n: -1, index: -1, muted: false })
    setPhase('rate')
  }

  function changeBpm(delta: number) {
    const v = Math.max(30, Math.min(260, bpm + delta))
    setBpm(v)
    metro.current?.setBpm(v)
  }

  async function onRate(r: RatingName) {
    if (!ex || !item) return
    const now = new Date()
    const durationSec = Math.round(metro.current ? metro.current.ctx.currentTime - startedAt.current : 0)
    const isWarmupOnly = item.mode === 'warmup' && !card
    if (!isWarmupOnly) {
      const updated = rate(card ?? newCard(ex, now), ex, r, bpm, item.mode, now)
      await putCard(updated)
      setLastResult(item.mode === 'warmup' ? null : { title: exerciseTitle(ex, t), bpm: updated.bpm })
      // A breakdown comes back once more at the end of today's session
      if (r === 'again' && item.mode !== 'warmup' && !requeued.current.has(ex.id)) {
        requeued.current.add(ex.id)
        setQueue((q) => [...q, { exerciseId: ex.id, mode: 'review', bpm: updated.bpm }])
      }
    }
    await db.reviews.add({
      cardId: ex.id,
      at: now.getTime(),
      rating: r,
      bpm,
      mode: item.mode,
      durationSec,
      timing: timing ?? undefined,
      sessionId: sessionId.current ?? undefined,
    })
    advance(done + 1)
  }

  function advance(doneCount: number) {
    setDone(doneCount)
    if (sessionId.current) db.sessions.update(sessionId.current, { itemsDone: doneCount, endedAt: Date.now() })
    const next = idx + 1
    if (next >= queue.length) {
      setPhase('done')
      refresh()
      return
    }
    setIdx(next)
    setBpm(queue[next].bpm)
    setRevealed(false)
    setTiming(null)
    setLive([])
    setPhase('ready')
  }

  function endSession() {
    stopAll()
    if (sessionId.current) db.sessions.update(sessionId.current, { itemsDone: done, endedAt: Date.now() })
    refresh()
    onExit()
  }

  if (phase === 'done' || !ex || !item) {
    const minutes = Math.max(1, Math.round((Date.now() - sessionStart.current) / 60000))
    return (
      <div className="screen done-screen">
        <div className="done-mark" aria-hidden>
          ✓
        </div>
        <h1>{t('player.done')}</h1>
        <p className="muted">{t('player.doneBody', { n: done, m: minutes })}</p>
        <button className="btn primary big" onClick={onExit}>
          {t('player.home')}
        </button>
      </div>
    )
  }

  const subtitle = exerciseSubtitle(ex, t)
  const modeHint = t(`mode.${item.mode}.hint` as Parameters<typeof t>[0])

  return (
    <div className="screen player">
      <header className="player-top">
        <button className="btn ghost small" onClick={endSession}>
          ✕ {t('player.end')}
        </button>
        <span className="muted small">{t('player.of', { i: idx + 1, n: queue.length })}</span>
      </header>
      <div className="progress-bar">
        <div style={{ width: `${(idx / queue.length) * 100}%` }} />
      </div>

      <section className="ex-head">
        <span className={`mode-chip mode-${item.mode}`}>{t(`mode.${item.mode}` as Parameters<typeof t>[0])}</span>
        <h2>{exerciseTitle(ex, t)}</h2>
        {subtitle && <p className="subtitle">+ {subtitle}</p>}
        <p className="label mono">{ex.label}</p>
        <p className="muted small">
          {modeHint}
          {ex.bookPage ? ` · 📖 ${t('player.book', { n: ex.bookPage })}` : ''}
        </p>
      </section>

      <section className={`grid-wrap ${pos.muted ? 'muted-bar' : ''}`}>
        {hidden ? (
          <button className="hidden-grid" onClick={() => setRevealed(true)}>
            <span>{t('player.hidden')}</span>
            <span className="btn ghost small">{t('player.reveal')}</span>
          </button>
        ) : (
          <LimbGrid exercise={ex} active={pos.index} />
        )}
        {phase === 'playing' && pos.n < 0 && <div className="overlay-note">{t('player.countIn')}…</div>}
        {pos.muted && <div className="overlay-note">{t('player.silent')}</div>}
      </section>

      {micOn && (phase === 'playing' || phase === 'rate') && (
        <section className="timing">
          <TimingStrip offsets={live} />
          {timing && (
            <p className="small mono">
              {t('player.timing', { mean: timing.meanMs, sd: timing.sdMs, missed: timing.missed, extra: timing.extra })}
            </p>
          )}
          {ex.steps.some((s) => s.some((h) => !HANDS.includes(h.limb))) && (
            <p className="muted small">{t('player.micHands')}</p>
          )}
        </section>
      )}
      {micError && <p className="error small">{t('player.micError', { msg: micError })}</p>}

      <section className="tempo">
        <button className="btn round" onClick={() => changeBpm(-4)} aria-label="-4 BPM">
          −
        </button>
        <div className="bpm">
          <strong>{bpm}</strong>
          <span>{t('player.bpm')}</span>
        </div>
        <button className="btn round" onClick={() => changeBpm(4)} aria-label="+4 BPM">
          +
        </button>
      </section>
      <p className="center muted small">
        {t('player.target', { n: ex.targetBpm })}
        {card?.bestCleanBpm ? ` · ${t('player.best', { n: card.bestCleanBpm })}` : ''}
      </p>

      {phase === 'ready' && (
        <>
          {lastResult && idx > 0 && (
            <p className="center muted small">
              ✓ {lastResult.title}: {t('player.nextTempo', { n: lastResult.bpm })}
            </p>
          )}
          <div className="toggles">
            <label className="toggle">
              <input type="checkbox" checked={guide} onChange={(e) => setGuide(e.target.checked)} disabled={micOn} />
              {t('player.guide')}
            </label>
            <label className="toggle">
              <input type="checkbox" checked={micOn} onChange={(e) => setMicOn(e.target.checked)} />
              {t('player.mic')}
            </label>
          </div>
          <div className="actions">
            <button className="btn ghost" onClick={() => advance(done)}>
              {t('player.skip')}
            </button>
            <button className="btn primary big" onClick={start}>
              ▶ {t('player.start')}
            </button>
          </div>
        </>
      )}

      {phase === 'playing' && (
        <div className="actions">
          <button className="btn primary big" onClick={stop}>
            ■ {t('player.stop')}
          </button>
        </div>
      )}

      {phase === 'rate' && (
        <section className="rating">
          <p className="center">{t('player.rate')}</p>
          <div className="rating-row">
            {RATINGS.map((r) => (
              <button key={r} className={`btn rate rate-${r}`} onClick={() => onRate(r)}>
                <strong>{t(`player.${r}`)}</strong>
                <span>{t(`player.${r}.hint`)}</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
