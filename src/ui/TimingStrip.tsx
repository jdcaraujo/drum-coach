import { useApp } from '../state'

/** Live early/late dots: centre line is the click, left is early, right is late. */
export function TimingStrip({ offsets }: { offsets: number[] }) {
  const { t } = useApp()
  const range = 60 // ms each side
  const x = (ms: number) => 50 + (Math.max(-range, Math.min(range, ms)) / range) * 46
  return (
    <div className="timing-strip">
      <svg viewBox="0 0 100 18" preserveAspectRatio="none" aria-hidden>
        <rect x={50 - (10 / range) * 46} y={2} width={(20 / range) * 46} height={14} className="ok-zone" />
        <line x1={50} x2={50} y1={0} y2={18} className="centre" />
        {offsets.map((o, i) => (
          <circle
            key={i}
            cx={x(o)}
            cy={9}
            r={1.8}
            className={Math.abs(o) <= 10 ? 'dot ok' : Math.abs(o) <= 25 ? 'dot warn' : 'dot bad'}
            opacity={0.25 + (0.75 * (i + 1)) / offsets.length}
          />
        ))}
      </svg>
      <div className="timing-legend small muted">
        <span>← {t('player.early')}</span>
        <span>{t('player.onTime')}</span>
        <span>{t('player.late')} →</span>
      </div>
    </div>
  )
}
