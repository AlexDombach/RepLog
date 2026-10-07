# RepLog

A local-first, fully offline workout tracker. Installs to an iPhone home screen,
runs fullscreen, works in airplane mode, and keeps every byte of data on the
device. No backend, no accounts, no cloud, no analytics, no network calls at
runtime.

Built for a two-person apartment gym: dumbbells, kettlebells, benches, a rower,
and a Matrix functional trainer.

---

## Run it

```bash
npm install
npm run dev
```

Then open **http://localhost:5173/RepLog/** (the `/RepLog/` path matters — see
`base` in `vite.config.ts`).

**Live:** <https://alexdombach.github.io/RepLog/> — open that in Safari on the
iPhone and use Share → Add to Home Screen. Full steps in **[DEPLOY.md](DEPLOY.md)**.

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with HMR |
| `npm run build` | Production build into `dist/` |
| `npm run preview -- --host` | Serve `dist/` on the LAN for phone testing |
| `npm run selftest` | 74 assertions over the generator, streaks, XP and PR logic |
| `npm run typecheck` | TypeScript, no emit |
| `npm run icons` | Regenerate the placeholder app icons |
| `npm run build:root` | Build for a host serving from `/` instead of `/RepLog/` |

---

## Stack

- **Vite + React + TypeScript**
- **Tailwind CSS v4** — tokens defined in `src/index.css`, no config file
- **React Router** (`HashRouter`, so deep links work from a static subpath)
- **Dexie.js** over IndexedDB for all persistence
- **vite-plugin-pwa** (Workbox) for the service worker and web manifest

No state-management library — React context plus `dexie-react-hooks`
`useLiveQuery`, which pushes database changes straight into the components.

---

## Layout

```
src/
  db/
    types.ts           Domain model
    index.ts           Dexie schema + idempotent seeding
    seedEquipment.ts   The gym's equipment
    seedExercises.ts   61 exercises with form cues
  lib/
    generator.ts       Workout generation: equipment filter, ordering, variety
    session.ts         Start / finish / discard, XP + PR awarding
    stats.ts           Streaks, volume, PRs, last-time lookup
    xp.ts              Level curve, Epley 1RM
    backup.ts          JSON export / import / clear
    date.ts            Local-time date keys (streaks and the heatmap key off these)
    feedback.ts        Haptics + WebAudio chimes, generated in-browser
  components/          Shell, UI primitives, heatmap, rest timer, pickers
  pages/               Home · Workout · ActiveSession · History · Library · Settings
```

### A few decisions worth knowing

**Dates are local, never UTC.** `dateKey()` produces `YYYY-MM-DD` in the device's
timezone. A UTC key would roll a streak over at the wrong time of day.

**A streak doesn't break until you've missed a full day.** If you trained
yesterday but not yet today, the streak still shows. It only resets once
yesterday *and* today are both empty — so you never watch it zero out at midnight
before you've been to the gym.

**The rest timer runs on wall-clock time**, not an interval counter, so locking
the phone mid-set doesn't desync it.

**Exercises are denormalised into sessions.** A session stores the exercise name
and primary muscle, so editing or deleting a library entry can't corrupt history.

**Seeding is additive.** `initDb()` runs on every start and only inserts seed
rows that don't exist yet, so equipment toggles, renamed profiles and custom
exercises survive an update.

**Deleting a session rolls back its XP** and rebuilds the PR table from what's
left, so the dashboard can't drift.

---

## Data model

Seven Dexie tables: `profiles`, `equipment`, `exercises`, `sessions`, `prs`,
`settings`, `drafts`.

Profiles are fully independent — history, streak, XP, PRs — and share only the
exercise library and the equipment list. Switching is a single tap in the header.

**There is no cloud backup.** Settings → Your data → Export writes a JSON file
that re-imports cleanly on any device. Do it occasionally.

---

## Equipment and the generator

Every exercise declares the equipment it needs. An exercise is offered only if
**all** of it is currently enabled in Settings, so turning off the functional
trainer immediately removes ~20 movements from the generator and the library.

The generator takes target muscles, a size (quick 4 / standard 6 / long 8) and
the active profile's history, then:

1. guarantees at least `ceil(size/3)` compound movements,
2. fills from exercises whose *primary* muscle matches, topping up from ones
   that hit it secondarily,
3. scores each candidate by how long since that profile last trained it, plus a
   little jitter — so repeat generations rotate rather than repeat,
4. orders compounds before isolation.

Everything after that is editable: add, remove, swap, reorder, change set counts.

---

## Icons

`public/icons/*` are generated placeholders — a dumbbell glyph on the app
background, drawn by `scripts/generate-icons.mjs` with no image dependencies.
Replace them with real artwork at the same filenames and sizes whenever you like;
`npm run icons` regenerates the placeholders.
