import { useEffect, useState } from 'react'
import { useApp, exerciseTitle } from '../state'
import { db } from '../db/dexie'
import type { ReviewRecord, SessionRecord } from '../model/card'
import { STAGES } from '../model/exercise'
import { exerciseById } from '../generators'
import { minutesByWeek, streak, timingByDay } from './stats'

export function Stats() {
  const { t, cards, progress, version, settings } = useApp()
  const [reviews, setReviews] = useState<ReviewRecord[]>([])
  const [sessions, setSessions] = useState<SessionRecord[]>([])
  const [hover, setHover] = useState<string | null>(null)

  useEffect(() => {
    db.reviews.toArray().then(setReviews)
    db.sessions.toArray().then(setSessions)
  }, [version])

  const weeks = minutesByWeek(reviews, 8)
  const timing = timingByDay(reviews)
  const locale = settings.lang === 'pt' ? 'pt-PT' : 'en-GB'
  const fmtDay = (ms: number) => new Date(ms).toLocaleDateString(locale, { day: 'numeric', month: 'short' })

  const tempos = [...cards.values()]
    .map((c) => ({ c, ex: exerciseById(c.id)! }))
    .filter((x) => x.ex && x.c.bestCleanBpm > 0)
    .sort((a, b) => (b.c.lastPracticedAt ?? 0) - (a.c.lastPracticedAt ?? 0))
    .slice(0, 12)

  return (
    <div className="screen stats">
      <h1>{t('stats.title')}</h1>
      <div className="tiles">
        <div className="tile">
          <strong>{streak(reviews)}</strong>
          <span>{t('stats.streak')}</span>
        </div>
        <div className="tile">
          <strong>{weeks.at(-1)!.minutes}</strong>
          <span>{t('stats.week')}</span>
        </div>
        <div className="tile">
          <strong>{sessions.filter((s) => s.itemsDone > 0).length}</strong>
          <span>{t('stats.total')}</span>
        </div>
      </div>

      {reviews.length === 0 && <p className="muted center">{t('stats.empty')}</p>}

      <section className="card">
        <h3>{t('stats.minutesChart')}</h3>
        <BarChart
          data={weeks.map((w) => ({ key: String(w.start), label: fmtDay(w.start), value: w.minutes }))}
          hover={hover}
          setHover={setHover}
          unit="min"
        />
      </section>

      <section className="card">
        <h3>{t('stats.timingChart')}</h3>
        {timing.length < 2 ? (
          <p className="muted small">{t('stats.timingEmpty')}</p>
        ) : (
          <LineChart
            data={timing.map((d) => ({ key: String(d.at), label: fmtDay(d.at), value: d.ms }))}
            hover={hover}
            setHover={setHover}
            unit="ms"
          />
        )}
      </section>

      <section className="card">
        <h3>{t('stats.stages')}</h3>
        <ul className="meters">
          {progress.map((p) => (
            <li key={p.stage} className={p.unlocked ? '' : 'locked'}>
              <span className="small">
                {p.unlocked ? '' : '🔒 '}
                {t(`family.${STAGES[p.stage]}`)}
              </span>
              <div className="meter" title={`${p.solid}/${p.total}`}>
                <div className="meter-intro" style={{ width: `${(p.introduced / p.total) * 100}%` }} />
                <div className="meter-solid" style={{ width: `${(p.solid / p.total) * 100}%` }} />
              </div>
              <span className="small mono muted">
                {p.solid}/{p.total}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {tempos.length > 0 && (
        <section className="card">
          <h3>{t('stats.tempos')}</h3>
          <ul className="meters">
            {tempos.map(({ c, ex }) => (
              <li key={c.id}>
                <span className="small">
                  {exerciseTitle(ex, t)} <span className="mono muted">{ex.label}</span>
                </span>
                <div className="meter">
                  <div
                    className="meter-solid"
                    style={{ width: `${Math.min(100, (c.bestCleanBpm / ex.targetBpm) * 100)}%` }}
                  />
                </div>
                <span className="small mono muted">
                  {c.bestCleanBpm}/{ex.targetBpm}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

interface Datum {
  key: string
  label: string
  value: number
}

interface ChartProps {
  data: Datum[]
  hover: string | null
  setHover: (k: string | null) => void
  unit: string
}

const W = 320
const H = 140
const PAD = { l: 30, r: 8, t: 12, b: 22 }

function niceMax(v: number): number {
  if (v <= 10) return 10
  const p = 10 ** Math.floor(Math.log10(v))
  return Math.ceil(v / p) * p
}

function Axis({ max, unit }: { max: number; unit: string }) {
  const ticks = [0, max / 2, max]
  const y = (v: number) => PAD.t + (H - PAD.t - PAD.b) * (1 - v / max)
  return (
    <g className="axis">
      {ticks.map((v) => (
        <g key={v}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} className={v === 0 ? 'baseline' : 'gridline'} />
          <text x={PAD.l - 4} y={y(v) + 3} textAnchor="end">
            {Math.round(v)}
          </text>
        </g>
      ))}
      <text x={2} y={PAD.t - 2} className="unit">
        {unit}
      </text>
    </g>
  )
}

function BarChart({ data, hover, setHover, unit }: ChartProps) {
  const max = niceMax(Math.max(...data.map((d) => d.value)))
  const plotW = W - PAD.l - PAD.r
  const slot = plotW / data.length
  const bw = Math.min(24, slot - 6)
  const y = (v: number) => PAD.t + (H - PAD.t - PAD.b) * (1 - v / max)
  const base = y(0)
  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img">
        <Axis max={max} unit={unit} />
        {data.map((d, i) => {
          const x = PAD.l + i * slot + (slot - bw) / 2
          const top = y(d.value)
          const h = base - top
          const r = Math.min(4, h)
          return (
            <g
              key={d.key}
              onPointerEnter={() => setHover(d.key)}
              onPointerLeave={() => setHover(null)}
              onClick={() => setHover(hover === d.key ? null : d.key)}
            >
              <rect x={PAD.l + i * slot} y={PAD.t} width={slot} height={H - PAD.t - PAD.b} fill="transparent" />
              {h > 0 && (
                <path
                  className={`bar ${hover === d.key ? 'hot' : ''}`}
                  d={`M${x},${base} V${top + r} Q${x},${top} ${x + r},${top} H${x + bw - r} Q${x + bw},${top} ${x + bw},${top + r} V${base} Z`}
                />
              )}
              {(i % 2 === 1 || data.length <= 4) && (
                <text x={x + bw / 2} y={H - 6} textAnchor="middle" className="tick">
                  {d.label}
                </text>
              )}
              {hover === d.key && (
                <text x={x + bw / 2} y={Math.max(PAD.t + 8, top - 5)} textAnchor="middle" className="tip-label">
                  {d.value} {unit}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function LineChart({ data, hover, setHover, unit }: ChartProps) {
  const max = niceMax(Math.max(...data.map((d) => d.value)))
  const plotW = W - PAD.l - PAD.r
  const x = (i: number) => PAD.l + (data.length === 1 ? plotW / 2 : (i / (data.length - 1)) * plotW)
  const y = (v: number) => PAD.t + (H - PAD.t - PAD.b) * (1 - v / max)
  const path = data.map((d, i) => `${i ? 'L' : 'M'}${x(i)},${y(d.value)}`).join(' ')
  const hi = data.findIndex((d) => d.key === hover)
  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img">
        <Axis max={max} unit={unit} />
        <path d={path} className="line" />
        {hi >= 0 && <line x1={x(hi)} x2={x(hi)} y1={PAD.t} y2={H - PAD.b} className="crosshair" />}
        {data.map((d, i) => (
          <g
            key={d.key}
            onPointerEnter={() => setHover(d.key)}
            onPointerLeave={() => setHover(null)}
            onClick={() => setHover(hover === d.key ? null : d.key)}
          >
            <rect x={x(i) - plotW / data.length / 2} y={PAD.t} width={plotW / data.length} height={H - PAD.t - PAD.b} fill="transparent" />
            <circle cx={x(i)} cy={y(d.value)} r={hover === d.key ? 5 : 3.5} className="point" />
            {(i === 0 || i === data.length - 1) && (
              <text x={x(i)} y={H - 6} textAnchor={i === 0 ? 'start' : 'end'} className="tick">
                {d.label}
              </text>
            )}
            {hover === d.key && (
              <text x={x(i)} y={Math.max(PAD.t + 8, y(d.value) - 9)} textAnchor="middle" className="tip-label">
                {d.label}: {d.value} {unit}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  )
}
