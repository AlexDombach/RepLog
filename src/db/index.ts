import Dexie, { type Table } from 'dexie'
import type {
  AppSettings,
  Equipment,
  Exercise,
  PersonalRecord,
  Profile,
  Session,
  WorkoutDraft,
} from './types'
import { SEED_EQUIPMENT } from './seedEquipment'
import { SEED_EXERCISES } from './seedExercises'
import { dateKey } from '../lib/date'

/** Bump when the seed data changes and should be re-applied to existing installs. */
export const SEED_VERSION = 1

export class RepLogDB extends Dexie {
  profiles!: Table<Profile, string>
  equipment!: Table<Equipment, string>
  exercises!: Table<Exercise, string>
  sessions!: Table<Session, string>
  prs!: Table<PersonalRecord, string>
  settings!: Table<AppSettings, string>
  drafts!: Table<WorkoutDraft, string>

  constructor() {
    super('replog')
    this.version(1).stores({
      profiles: 'id, name',
      equipment: 'id, order, enabled',
      exercises: 'id, name, primaryMuscle, type',
      // Compound indexes drive the history/streak/heatmap queries.
      sessions: 'id, profileId, dateKey, startedAt, [profileId+dateKey], [profileId+startedAt], [profileId+status]',
      prs: 'id, profileId, exerciseId, [profileId+exerciseId]',
      settings: 'id',
      drafts: 'id',
    })
  }
}

export const db = new RepLogDB()

export function uid(prefix = ''): string {
  // crypto.randomUUID needs a secure context; fall back for plain-http LAN testing.
  const raw =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  return prefix ? `${prefix}_${raw}` : raw
}

export const DEFAULT_PROFILE_ID = 'profile-1'
export const SECOND_PROFILE_ID = 'profile-2'

function makeProfile(id: string, name: string): Profile {
  return {
    id,
    name,
    xp: 0,
    createdAt: Date.now(),
    restSeconds: 90,
    soundEnabled: true,
    vibrationEnabled: true,
    units: 'lb',
  }
}

/** The ready-to-run workout the app ships with. */
const SEED_WORKOUT = {
  title: 'Biceps & Shoulders',
  items: [
    { exerciseId: 'db-shoulder-press', targetSets: 3, repRange: [8, 12] as [number, number] },
    { exerciseId: 'cable-lateral-raise', targetSets: 3, repRange: [12, 15] as [number, number] },
    { exerciseId: 'cable-face-pull', targetSets: 3, repRange: [12, 15] as [number, number] },
    { exerciseId: 'db-bicep-curl', targetSets: 3, repRange: [8, 12] as [number, number] },
    { exerciseId: 'cable-bicep-curl', targetSets: 3, repRange: [10, 12] as [number, number] },
    { exerciseId: 'db-hammer-curl', targetSets: 3, repRange: [10, 12] as [number, number] },
  ],
}

/**
 * Idempotent bootstrap. Runs on every app start:
 *  - creates the two profiles + settings row on first run
 *  - adds any NEW seed exercises/equipment without clobbering user edits
 *  - plants the starter "Biceps & Shoulders" draft for the active profile
 */
export async function initDb(): Promise<AppSettings> {
  return db.transaction(
    'rw',
    [db.profiles, db.equipment, db.exercises, db.settings, db.drafts],
    async () => {
      // --- profiles -------------------------------------------------------
      if ((await db.profiles.count()) === 0) {
        await db.profiles.bulkAdd([
          makeProfile(DEFAULT_PROFILE_ID, 'Alex'),
          makeProfile(SECOND_PROFILE_ID, 'Partner'),
        ])
      }

      // --- equipment (add missing only, so toggles survive) ---------------
      const existingEq = new Set(await db.equipment.toCollection().primaryKeys())
      const newEq = SEED_EQUIPMENT.filter((e) => !existingEq.has(e.id))
      if (newEq.length) await db.equipment.bulkAdd(newEq)

      // --- exercises (add missing only, so custom edits survive) ----------
      const existingEx = new Set(await db.exercises.toCollection().primaryKeys())
      const newEx = SEED_EXERCISES.filter((e) => !existingEx.has(e.id))
      if (newEx.length) await db.exercises.bulkAdd(newEx)

      // --- settings -------------------------------------------------------
      let settings = await db.settings.get('app')
      if (!settings) {
        settings = {
          id: 'app',
          activeProfileId: DEFAULT_PROFILE_ID,
          theme: 'dark',
          seedVersion: SEED_VERSION,
        }
        await db.settings.put(settings)
      } else if (settings.seedVersion !== SEED_VERSION) {
        settings = { ...settings, seedVersion: SEED_VERSION }
        await db.settings.put(settings)
      }

      // --- starter workout draft -----------------------------------------
      const pid = settings.activeProfileId
      if (!(await db.drafts.get(pid))) {
        await db.drafts.put({
          id: pid,
          profileId: pid,
          title: SEED_WORKOUT.title,
          items: SEED_WORKOUT.items,
          updatedAt: Date.now(),
        })
      }

      return settings
    },
  )
}

/** Re-plant the starter workout (used by Settings → "Restore starter workout"). */
export async function plantStarterWorkout(profileId: string): Promise<void> {
  await db.drafts.put({
    id: profileId,
    profileId,
    title: SEED_WORKOUT.title,
    items: SEED_WORKOUT.items,
    updatedAt: Date.now(),
  })
}

/** Today's session for a profile, if one is already in progress. */
export async function getActiveSession(profileId: string): Promise<Session | undefined> {
  const rows = await db.sessions.where({ profileId, status: 'active' }).toArray()
  // Newest first; stale ones from previous days are still resumable.
  return rows.sort((a, b) => b.startedAt - a.startedAt)[0]
}

export async function getTodaySessions(profileId: string): Promise<Session[]> {
  return db.sessions.where({ profileId, dateKey: dateKey() }).toArray()
}
