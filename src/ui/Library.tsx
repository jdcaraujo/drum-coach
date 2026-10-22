import { useState } from 'react'
import { useApp, exerciseTitle, exerciseSubtitle } from '../state'
import { STAGES } from '../model/exercise'
import type { Exercise } from '../model/exercise'
import { newCard, isDue } from '../srs/scheduler'
import type { PlanItem } from '../srs/planner'
import { LimbGrid } from './LimbGrid'

export function Library({ onPractice }: { onPractice: (plan: PlanItem[]) => void }) {
  const { t, exercises, progress, cards, putCard } = useApp()
  const [open, setOpen] = useState<number | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const now = new Date()

  async function togglePin(ex: Exercise) {
    const c = cards.get(ex.id) ?? newCard(ex, now)
    await putCard({ ...c, pinned: !c.pinned })
  }

  return (
    <div className="screen library">
      <h1>{t('lib.title')}</h1>
      <p className="muted small">{t('lib.pinHint')}</p>
      {STAGES.map((family, stage) => {
        const p = progress[stage]
        const list = exercises.filter((e) => e.stage === stage)
        const page = list[0]?.bookPage
        return (
          <section key={family} className={`stage ${p.unlocked ? '' : 'locked'}`}>
            <button className="stage-head" onClick={() => setOpen(open === stage ? null : stage)} aria-expanded={open === stage}>
              <span className="stage-num">{stage + 1}</span>
              <span className="stage-title">
                <strong>{t(`family.${family}`)}</strong>
                <span className="small muted">
                  {p.unlocked
                    ? t('lib.cards', { intro: p.introduced, total: p.total, solid: p.solid })
                    : `🔒 ${t('lib.locked')}`}
                  {page ? ` · 📖 p. ${page}` : ''}
                </span>
              </span>
              <span className="chev">{open === stage ? '▾' : '▸'}</span>
            </button>
            {open === stage && (
              <div className="stage-body">
                {!p.unlocked && <p className="muted small">{t('lib.lockedHint')}</p>}
                <ul className="ex-list">
                  {list.map((ex) => {
                    const c = cards.get(ex.id)
                    const sub = exerciseSubtitle(ex, t)
                    const isOpen = selected === ex.id
                    return (
                      <li key={ex.id} className={isOpen ? 'open' : ''}>
                        <button className="ex-row" onClick={() => setSelected(isOpen ? null : ex.id)}>
                          <span>
                            <strong>{exerciseTitle(ex, t)}</strong>
                            {sub && <span className="small muted"> + {sub}</span>}
                            <span className="mono small muted block">{ex.label}</span>
                          </span>
                          <span className="small right">
                            {c?.pinned && '📌 '}
                            {c ? (
                              <>
                                {c.bestCleanBpm || '–'}/{ex.targetBpm}
                                {isDue(c, now) && <em className="due"> {t('lib.due')}</em>}
                              </>
                            ) : (
                              <span className="muted">{t('lib.notStarted')}</span>
                            )}
                          </span>
                        </button>
                        {isOpen && (
                          <div className="ex-detail">
                            <LimbGrid exercise={ex} />
                            <div className="actions">
                              <button className="btn ghost" onClick={() => togglePin(ex)}>
                                📌 {c?.pinned ? t('lib.unpin') : t('lib.pin')}
                              </button>
                              <button
                                className="btn primary"
                                onClick={() =>
                                  onPractice([{ exerciseId: ex.id, mode: c ? 'review' : 'new', bpm: c?.bpm ?? ex.startBpm }])
                                }
                              >
                                ▶ {t('lib.practice')}
                              </button>
                            </div>
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
