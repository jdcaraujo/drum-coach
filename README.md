# Drum Coach

A PWA for practising limb independence and rudiments, built around spaced repetition (FSRS),
a per-exercise tempo ladder, interleaved sessions, gap-click timing checks and from-memory recall.
Exercises follow the progression of *4-Way Coordination* (Dahlgren & Fine) and show the matching
book page; the book itself is not reproduced.

## Develop

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # generators, scheduler, planner, timing analysis
npm run build    # outputs dist/
```

Mic access and installing as an app need HTTPS (or localhost).

## Deploy to a sub-path (e.g. GitHub Pages)

```bash
BASE=/drum-coach/ npm run build
```

## Layout

- `src/generators/` — exercise families (rudiments, melodic, two-part, 4-way, ride ostinato)
- `src/srs/` — FSRS + tempo ladder (`scheduler.ts`), daily planner, stage gating
- `src/audio/` — look-ahead metronome, mic onset detection (`public/onset-processor.js`), calibration, timing analysis
- `src/ui/` — screens; `src/i18n/` — EN + PT strings
