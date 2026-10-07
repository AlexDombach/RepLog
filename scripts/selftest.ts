/**
 * Logic self-test for the pure (non-Dexie) parts of RepLog.
 * Run: npm run selftest
 */
import { SEED_EXERCISES } from '../src/db/seedExercises'
import { SEED_EQUIPMENT, EQ } from '../src/db/seedEquipment'
import { generateWorkout, poolFor, enabledEquipmentIds, isAvailable } from '../src/lib/generator'
import {
  currentStreak,
  longestStreak,
  workoutDays,
  applyPrs,
  sessionBests,
  lastPerformance,
  volumeByMuscle,
} from '../src/lib/stats'
import { epley, levelFromXp, xpForLevel, levelProgress, sessionXp } from '../src/lib/xp'
import { dateKey, daysBetween } from '../src/lib/date'
import type { Equipment, PersonalRecord, Session } from '../src/db/types'

let failures = 0
function check(name: string, cond: boolean, detail = '') {
  if (cond) {
    console.log(`  ok   ${name}`)
  } else {
    failures++
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`)
  }
}
function group(name: string) {
  console.log(`\n${name}`)
}

const EQUIPMENT: Equipment[] = SEED_EQUIPMENT.map((e) => ({ ...e }))

function daysAgoKey(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return dateKey(d)
}
function daysAgoMs(n: number): number {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.getTime()
}

function makeSession(opts: {
  daysAgo: number
  exercises: Array<{ id: string; muscle?: string; sets: Array<[number, number]> }>
}): Session {
  return {
    id: `s${opts.daysAgo}-${Math.random()}`,
    profileId: 'p1',
    startedAt: daysAgoMs(opts.daysAgo),
    finishedAt: daysAgoMs(opts.daysAgo),
    dateKey: daysAgoKey(opts.daysAgo),
    title: 'Test',
    status: 'complete',
    units: 'lb',
    xpAwarded: 0,
    prs: [],
    exercises: opts.exercises.map((e) => ({
      exerciseId: e.id,
      name: e.id,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      primaryMuscle: (e.muscle ?? 'biceps') as any,
      targetSets: e.sets.length,
      repRange: [8, 12],
      sets: e.sets.map(([reps, weight]) => ({ reps, weight, done: true })),
    })),
  }
}

/* ------------------------------------------------------------ library */

group('Exercise library')
check('has 40-70 exercises', SEED_EXERCISES.length >= 40 && SEED_EXERCISES.length <= 70, `${SEED_EXERCISES.length}`)
check('all ids unique', new Set(SEED_EXERCISES.map((e) => e.id)).size === SEED_EXERCISES.length)
check('all names unique', new Set(SEED_EXERCISES.map((e) => e.name)).size === SEED_EXERCISES.length)

const eqIds = new Set(SEED_EQUIPMENT.map((e) => e.id))
const badEq = SEED_EXERCISES.filter((e) => e.equipment.some((id) => !eqIds.has(id)))
check('every exercise references real equipment', badEq.length === 0, badEq.map((e) => e.id).join(','))

const noEq = SEED_EXERCISES.filter((e) => e.equipment.length === 0)
check('every exercise names its equipment', noEq.length === 0, noEq.map((e) => e.id).join(','))

const badRange = SEED_EXERCISES.filter((e) => e.repRange[0] > e.repRange[1] || e.repRange[0] < 1)
check('rep ranges are sane', badRange.length === 0, badRange.map((e) => e.id).join(','))

const shortCue = SEED_EXERCISES.filter((e) => e.instructions.trim().length < 40)
check('every exercise has real instructions', shortCue.length === 0, shortCue.map((e) => e.id).join(','))

const MUSCLES = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'legs', 'glutes', 'core', 'fullBody']
for (const m of MUSCLES) {
  const n = SEED_EXERCISES.filter((e) => e.primaryMuscle === m).length
  check(`covers ${m} (${n})`, n >= 2, `only ${n}`)
}

/* ------------------------------------------------- seed workout exists */

group('Seeded Biceps & Shoulders workout')
const SEED_WORKOUT_IDS = [
  'db-shoulder-press',
  'cable-lateral-raise',
  'cable-face-pull',
  'db-bicep-curl',
  'cable-bicep-curl',
  'db-hammer-curl',
]
for (const id of SEED_WORKOUT_IDS) {
  const ex = SEED_EXERCISES.find((e) => e.id === id)
  check(`${id} is in the library`, !!ex)
  if (ex) {
    check(
      `${id} runs on seeded equipment`,
      isAvailable(ex, enabledEquipmentIds(EQUIPMENT)),
      ex.equipment.join(','),
    )
  }
}

/* --------------------------------------------------------- generator */

group('Generator — equipment filtering')
{
  // Turn off the cable trainer; nothing requiring it may appear.
  const noCable = EQUIPMENT.map((e) => (e.id === EQ.cable ? { ...e, enabled: false } : e))
  let leaked = 0
  for (let i = 0; i < 40; i++) {
    const w = generateWorkout({
      muscles: ['biceps', 'shoulders'],
      size: 'long',
      exercises: SEED_EXERCISES,
      equipment: noCable,
      history: [],
      seed: i + 1,
    })
    for (const item of w) {
      const ex = SEED_EXERCISES.find((e) => e.id === item.exerciseId)!
      if (ex.equipment.includes(EQ.cable)) leaked++
    }
  }
  check('never returns cable work when the cable is off', leaked === 0, `${leaked} leaks`)

  // Only bodyweight enabled.
  const bwOnly = EQUIPMENT.map((e) => ({ ...e, enabled: e.id === EQ.bodyweight }))
  const bw = generateWorkout({
    muscles: [],
    size: 'standard',
    exercises: SEED_EXERCISES,
    equipment: bwOnly,
    history: [],
    seed: 7,
  })
  const bwOk = bw.every((i) => {
    const ex = SEED_EXERCISES.find((e) => e.id === i.exerciseId)!
    return ex.equipment.every((q) => q === EQ.bodyweight)
  })
  check('bodyweight-only gym yields bodyweight-only work', bwOk && bw.length > 0, `${bw.length} items`)
}

group('Generator — size, ordering, variety')
{
  for (const [size, want] of [['quick', 4], ['standard', 6], ['long', 8]] as const) {
    const w = generateWorkout({
      muscles: ['legs', 'glutes'],
      size,
      exercises: SEED_EXERCISES,
      equipment: EQUIPMENT,
      history: [],
      seed: 3,
    })
    check(`${size} returns ${want} exercises`, w.length === want, `got ${w.length}`)
  }

  const w = generateWorkout({
    muscles: ['back', 'biceps'],
    size: 'long',
    exercises: SEED_EXERCISES,
    equipment: EQUIPMENT,
    history: [],
    seed: 11,
  })
  const compoundFlags = w.map((i) => SEED_EXERCISES.find((e) => e.id === i.exerciseId)!.compound)
  const firstIso = compoundFlags.indexOf(false)
  const lastComp = compoundFlags.lastIndexOf(true)
  check(
    'compounds are ordered before isolation',
    firstIso === -1 || lastComp === -1 || lastComp < firstIso,
    compoundFlags.join(','),
  )
  check('includes at least one compound', compoundFlags.some(Boolean))
  check('no duplicate exercises in one workout', new Set(w.map((i) => i.exerciseId)).size === w.length)

  const onTarget = w.filter((i) => {
    const ex = SEED_EXERCISES.find((e) => e.id === i.exerciseId)!
    return ex.primaryMuscle === 'back' || ex.primaryMuscle === 'biceps'
  })
  check('selections hit the requested muscles', onTarget.length >= w.length - 1, `${onTarget.length}/${w.length}`)

  // Variety: different seeds should not always give the identical set.
  const sets = new Set<string>()
  for (let i = 0; i < 25; i++) {
    const g = generateWorkout({
      muscles: ['shoulders'],
      size: 'quick',
      exercises: SEED_EXERCISES,
      equipment: EQUIPMENT,
      history: [],
      seed: i * 97 + 1,
    })
    sets.add(g.map((x) => x.exerciseId).sort().join('|'))
  }
  check('varies across runs', sets.size >= 3, `${sets.size} distinct workouts in 25 runs`)
}

group('Generator — avoids recently trained movements')
{
  // Train three shoulder movements today; a fresh generation should prefer others.
  const recent = ['db-lateral-raise', 'cable-lateral-raise', 'db-shrug']
  const history = [makeSession({ daysAgo: 0, exercises: recent.map((id) => ({ id, sets: [[10, 20]] })) })]
  let repeats = 0
  const runs = 30
  for (let i = 0; i < runs; i++) {
    const g = generateWorkout({
      muscles: ['shoulders'],
      size: 'quick',
      exercises: SEED_EXERCISES,
      equipment: EQUIPMENT,
      history,
      seed: i * 31 + 5,
    })
    repeats += g.filter((x) => recent.includes(x.exerciseId)).length
  }
  const pool = poolFor(SEED_EXERCISES, EQUIPMENT, ['shoulders']).primary.length
  // Without recency weighting you'd expect ~ (3/pool)*4 per run.
  const naive = (3 / pool) * 4 * runs
  check(
    'recently-done exercises are picked less often',
    repeats < naive,
    `${repeats} picks vs ~${naive.toFixed(1)} expected at random (pool ${pool})`,
  )
}

/* ------------------------------------------------------------ streaks */

group('Streaks')
check('empty history = 0', currentStreak([]) === 0)
check('today only = 1', currentStreak([daysAgoKey(0)]) === 1)
check(
  'today + yesterday + 2 days ago = 3',
  currentStreak([daysAgoKey(2), daysAgoKey(1), daysAgoKey(0)]) === 3,
)
check(
  "yesterday only still counts (today isn't over)",
  currentStreak([daysAgoKey(1)]) === 1,
)
check(
  'gap of two days breaks it',
  currentStreak([daysAgoKey(5), daysAgoKey(4)]) === 0,
  String(currentStreak([daysAgoKey(5), daysAgoKey(4)])),
)
check(
  'a gap mid-history does not inflate the current streak',
  currentStreak([daysAgoKey(9), daysAgoKey(8), daysAgoKey(7), daysAgoKey(1), daysAgoKey(0)]) === 2,
)
check(
  'longest streak finds the best run',
  longestStreak([daysAgoKey(9), daysAgoKey(8), daysAgoKey(7), daysAgoKey(1), daysAgoKey(0)].sort()) === 3,
)
check(
  'two sessions on one day count as one day',
  workoutDays([
    makeSession({ daysAgo: 0, exercises: [{ id: 'a', sets: [[10, 10]] }] }),
    makeSession({ daysAgo: 0, exercises: [{ id: 'b', sets: [[10, 10]] }] }),
  ]).length === 1,
)
check('daysBetween is signed and whole', daysBetween(daysAgoKey(3), daysAgoKey(0)) === 3)

/* ----------------------------------------------------------- XP/level */

group('XP and levels')
check('level 1 starts at 0 XP', levelFromXp(0) === 1 && xpForLevel(1) === 0)
check('100 XP reaches level 2', levelFromXp(100) === 2, String(levelFromXp(100)))
check('99 XP is still level 1', levelFromXp(99) === 1)
check('level boundaries are exact', [1, 2, 3, 4, 5, 10, 20, 50].every((l) => levelFromXp(xpForLevel(l)) === l))
check('level is monotonic', (() => {
  let prev = 1
  for (let xp = 0; xp < 60_000; xp += 37) {
    const l = levelFromXp(xp)
    if (l < prev) return false
    prev = l
  }
  return true
})())
{
  const p = levelProgress(150)
  check('progress sums correctly', p.level === 2 && p.into + p.toNext === p.span, JSON.stringify(p))
  check('progress pct in range', p.pct >= 0 && p.pct <= 1)
}
check(
  'session XP rewards sets, PRs and streaks',
  sessionXp({ completedSets: 18, prCount: 2, streakDays: 5 }) >
    sessionXp({ completedSets: 18, prCount: 0, streakDays: 1 }),
)
check('streak bonus is capped', sessionXp({ completedSets: 0, prCount: 0, streakDays: 999 }) ===
  sessionXp({ completedSets: 0, prCount: 0, streakDays: 16 }))

/* --------------------------------------------------------------- PRs */

group('Personal records')
check('Epley 100x10 = 133.3', Math.abs(epley(100, 10) - 133.333) < 0.01)
check('Epley ignores bodyweight', epley(0, 20) === 0)
{
  const s1 = makeSession({ daysAgo: 2, exercises: [{ id: 'db-bicep-curl', sets: [[10, 25], [10, 25], [8, 30]] }] })
  const acc = new Map<string, PersonalRecord>()
  const r1 = applyPrs('p1', acc, sessionBests(s1))
  for (const r of r1.rows) acc.set(r.id, r)
  check('first session sets a PR', r1.newPrs.includes('db-bicep-curl'))
  check('best weight captured', acc.get('p1:db-bicep-curl')!.bestWeight === 30)

  // Same weights again — no new PR.
  const s2 = makeSession({ daysAgo: 1, exercises: [{ id: 'db-bicep-curl', sets: [[8, 30]] }] })
  const r2 = applyPrs('p1', acc, sessionBests(s2))
  check('repeating the same top set is not a PR', r2.newPrs.length === 0, r2.newPrs.join(','))

  // More reps at the same weight — better e1RM, so a PR.
  const s3 = makeSession({ daysAgo: 0, exercises: [{ id: 'db-bicep-curl', sets: [[11, 30]] }] })
  const r3 = applyPrs('p1', acc, sessionBests(s3))
  check('more reps at the same weight is a PR', r3.newPrs.includes('db-bicep-curl'))
  for (const r of r3.rows) acc.set(r.id, r)
  check('bests only ever go up', acc.get('p1:db-bicep-curl')!.bestWeight === 30 &&
    acc.get('p1:db-bicep-curl')!.bestReps === 11)

  // Bodyweight progression by reps.
  const bw = new Map<string, PersonalRecord>()
  const b1 = applyPrs('p1', bw, sessionBests(makeSession({ daysAgo: 1, exercises: [{ id: 'push-up', sets: [[15, 0]] }] })))
  for (const r of b1.rows) bw.set(r.id, r)
  const b2 = applyPrs('p1', bw, sessionBests(makeSession({ daysAgo: 0, exercises: [{ id: 'push-up', sets: [[18, 0]] }] })))
  check('bodyweight PR tracked by reps', b2.newPrs.includes('push-up'))
  const b3 = applyPrs('p1', new Map(b2.rows.map((r) => [r.id, r])), sessionBests(
    makeSession({ daysAgo: 0, exercises: [{ id: 'push-up', sets: [[12, 0]] }] }),
  ))
  check('fewer bodyweight reps is not a PR', b3.newPrs.length === 0)
}

/* ------------------------------------------------------- last-time fill */

group('Pre-fill from last time')
{
  const history = [
    makeSession({ daysAgo: 7, exercises: [{ id: 'db-bicep-curl', sets: [[10, 20]] }] }),
    makeSession({ daysAgo: 2, exercises: [{ id: 'db-bicep-curl', sets: [[10, 25], [9, 25], [8, 30]] }] }),
  ]
  const last = lastPerformance(history, 'db-bicep-curl')
  check('uses the most recent session', last?.weight === 30, JSON.stringify(last))
  check('reports the completed set count', last?.sets === 3)
  check('unknown exercise returns null', lastPerformance(history, 'nope') === null)
  check(
    'ignores sets that were never marked done',
    lastPerformance(
      [
        {
          ...makeSession({ daysAgo: 0, exercises: [{ id: 'x', sets: [[10, 50]] }] }),
          exercises: [
            {
              exerciseId: 'x',
              name: 'x',
              primaryMuscle: 'biceps',
              targetSets: 1,
              repRange: [8, 12],
              sets: [{ reps: 10, weight: 50, done: false }],
            },
          ],
        } as Session,
      ],
      'x',
    ) === null,
  )
}

/* ------------------------------------------------------------- volume */

group('Weekly volume')
{
  const v = volumeByMuscle([
    makeSession({ daysAgo: 0, exercises: [
      { id: 'a', muscle: 'biceps', sets: [[10, 20], [10, 20], [10, 20]] },
      { id: 'b', muscle: 'shoulders', sets: [[12, 15], [12, 15]] },
    ] }),
    makeSession({ daysAgo: 1, exercises: [{ id: 'c', muscle: 'biceps', sets: [[10, 20]] }] }),
  ])
  check('counts sets per primary muscle', v.biceps === 4 && v.shoulders === 2, JSON.stringify(v))
}

/* --------------------------------------------------------------- done */

console.log(`\n${failures === 0 ? 'ALL PASSED' : `${failures} FAILURE(S)`}`)
process.exit(failures === 0 ? 0 : 1)
