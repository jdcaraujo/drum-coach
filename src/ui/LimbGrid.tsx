import { limbsUsed, stepsPerBar } from '../model/exercise'
import type { Exercise, Limb } from '../model/exercise'
import { useApp } from '../state'

const COLOR: Record<Limb, string> = {
  RH: 'var(--rh)',
  LH: 'var(--lh)',
  RF: 'var(--rf)',
  LF: 'var(--lf)',
}

/** Counting syllables per subdivision. */
const COUNTS: Record<number, string[]> = {
  2: ['', '&'],
  3: ['', 't', 'l'],
  4: ['', 'e', '&', 'a'],
}

interface Props {
  exercise: Exercise
  /** Index into exercise.steps to highlight, or -1 */
  active?: number
  compact?: boolean
}

/**
 * One row per limb (RH, LH, RF, LF from top), like the book's notation:
 * hands above the dashed line, feet below. Each bar gets its own line.
 */
export function LimbGrid({ exercise: ex, active = -1, compact = false }: Props) {
  const { t } = useApp()
  const rows = limbsUsed(ex)
  const perBar = stepsPerBar(ex)
  const labelW = 30
  const cell = compact ? 18 : 22
  const rowH = compact ? 18 : 26
  const countH = compact ? 0 : 16
  const barGap = compact ? 6 : 12
  const barH = countH + rows.length * rowH
  const width = labelW + perBar * cell
  const height = ex.bars * barH + (ex.bars - 1) * barGap
  const r = compact ? 5 : 7
  const handsRows = rows.filter((l) => l === 'RH' || l === 'LH').length

  return (
    <svg
      className="limb-grid"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={ex.label}
      style={{ maxWidth: compact ? width * 1.2 : undefined }}
    >
      {Array.from({ length: ex.bars }, (_, bar) => {
        const y0 = bar * (barH + barGap)
        const gridTop = y0 + countH
        return (
          <g key={bar}>
            {!compact &&
              Array.from({ length: perBar }, (_, i) => {
                const sub = i % ex.subdivision
                const text = sub === 0 ? String(i / ex.subdivision + 1) : COUNTS[ex.subdivision]?.[sub] ?? ''
                return (
                  <text
                    key={i}
                    x={labelW + i * cell + cell / 2}
                    y={y0 + 11}
                    className={sub === 0 ? 'count beat' : 'count'}
                    textAnchor="middle"
                  >
                    {text}
                  </text>
                )
              })}
            {active >= 0 && Math.floor(active / perBar) === bar && (
              <rect
                className="playhead"
                x={labelW + (active % perBar) * cell}
                y={gridTop}
                width={cell}
                height={rows.length * rowH}
                rx={4}
              />
            )}
            {Array.from({ length: ex.beatsPerBar + 1 }, (_, b) => (
              <line
                key={b}
                className={b === 0 || b === ex.beatsPerBar ? 'barline' : 'beatline'}
                x1={labelW + b * ex.subdivision * cell}
                x2={labelW + b * ex.subdivision * cell}
                y1={gridTop}
                y2={gridTop + rows.length * rowH}
              />
            ))}
            {handsRows > 0 && handsRows < rows.length && (
              <line
                className="divider"
                x1={labelW}
                x2={width}
                y1={gridTop + handsRows * rowH}
                y2={gridTop + handsRows * rowH}
              />
            )}
            {rows.map((limb, ri) => {
              const cy = gridTop + ri * rowH + rowH / 2
              return (
                <g key={limb}>
                  <text x={0} y={cy + 4} className="limb-label" fill={COLOR[limb]}>
                    {t(`limb.${limb}`)}
                  </text>
                  {Array.from({ length: perBar }, (_, i) => {
                    const step = ex.steps[bar * perBar + i]
                    const hit = step.find((h) => h.limb === limb)
                    const cx = labelW + i * cell + cell / 2
                    if (!hit) return <circle key={i} cx={cx} cy={cy} r={1.5} className="rest" />
                    const rr = hit.accent ? r + 1.5 : r
                    if (hit.cymbal) {
                      return (
                        <g key={i} stroke={COLOR[limb]} strokeWidth={compact ? 2 : 2.6} strokeLinecap="round">
                          <line x1={cx - rr * 0.8} y1={cy - rr * 0.8} x2={cx + rr * 0.8} y2={cy + rr * 0.8} />
                          <line x1={cx - rr * 0.8} y1={cy + rr * 0.8} x2={cx + rr * 0.8} y2={cy - rr * 0.8} />
                        </g>
                      )
                    }
                    return (
                      <g key={i}>
                        <circle cx={cx} cy={cy} r={rr} fill={COLOR[limb]} />
                        {hit.accent && (
                          <circle cx={cx} cy={cy} r={rr + 2.5} fill="none" stroke={COLOR[limb]} strokeWidth={1.2} opacity={0.6} />
                        )}
                      </g>
                    )
                  })}
                </g>
              )
            })}
          </g>
        )
      })}
    </svg>
  )
}
