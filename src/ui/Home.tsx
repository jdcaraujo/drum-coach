import { useEffect, useMemo, useState } from 'react'
import { useApp, exerciseTitle } from '../state'
import { db } from '../db/dexie'
import { planSession } from '../srs/planner'
import { isDue } from '../srs/scheduler'
import type { PlanItem } from '../srs/planner'
import { exerciseById } from '../generators'
import { STAGES } from '../model/exercise'
import { streak } from './stats'

const LENGTHS = [10, 20, 30]

export function Home({ onStart }: { onStart: (plan: PlanItem[]) => void }) {
  const { t, settings, updateSettings, cards, exercises, unlocked, version } = useApp()
  const [minutes, setMinutes] = useState(settings.sessionMinutes)
  const [streakDays, setStreakDays] = useState(0)

  useEffect(() => {
    db.reviews.toArray().then((r) => setStreakDays(streak(r)))
  }, [version])

  const plan = useMemo(
    () =>
      planSession({
        exercises,
        cards,
        now: new Date(),
        minutes,
        newPerSession: minutes <= 10 ? 1 : settings.newPerSession,
        highestUnlocked: unlocked,
      }),
    [exercises, cards, minutes, settings.newPerSession, unlocked],
  )

  const now = new Date()
  const dueCount = [...cards.values()].filter((c) => isDue(c, now)).length
  const newCount = plan.filter((p) => p.mode === 'new').length

  return (
    <div className="screen home">
      <header className="home-head">
        <p className="eyebrow">{t('app.name')}</p>
        <h1>{t('home.greeting')}</h1>
        <p className="streak">
          {streakDays > 0 ? `🔥 ${t('home.streak', { n: streakDays })}` : t('home.noStreak')}
        </p>
      </header>

      <div className="segmented" role="radiogroup">
        {LENGTHS.map((m) => (
          <button
            key={m}
            role="radio"
            aria-checked={minutes === m}
            className={minutes === m ? 'on' : ''}
            onClick={() => {
              setMinutes(m)
              updateSettings({ sessionMinutes: m })
            }}
          >
            {t('home.minutes', { n: m })}
          </button>
        ))}
      </div>

      <p className="muted small center">
        {t('home.items', { n: plan.length })} · {t('home.due', { n: dueCount })} · {t('home.new', { n: newCount })}
      </p>

      <ol className="plan-list">
        {plan.map((p, i) => {
          const ex = exerciseById(p.exerciseId)!
          return (
            <li key={`${p.exerciseId}-${i}`}>
              <span className={`mode-dot mode-${p.mode}`} />
              <div>
                <strong>{exerciseTitle(ex, t)}</strong>
                <span className="mono small muted">{ex.label}</span>
              </div>
              <span className="small muted mono">{p.bpm}</span>
            </li>
          )
        })}
      </ol>

      <button className="btn primary big wide" onClick={() => onStart(plan)}>
        ▶ {t('home.start')}
      </button>

      <p className="muted small center">
        {t('home.stage')}: {t(`family.${STAGES[unlocked]}`)}
      </p>
      <p className="tip small">{t('home.tip')}</p>
    </div>
  )
}
