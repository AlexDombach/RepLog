/** Domain model. Everything here is persisted locally in IndexedDB via Dexie. */

export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'legs'
  | 'glutes'
  | 'core'
  | 'fullBody'

export const MUSCLE_GROUPS: MuscleGroup[] = [
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'legs',
  'glutes',
  'core',
  'fullBody',
]

export const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  chest: 'Chest',
  back: 'Back',
  shoulders: 'Shoulders',
  biceps: 'Biceps',
  triceps: 'Triceps',
  legs: 'Legs',
  glutes: 'Glutes',
  core: 'Core',
  fullBody: 'Full body',
}

/** Equipment ids are strings so custom equipment can be added at runtime. */
export type EquipmentId = string

export interface Equipment {
  id: EquipmentId
  name: string
  enabled: boolean
  /** Seeded equipment can't be deleted (only disabled); custom can. */
  custom: boolean
  /** e.g. the functional trainer's rope / bar / D-handles / ankle strap. */
  attachments?: string[]
  /** Sort order in Settings. */
  order: number
}

export type ExerciseType = 'strength' | 'cardio'

export interface Exercise {
  id: string
  name: string
  primaryMuscle: MuscleGroup
  secondaryMuscles: MuscleGroup[]
  /** ALL equipment required for this variation — every id must be enabled. */
  equipment: EquipmentId[]
  type: ExerciseType
  defaultSets: number
  repRange: [number, number]
  instructions: string
  tip?: string
  /** True for multi-joint movements — generator puts these first. */
  compound: boolean
  /** Logged per side (e.g. single-arm cable work). Display only. */
  perSide?: boolean
  /** User-created exercises can be edited/deleted. */
  custom?: boolean
}

export interface Profile {
  id: string
  name: string
  /** Lifetime XP. Level is derived — see lib/xp.ts */
  xp: number
  createdAt: number
  /** Per-profile preferences. */
  restSeconds: number
  soundEnabled: boolean
  vibrationEnabled: boolean
  /** 'lb' | 'kg' */
  units: 'lb' | 'kg'
}

export interface LoggedSet {
  reps: number
  /** In the profile's units at time of logging. 0 for bodyweight. */
  weight: number
  done: boolean
  /** Seconds — cardio only. */
  seconds?: number
}

export interface SessionExercise {
  exerciseId: string
  /** Denormalized so history survives a library edit. */
  name: string
  primaryMuscle: MuscleGroup
  targetSets: number
  repRange: [number, number]
  sets: LoggedSet[]
  notes?: string
}

export type SessionStatus = 'active' | 'complete'

export interface Session {
  id: string
  profileId: string
  /** Epoch ms when the session was started. */
  startedAt: number
  finishedAt?: number
  /** 'YYYY-MM-DD' in local time — the key for streaks and the heatmap. */
  dateKey: string
  title: string
  status: SessionStatus
  exercises: SessionExercise[]
  /** XP awarded on finish (0 while active). */
  xpAwarded: number
  /** Exercise ids that produced a PR in this session. */
  prs: string[]
  units: 'lb' | 'kg'
}

/** Best-ever marks per (profile, exercise). Recomputed on finish/import. */
export interface PersonalRecord {
  /** `${profileId}:${exerciseId}` */
  id: string
  profileId: string
  exerciseId: string
  bestWeight: number
  bestReps: number
  /** Epley estimate: w * (1 + reps/30) */
  bestE1rm: number
  /** Heaviest set's volume (weight * reps) for reference. */
  bestVolume: number
  updatedAt: number
}

/** Single-row app settings. */
export interface AppSettings {
  id: 'app'
  activeProfileId: string
  theme: 'dark' | 'light'
  /** Schema/seed version so we can migrate seeds later. */
  seedVersion: number
}

/** A saved, not-yet-started workout plan (the generator's output, editable). */
export interface WorkoutDraft {
  /** Keyed by profile id — one in-progress draft per profile. */
  id: string
  profileId: string
  title: string
  items: Array<{
    exerciseId: string
    targetSets: number
    repRange: [number, number]
  }>
  updatedAt: number
}
