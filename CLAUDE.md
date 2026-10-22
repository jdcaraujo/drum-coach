# Drum Coach — project context

Daniel's personal drum practice PWA, used on his Pixel 9 XL with a practice pad (and an e-kit).
Goal: limb independence, rudiments (paradiddles etc.) and timing accuracy, built on learning science.

- Live: https://jdcaraujo.github.io/drum-coach/
- Repo: https://github.com/jdcaraujo/drum-coach — every push to `main` runs tests and deploys to GitHub Pages
  (`.github/workflows/deploy.yml`, built with `BASE=/drum-coach/`)

## Decisions so far

- **PWA**, not native. Data lives only on the phone (IndexedDB via Dexie); no backend, no sync.
- **Feedback**: self-rating (Again/Hard/Good/Easy) + mic onset detection on the pad. MIDI from the e-kit is a
  possible v2 (would give per-limb accuracy); not built.
- **Content is generated**, following the progression of *4-Way Coordination* (Dahlgren & Fine) — the teacher's
  PDF. Exercises show "cf. p. N" book references. Never transcribe or commit the book (copyrighted).
- **Learning design**: FSRS spaced repetition (`ts-fsrs`) + per-exercise tempo ladder, interleaved sessions,
  gap-click (internal clock), from-memory recall, stage gating (unlock-all switch in Settings).
- **UI copy** always in EN + PT (`src/i18n/en.ts`, `pt.ts`).

## Improving from real usage

Daniel exports a JSON from Settings → Export data and shares it. Export v2 contains cards, reviews, sessions,
settings and an `events` log (app opens, screens, settings changes, calibration, session start/end with
reason, skips, tempo changes with timing, reveals, ratings, mic tests, errors). Reviews carry planned vs
started vs played-longest vs stop tempo, played seconds, loops, ready/decide time, and for mic attempts
per-step and per-bar hits/misses/offsets, raw offsets and onset levels.

When given an export: analyse it, say what it shows and what it can't, propose changes, then build them.

### Changelog of usage-driven changes
- 2026-10-22, first export (1 session, quit after 2 of 5 items; Double strokes dropped 60→36 BPM; mic caught
  53% of notes): lowered start tempos (16ths rudiments 40 BPM), warm-up ratings now count, ratings use the
  tempo played longest, mic test with live meter + hide unreliable timing (<80% caught or >20% extra).

## Open questions / ideas
- Mic detection on a real pad is unverified — check the next export's `byStep`, `onsetLevels`, calibration events.
- Why sessions end early (now logged in `session_end.reason`).
- MIDI e-kit input for per-limb scoring.

## Dev

```bash
npm install
npm test
npm run dev
```

Layout: `src/generators` (exercises), `src/srs` (scheduler, planner, gating, tempo), `src/audio` (metronome,
mic, calibration, timing analysis; worklet in `public/onset-processor.js`), `src/ui`, `src/telemetry.ts`.
