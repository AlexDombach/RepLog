import { db, initDb, SEED_VERSION } from '../db'
import type {
  AppSettings,
  Equipment,
  Exercise,
  PersonalRecord,
  Profile,
  Session,
  WorkoutDraft,
} from '../db/types'

export const BACKUP_FORMAT = 'replog-backup'
export const BACKUP_VERSION = 1

export interface Backup {
  format: typeof BACKUP_FORMAT
  version: number
  exportedAt: string
  seedVersion: number
  profiles: Profile[]
  equipment: Equipment[]
  exercises: Exercise[]
  sessions: Session[]
  prs: PersonalRecord[]
  settings: AppSettings[]
  drafts: WorkoutDraft[]
}

export async function buildBackup(): Promise<Backup> {
  const [profiles, equipment, exercises, sessions, prs, settings, drafts] =
    await Promise.all([
      db.profiles.toArray(),
      db.equipment.toArray(),
      db.exercises.toArray(),
      db.sessions.toArray(),
      db.prs.toArray(),
      db.settings.toArray(),
      db.drafts.toArray(),
    ])
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    seedVersion: SEED_VERSION,
    profiles,
    equipment,
    exercises,
    sessions,
    prs,
    settings,
    drafts,
  }
}

export function backupFilename(): string {
  const d = new Date()
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`
  return `replog-backup-${stamp}.json`
}

/**
 * Trigger a file download. On iOS this opens the share/save sheet.
 * Returns false if the browser blocked it so the UI can offer a fallback.
 */
export function downloadJson(data: unknown, filename: string): boolean {
  try {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    // Revoke late — Safari needs the URL alive while the sheet opens.
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
    return true
  } catch (err) {
    console.error('download failed', err)
    return false
  }
}

export class BackupError extends Error {}

/** Shape-check a parsed backup before we touch the database. */
export function validateBackup(raw: unknown): Backup {
  if (typeof raw !== 'object' || raw === null) {
    throw new BackupError('That file is not valid JSON object data.')
  }
  const b = raw as Partial<Backup>
  if (b.format !== BACKUP_FORMAT) {
    throw new BackupError("That doesn't look like a RepLog backup file.")
  }
  if (typeof b.version !== 'number' || b.version > BACKUP_VERSION) {
    throw new BackupError(
      `Backup version ${String(b.version)} is newer than this app understands.`,
    )
  }
  const tables: Array<keyof Backup> = [
    'profiles',
    'equipment',
    'exercises',
    'sessions',
    'prs',
    'settings',
    'drafts',
  ]
  for (const t of tables) {
    if (!Array.isArray(b[t])) throw new BackupError(`Backup is missing "${t}".`)
  }
  if ((b.profiles as Profile[]).length === 0) {
    throw new BackupError('Backup contains no profiles.')
  }
  return b as Backup
}

export interface ImportSummary {
  profiles: number
  sessions: number
  exercises: number
  prs: number
}

/**
 * Restore a backup. This REPLACES the local database — the UI confirms first.
 * Everything runs in one transaction so a bad file can't leave a half state.
 */
export async function importBackup(backup: Backup): Promise<ImportSummary> {
  await db.transaction(
    'rw',
    [db.profiles, db.equipment, db.exercises, db.sessions, db.prs, db.settings, db.drafts],
    async () => {
      await Promise.all([
        db.profiles.clear(),
        db.equipment.clear(),
        db.exercises.clear(),
        db.sessions.clear(),
        db.prs.clear(),
        db.settings.clear(),
        db.drafts.clear(),
      ])
      await db.profiles.bulkAdd(backup.profiles)
      await db.equipment.bulkAdd(backup.equipment)
      await db.exercises.bulkAdd(backup.exercises)
      await db.sessions.bulkAdd(backup.sessions)
      await db.prs.bulkAdd(backup.prs)
      await db.settings.bulkAdd(backup.settings)
      await db.drafts.bulkAdd(backup.drafts)
    },
  )
  // Re-add anything the backup predates (new seed exercises, missing settings).
  await initDb()
  return {
    profiles: backup.profiles.length,
    sessions: backup.sessions.length,
    exercises: backup.exercises.length,
    prs: backup.prs.length,
  }
}

/** Wipe everything and re-seed from scratch. */
export async function clearAllData(): Promise<void> {
  await db.transaction(
    'rw',
    [db.profiles, db.equipment, db.exercises, db.sessions, db.prs, db.settings, db.drafts],
    async () => {
      await Promise.all([
        db.profiles.clear(),
        db.equipment.clear(),
        db.exercises.clear(),
        db.sessions.clear(),
        db.prs.clear(),
        db.settings.clear(),
        db.drafts.clear(),
      ])
    },
  )
  await initDb()
}

/** How much space IndexedDB is using, when the browser will tell us. */
export async function storageEstimate(): Promise<{ usage: number; quota: number } | null> {
  try {
    const est = await navigator.storage?.estimate?.()
    if (!est) return null
    return { usage: est.usage ?? 0, quota: est.quota ?? 0 }
  } catch {
    return null
  }
}

/**
 * Ask the browser to keep this origin's data out of the eviction queue.
 * Safari grants it once the app is added to the home screen.
 */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (await navigator.storage?.persisted?.()) return true
    return (await navigator.storage?.persist?.()) ?? false
  } catch {
    return false
  }
}
