import { useEffect, useState } from 'react'
import { AppProvider, useApp } from './state'
import type { PlanItem } from './srs/planner'
import { Home } from './ui/Home'
import { Library } from './ui/Library'
import { Stats } from './ui/Stats'
import { Settings } from './ui/Settings'
import { SessionPlayer } from './ui/SessionPlayer'
import { installGlobalTracking, track } from './telemetry'

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
  const [session, setSession] = useState<{ plan: PlanItem[]; source: 'today' | 'library' } | null>(null)

  useEffect(() => installGlobalTracking(), [])
  useEffect(() => {
    if (!session) track('screen_view', { screen: tab })
  }, [tab, session])

  if (!ready) return <div className="screen loading">…</div>

  if (session) {
    return <SessionPlayer plan={session.plan} source={session.source} onExit={() => setSession(null)} />
  }

  return (
    <>
      <main>
        {tab === 'today' && <Home onStart={(plan) => setSession({ plan, source: 'today' })} />}
        {tab === 'library' && <Library onPractice={(plan) => setSession({ plan, source: 'library' })} />}
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
