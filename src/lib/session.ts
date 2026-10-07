import { db, uid } from '../db'
import type {
  Exercise,
  LoggedSet,
  PersonalRecord,
  Profile,
  Session,
  SessionExercise,
} from '../db/types'
import { dateKey } from './date'
import {
  applyPrs,
  completedSetCount,
  currentStreak,
  lastPerformance,
  sessionBests,
  workoutDays,
} from './stats'
import { levelFromXp, sessionXp } from './xp'

export interface PlanItem {
  exerciseId: string
  targetSets: number
  repRange: [number, number]
}

/** Build the blank set rows for an exercise, pre-filled from last time. */
export function buildSets(
  ex: Exercise,
  targetSets: number,
  history: Session[],
): LoggedSet[] {
  const last = lastPerformance(history, ex.id)
  const reps = last?.reps ?? ex.repRange[0]
  const weight = last?.weight ?? 0
  return Array.from({ length: targetSets }, () =>
    ex.type === 'cardio'
      ? { reps: 0, weight: 0, done: false, seconds: ex.repRange[0] * 60 }
      : { reps, weight, done: false },
  )
}

/** Turn a plan into a live session row and persist it. */
export async function startSession(
  profile: Profile,
  title: string,
  plan: PlanItem[],
  exercises: Exercise[],
): Promise<Session> {
  const byId = new Map(exercises.map((e) => [e.id, e]))
  const history = await db.sessions.where({ profileId: profile.id }).toArray()

  const sessionExercises: SessionExercise[] = plan
    .map((item) => {
      const ex = byId.get(item.exerciseId)
      if (!ex) return null
      return {
        exerciseId: ex.id,
        name: ex.name,
        primaryMuscle: ex.primaryMuscle,
        targetSets: item.targetSets,
        repRange: item.repRange,
        sets: buildSets(ex, item.targetSets, history),
      }
    })
    .filter((x): x is SessionExercise => x !== null)

  const session: Session = {
    id: uid('s'),
    profileId: profile.id,
    startedAt: Date.now(),
    dateKey: dateKey(),
    title,
    status: 'active',
    exercises: sessionExercises,
    xpAwarded: 0,
    prs: [],
    units: profile.units,
  }
  await db.sessions.add(session)
  return session
}

export interface FinishResult {
  session: Session
  xpGained: number
  newPrs: string[]
  levelBefore: number
  levelAfter: number
}

/**
 * Finish a session: drop empty sets, award XP, update PRs and the profile.
 * Safe to call once — a session already marked complete is returned unchanged.
 */
export async function finishSession(sessionId: string): Promise<FinishResult | null> {
  return db.transaction('rw', [db.sessions, db.profiles, db.prs], async () => {
    const session = await db.sessions.get(sessionId)
    if (!session || session.status === 'complete') return null

    const profile = await db.profiles.get(session.profileId)
    if (!profile) return null

    // Keep only exercises that actually had a completed set.
    const exercises = session.exercises
      .map((e) => ({ ...e, sets: e.sets.filter((s) => s.done) }))
      .filter((e) => e.sets.length > 0)

    const finished: Session = {
      ...session,
      exercises,
      status: 'complete',
      finishedAt: Date.now(),
      dateKey: dateKey(), // credit the day it was FINISHED
    }

    // Streak as of today, counting this session.
    const all = await db.sessions.where({ profileId: profile.id }).toArray()
    const days = workoutDays([...all.filter((s) => s.id !== session.id), finished])
    const streak = currentStreak(days)

    // PRs
    const existingRows = await db.prs.where({ profileId: profile.id }).toArray()
    const existing = new Map(existingRows.map((r) => [r.id, r]))
    const { rows, newPrs } = applyPrs(profile.id, existing, sessionBests(finished))

    const xpGained = sessionXp({
      completedSets: completedSetCount(finished),
      prCount: newPrs.length,
      streakDays: streak,
    })

    finished.xpAwarded = xpGained
    finished.prs = newPrs

    await db.sessions.put(finished)
    if (rows.length) await db.prs.bulkPut(rows)
    const levelBefore = levelFromXp(profile.xp)
    const nextXp = profile.xp + xpGained
    await db.profiles.update(profile.id, { xp: nextXp })

    return {
      session: finished,
      xpGained,
      newPrs,
      levelBefore,
      levelAfter: levelFromXp(nextXp),
    }
  })
}

/** Abandon an in-progress session without saving it to history. */
export async function discardSession(sessionId: string): Promise<void> {
  await db.sessions.delete(sessionId)
}

/** Recompute every PR row for a profile from scratch (used after import). */
export async function rebuildPrs(profileId: string): Promise<void> {
  const sessions = (await db.sessions.where({ profileId }).toArray())
    .filter((s) => s.status === 'complete')
    .sort((a, b) => a.startedAt - b.startedAt)

  const acc = new Map<string, PersonalRecord>()
  for (const s of sessions) {
    const { rows } = applyPrs(profileId, acc, sessionBests(s))
    for (const r of rows) acc.set(r.id, r)
  }
  await db.prs.where({ profileId }).delete()
  if (acc.size) await db.prs.bulkPut([...acc.values()])
}
