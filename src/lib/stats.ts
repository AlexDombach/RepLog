import type { MuscleGroup, PersonalRecord, Session } from '../db/types'
import { dateKey, daysBetween, startOfWeek } from './date'
import { epley } from './xp'

/** Unique 'YYYY-MM-DD' keys of completed sessions, ascending. */
export function workoutDays(sessions: Session[]): string[] {
  const set = new Set<string>()
  for (const s of sessions) if (s.status === 'complete') set.add(s.dateKey)
  return [...set].sort()
}

/**
 * Consecutive-day streak, counted backwards from today.
 * Today not yet worked out does NOT break the streak — yesterday still counts,
 * so you don't watch it reset at midnight before you've been to the gym.
 */
export function currentStreak(days: string[]): number {
  if (days.length === 0) return 0
  const today = dateKey()
  const set = new Set(days)
  const last = days[days.length - 1]
  const gap = daysBetween(last, today)
  if (gap > 1) return 0 // missed yesterday and today → broken

  let streak = 0
  // Walk back from the most recent workout day.
  for (let i = 0; ; i++) {
    const d = new Date()
    d.setDate(d.getDate() - (gap === 1 ? i + 1 : i))
    if (set.has(dateKey(d))) streak++
    else break
  }
  return streak
}

/** Longest consecutive-day run ever. */
export function longestStreak(days: string[]): number {
  let best = 0
  let run = 0
  let prev: string | null = null
  for (const d of days) {
    run = prev && daysBetween(prev, d) === 1 ? run + 1 : 1
    if (run > best) best = run
    prev = d
  }
  return best
}

/** Completed sessions in the current Monday-start week. */
export function sessionsThisWeek(sessions: Session[]): Session[] {
  const from = startOfWeek().getTime()
  return sessions.filter((s) => s.status === 'complete' && s.startedAt >= from)
}

export function completedSetCount(session: Session): number {
  return session.exercises.reduce(
    (n, e) => n + e.sets.filter((s) => s.done).length,
    0,
  )
}

export function sessionVolume(session: Session): number {
  return session.exercises.reduce(
    (v, e) => v + e.sets.reduce((x, s) => x + (s.done ? s.weight * s.reps : 0), 0),
    0,
  )
}

/** Completed sets per muscle group. Secondary muscles are not counted. */
export function volumeByMuscle(sessions: Session[]): Record<MuscleGroup, number> {
  const out = {} as Record<MuscleGroup, number>
  for (const s of sessions) {
    for (const e of s.exercises) {
      const n = e.sets.filter((x) => x.done).length
      if (n) out[e.primaryMuscle] = (out[e.primaryMuscle] ?? 0) + n
    }
  }
  return out
}

/** How many days ago this profile last trained a given exercise (Infinity = never). */
export function daysSinceExercise(
  sessions: Session[],
  exerciseId: string,
): number {
  let latest = -Infinity
  for (const s of sessions) {
    if (s.status !== 'complete') continue
    if (s.exercises.some((e) => e.exerciseId === exerciseId)) {
      latest = Math.max(latest, s.startedAt)
    }
  }
  if (latest === -Infinity) return Infinity
  return (Date.now() - latest) / 86_400_000
}

export interface LastPerformance {
  sets: number
  reps: number
  weight: number
  at: number
}

/** The most recent completed performance of an exercise — used to pre-fill sets. */
export function lastPerformance(
  sessions: Session[],
  exerciseId: string,
): LastPerformance | null {
  const ordered = [...sessions]
    .filter((s) => s.status === 'complete')
    .sort((a, b) => b.startedAt - a.startedAt)
  for (const s of ordered) {
    const e = s.exercises.find((x) => x.exerciseId === exerciseId)
    if (!e) continue
    const done = e.sets.filter((x) => x.done)
    if (!done.length) continue
    // Report the heaviest working set — that's the number worth beating.
    const top = done.reduce((a, b) => (b.weight > a.weight ? b : a))
    return { sets: done.length, reps: top.reps, weight: top.weight, at: s.startedAt }
  }
  return null
}

export interface PrCandidate {
  exerciseId: string
  bestWeight: number
  bestReps: number
  bestE1rm: number
  bestVolume: number
}

/** Best marks an exercise hit inside one session. */
export function sessionBests(session: Session): PrCandidate[] {
  return session.exercises
    .map((e) => {
      const done = e.sets.filter((s) => s.done)
      if (!done.length) return null
      return {
        exerciseId: e.exerciseId,
        bestWeight: Math.max(...done.map((s) => s.weight)),
        bestReps: Math.max(...done.map((s) => s.reps)),
        bestE1rm: Math.max(...done.map((s) => epley(s.weight, s.reps))),
        bestVolume: Math.max(...done.map((s) => s.weight * s.reps)),
      }
    })
    .filter((x): x is PrCandidate => x !== null)
}

/**
 * Merge a session's bests into the stored PRs.
 * Returns the rows to write and which exercises actually set a new record.
 */
export function applyPrs(
  profileId: string,
  existing: Map<string, PersonalRecord>,
  bests: PrCandidate[],
): { rows: PersonalRecord[]; newPrs: string[] } {
  const rows: PersonalRecord[] = []
  const newPrs: string[] = []
  for (const b of bests) {
    const id = `${profileId}:${b.exerciseId}`
    const prev = existing.get(id)
    const next: PersonalRecord = {
      id,
      profileId,
      exerciseId: b.exerciseId,
      bestWeight: Math.max(prev?.bestWeight ?? 0, b.bestWeight),
      bestReps: Math.max(prev?.bestReps ?? 0, b.bestReps),
      bestE1rm: Math.max(prev?.bestE1rm ?? 0, b.bestE1rm),
      bestVolume: Math.max(prev?.bestVolume ?? 0, b.bestVolume),
      updatedAt: Date.now(),
    }
    // A "PR moment" means a heavier top set or a better estimated 1RM —
    // not merely doing the exercise for the first time with bodyweight.
    const improved =
      (prev === undefined && (b.bestWeight > 0 || b.bestReps > 0)) ||
      (prev !== undefined &&
        (next.bestWeight > prev.bestWeight ||
          next.bestE1rm > prev.bestE1rm + 0.01 ||
          (b.bestWeight === 0 && next.bestReps > prev.bestReps)))
    if (improved) newPrs.push(b.exerciseId)
    rows.push(next)
  }
  return { rows, newPrs }
}

/** Heatmap buckets: 0 none, 1 light, 2 solid, 3 big. Based on completed sets. */
export function intensityForDay(sessions: Session[]): 0 | 1 | 2 | 3 {
  const sets = sessions.reduce((n, s) => n + completedSetCount(s), 0)
  if (sets === 0) return 0
  if (sets < 9) return 1
  if (sets < 18) return 2
  return 3
}
