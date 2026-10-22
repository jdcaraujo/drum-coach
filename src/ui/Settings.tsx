import { useRef, useState } from 'react'
import { useApp, getAudio } from '../state'
import { exportAll, importAll } from '../db/dexie'
import { calibrate } from '../audio/calibration'
import type { CalibrationMethod } from '../audio/calibration'
import { track, deviceInfo, BUILD } from '../telemetry'

export function Settings() {
  const { t, settings, updateSettings, refresh } = useApp()
  const [calState, setCalState] = useState<{ method: CalibrationMethod; progress: number } | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function runCalibration(method: CalibrationMethod) {
    setMessage(null)
    setCalState({ method, progress: 0 })
    try {
      const ctx = await getAudio()
      const r = await calibrate(ctx, method, settings.micSensitivity, (p) => setCalState({ method, progress: p }))
      track('calibration', {
        method,
        sensitivity: settings.micSensitivity,
        previousMs: settings.latencyMs,
        outputLatencyMs: Math.round((ctx.outputLatency || 0) * 1000),
        ...r,
      })
      if (r.latencyMs !== null) await updateSettings({ latencyMs: r.latencyMs })
      else setMessage(t('set.calFailed'))
    } catch (e) {
      track('calibration', { method, error: (e as Error).message })
      setMessage(t('player.micError', { msg: (e as Error).message }))
    } finally {
      setCalState(null)
    }
  }

  async function doExport() {
    track('export')
    const json = await exportAll({ build: BUILD, device: deviceInfo() })
    const blob = new Blob([json], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `drum-coach-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  async function doImport(file: File) {
    try {
      await importAll(await file.text())
      track('import', { bytes: file.size })
      await refresh()
      setMessage(t('set.imported'))
    } catch (e) {
      setMessage(t('set.importFailed', { msg: (e as Error).message }))
    }
  }

  return (
    <div className="screen settings">
      <h1>{t('set.title')}</h1>

      <section className="card">
        <label className="row">
          <span>{t('set.language')}</span>
          <div className="segmented small">
            {(['en', 'pt'] as const).map((l) => (
              <button key={l} className={settings.lang === l ? 'on' : ''} onClick={() => updateSettings({ lang: l })}>
                {l === 'en' ? 'English' : 'Português'}
              </button>
            ))}
          </div>
        </label>
        <label className="row col">
          <span>
            {t('set.clickVolume')} <span className="muted mono">{Math.round(settings.clickVolume * 100)}%</span>
          </span>
          <input
            type="range"
            min={0.1}
            max={1}
            step={0.05}
            value={settings.clickVolume}
            onChange={(e) => updateSettings({ clickVolume: Number(e.target.value) })}
          />
        </label>
        <label className="row">
          <span>{t('set.guide')}</span>
          <input type="checkbox" checked={settings.guide} onChange={(e) => updateSettings({ guide: e.target.checked })} />
        </label>
        <label className="row">
          <span>{t('set.newPerSession')}</span>
          <select
            value={settings.newPerSession}
            onChange={(e) => updateSettings({ newPerSession: Number(e.target.value) })}
          >
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="row">
          <span>
            {t('set.unlockAll')}
            <span className="block small muted">{t('set.unlockAllHint')}</span>
          </span>
          <input
            type="checkbox"
            checked={settings.unlockAll}
            onChange={(e) => updateSettings({ unlockAll: e.target.checked })}
          />
        </label>
      </section>

      <section className="card">
        <h3>🎙 {t('set.calibration')}</h3>
        <label className="row">
          <span>{t('set.mic')}</span>
          <input
            type="checkbox"
            checked={settings.micEnabled}
            onChange={(e) => updateSettings({ micEnabled: e.target.checked })}
          />
        </label>
        <label className="row col">
          <span>
            {t('set.micSensitivity')} <span className="muted mono">{Math.round(settings.micSensitivity * 100)}%</span>
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={settings.micSensitivity}
            onChange={(e) => updateSettings({ micSensitivity: Number(e.target.value) })}
          />
        </label>
        <p className="small">
          {settings.latencyMs !== null ? t('set.latency', { n: settings.latencyMs }) : t('set.latencyNone')}
        </p>
        <div className="cal-buttons">
          {(['loopback', 'tap'] as const).map((m) => (
            <button key={m} className="btn ghost cal" disabled={!!calState} onClick={() => runCalibration(m)}>
              <strong>{t(m === 'loopback' ? 'set.loopback' : 'set.tap')}</strong>
              <span className="small muted">{t(m === 'loopback' ? 'set.loopbackHint' : 'set.tapHint')}</span>
              {calState?.method === m && (
                <span className="cal-progress">
                  {t('set.calibrating')} <progress value={calState.progress} max={1} />
                </span>
              )}
            </button>
          ))}
        </div>
        <p className="muted small">🎧 {t('set.headphones')}</p>
      </section>

      <section className="card">
        <h3>{t('set.backup')}</h3>
        <p className="muted small">{t('set.exportHint')}</p>
        <div className="actions">
          <button className="btn ghost" onClick={doExport}>
            ⬇ {t('set.export')}
          </button>
          <button className="btn ghost" onClick={() => fileRef.current?.click()}>
            ⬆ {t('set.import')}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            hidden
            onChange={(e) => e.target.files?.[0] && doImport(e.target.files[0])}
          />
        </div>
      </section>

      {message && <p className="notice">{message}</p>}
      <p className="muted small">📖 {t('set.about')}</p>
    </div>
  )
}
