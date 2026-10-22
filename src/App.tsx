import { useState } from 'react'
import { AppProvider, useApp } from './state'
import type { PlanItem } from './srs/planner'
import { Home } from './ui/Home'
import { Library } from './ui/Library'
import { Stats } from './ui/Stats'
import { Settings } from './ui/Settings'
import { SessionPlayer } from './ui/SessionPlayer'

type Tab = 'today' | 'library' | 'stats' | 'settings'

const TABS: Array<{ id: Tab; icon: string }> = [
  { id: 'today', icon: '◉' },
  { id: 'library', icon: '☰' },
  { id: 'stats', icon: '▤' },
  { id: 'settings', icon: '⚙' },
]

function Shell() {
  const { ready, t } = useApp()
  const [tab, setTab] = useState<Tab>('today')
  const [session, setSession] = useState<PlanItem[] | null>(null)

  if (!ready) return <div className="screen loading">…</div>

  if (session) {
    return <SessionPlayer key={session.map((p) => p.exerciseId).join()} plan={session} onExit={() => setSession(null)} />
  }

  return (
    <>
      <main>
        {tab === 'today' && <Home onStart={setSession} />}
        {tab === 'library' && <Library onPractice={setSession} />}
        {tab === 'stats' && <Stats />}
        {tab === 'settings' && <Settings />}
      </main>
      <nav className="tabbar">
        {TABS.map((x) => (
          <button key={x.id} className={tab === x.id ? 'on' : ''} onClick={() => setTab(x.id)}>
            <span aria-hidden>{x.icon}</span>
            {t(`nav.${x.id}`)}
          </button>
        ))}
      </nav>
    </>
  )
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  )
}
