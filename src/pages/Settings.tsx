import { useEffect, useRef, useState } from 'react'
import { db, plantStarterWorkout, uid } from '../db'
import { useApp } from '../state/AppContext'
import type { Equipment } from '../db/types'
import { Button, Card, Chip, Sheet, Toggle, cx } from '../components/ui'
import {
  DownloadIcon,
  PlusIcon,
  TrashIcon,
  UploadIcon,
  UserIcon,
} from '../components/Icons'
import {
  backupFilename,
  buildBackup,
  clearAllData,
  downloadJson,
  importBackup,
  requestPersistence,
  storageEstimate,
  validateBackup,
  type ImportSummary,
} from '../lib/backup'

const REST_PRESETS = [45, 60, 90, 120, 180]

export default function Settings() {
  const { profile, profiles, equipment, setTheme, settings, updateProfile, reload } =
    useApp()

  const [toast, setToast] = useState<string | null>(null)
  const show = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2600)
  }

  return (
    <div className="px-4 pt-4 space-y-4">
      <ProfileSection
        profiles={profiles}
        activeId={profile!.id}
        onRename={(id, name) => updateProfile(id, { name })}
      />

      <WorkoutPrefs
        restSeconds={profile!.restSeconds}
        units={profile!.units}
        sound={profile!.soundEnabled}
        vibration={profile!.vibrationEnabled}
        onChange={(patch) => updateProfile(profile!.id, patch)}
      />

      <EquipmentSection equipment={equipment} />

      <AppearanceSection
        theme={settings?.theme ?? 'dark'}
        onTheme={setTheme}
        onRestoreStarter={async () => {
          await plantStarterWorkout(profile!.id)
          show('Starter workout restored — see the Workout tab.')
        }}
      />

      <DataSection onToast={show} onReload={reload} />

      <AboutSection />

      {toast && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-24 z-40 animate-rise">
          <div className="px-4 py-3 rounded-2xl bg-surface border border-line shadow-2xl max-w-[88vw]">
            <p className="text-sm font-medium">{toast}</p>
          </div>
        </div>
      )}
    </div>
  )
}

/* ---------------------------------------------------------------- Section */

function Section({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <Card className="p-4">
      <h2 className="font-bold">{title}</h2>
      {subtitle && <p className="text-xs text-muted mt-0.5 leading-relaxed">{subtitle}</p>}
      <div className="mt-3">{children}</div>
    </Card>
  )
}

/* --------------------------------------------------------------- Profiles */

function ProfileSection({
  profiles,
  activeId,
  onRename,
}: {
  profiles: Array<{ id: string; name: string; xp: number }>
  activeId: string
  onRename: (id: string, name: string) => void
}) {
  return (
    <Section title="Profiles" subtitle="Tap a name to edit it. Both profiles stay on this device.">
      <div className="space-y-2">
        {profiles.map((p) => (
          <div
            key={p.id}
            className={cx(
              'flex items-center gap-3 p-2.5 rounded-xl border',
              p.id === activeId ? 'bg-accent/10 border-accent/40' : 'bg-surface-2 border-line',
            )}
          >
            <UserIcon size={18} className="text-muted shrink-0" />
            <input
              defaultValue={p.name}
              onBlur={(e) => {
                const v = e.target.value.trim()
                if (v && v !== p.name) onRename(p.id, v)
                else e.target.value = p.name
              }}
              maxLength={24}
              className="flex-1 min-w-0 bg-transparent font-semibold outline-none"
              aria-label="Profile name"
            />
            <span className="text-xs text-muted tabular-nums shrink-0">{p.xp} XP</span>
          </div>
        ))}
      </div>
    </Section>
  )
}

/* ---------------------------------------------------------- Workout prefs */

function WorkoutPrefs({
  restSeconds,
  units,
  sound,
  vibration,
  onChange,
}: {
  restSeconds: number
  units: 'lb' | 'kg'
  sound: boolean
  vibration: boolean
  onChange: (patch: Record<string, unknown>) => void
}) {
  return (
    <Section title="Workout" subtitle="These settings apply to the active profile.">
      <p className="text-[11px] uppercase tracking-widest text-muted font-bold mb-2">
        Rest timer default
      </p>
      <div className="flex gap-2 flex-wrap">
        {REST_PRESETS.map((s) => (
          <Chip
            key={s}
            active={restSeconds === s}
            onClick={() => onChange({ restSeconds: s })}
          >
            {s < 60 ? `${s}s` : `${s / 60}m${s % 60 ? ` ${s % 60}s` : ''}`}
          </Chip>
        ))}
      </div>

      <p className="text-[11px] uppercase tracking-widest text-muted font-bold mb-2 mt-5">
        Units
      </p>
      <div className="flex gap-2">
        <Chip active={units === 'lb'} onClick={() => onChange({ units: 'lb' })} className="flex-1">
          Pounds (lb)
        </Chip>
        <Chip active={units === 'kg'} onClick={() => onChange({ units: 'kg' })} className="flex-1">
          Kilograms (kg)
        </Chip>
      </div>

      <div className="mt-3 divide-y divide-line">
        <Toggle
          checked={sound}
          onChange={(v) => onChange({ soundEnabled: v })}
          label="Sound"
          sublabel="Chime when a set is logged and when rest ends"
        />
        <Toggle
          checked={vibration}
          onChange={(v) => onChange({ vibrationEnabled: v })}
          label="Vibration"
          sublabel="Android only — iOS Safari ignores web vibration"
        />
      </div>
    </Section>
  )
}

/* -------------------------------------------------------------- Equipment */

function EquipmentSection({ equipment }: { equipment: Equipment[] }) {
  const [addOpen, setAddOpen] = useState(false)
  const [name, setName] = useState('')

  return (
    <Section
      title="Gym equipment"
      subtitle="Only enabled equipment is used by the generator and the library filter. Shared by both profiles."
    >
      <div className="divide-y divide-line">
        {equipment.map((e) => (
          <div key={e.id} className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <Toggle
                checked={e.enabled}
                onChange={(v) => db.equipment.update(e.id, { enabled: v })}
                label={e.name}
                sublabel={e.attachments?.join(' · ')}
              />
            </div>
            {e.custom && (
              <button
                aria-label={`Delete ${e.name}`}
                onClick={() => db.equipment.delete(e.id)}
                className="h-9 w-9 shrink-0 rounded-lg grid place-items-center text-muted active:text-danger active:bg-surface-2"
              >
                <TrashIcon size={15} />
              </button>
            )}
          </div>
        ))}
      </div>

      <Button full className="mt-3" onClick={() => setAddOpen(true)}>
        <PlusIcon size={16} /> Add equipment
      </Button>

      <Sheet open={addOpen} onClose={() => setAddOpen(false)} title="Add equipment">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Barbell, Leg press"
          className="w-full h-12 px-3 rounded-xl bg-surface-2 border border-line outline-none focus:border-accent/60"
        />
        <p className="text-xs text-muted mt-2 leading-relaxed">
          New equipment starts enabled. Build exercises for it from Library →
          Custom.
        </p>
        <Button
          variant="primary"
          size="lg"
          full
          className="mt-4"
          disabled={!name.trim()}
          onClick={async () => {
            const max = await db.equipment.orderBy('order').last()
            await db.equipment.add({
              id: uid('eq'),
              name: name.trim(),
              enabled: true,
              custom: true,
              order: (max?.order ?? 0) + 1,
            })
            setName('')
            setAddOpen(false)
          }}
        >
          Add
        </Button>
      </Sheet>
    </Section>
  )
}

/* ------------------------------------------------------------- Appearance */

function AppearanceSection({
  theme,
  onTheme,
  onRestoreStarter,
}: {
  theme: 'dark' | 'light'
  onTheme: (t: 'dark' | 'light') => void
  onRestoreStarter: () => void
}) {
  return (
    <Section title="Appearance">
      <div className="flex gap-2">
        <Chip active={theme === 'dark'} onClick={() => onTheme('dark')} className="flex-1">
          Dark
        </Chip>
        <Chip active={theme === 'light'} onClick={() => onTheme('light')} className="flex-1">
          Light
        </Chip>
      </div>
      <Button full className="mt-3" onClick={onRestoreStarter}>
        Restore starter workout
      </Button>
    </Section>
  )
}

/* ------------------------------------------------------------------- Data */

function DataSection({
  onToast,
  onReload,
}: {
  onToast: (m: string) => void
  onReload: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<{ json: unknown; label: string } | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [storage, setStorage] = useState<{ usage: number; quota: number } | null>(null)
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void storageEstimate().then(setStorage)
    void navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(null))
  }, [])

  async function doExport() {
    const backup = await buildBackup()
    const ok = downloadJson(backup, backupFilename())
    onToast(
      ok
        ? 'Backup saved. Keep it somewhere off the phone.'
        : "Couldn't start the download — try again from Safari rather than the home-screen app.",
    )
  }

  async function onFile(file: File) {
    try {
      const text = await file.text()
      setPending({ json: JSON.parse(text), label: file.name })
    } catch {
      onToast("That file isn't readable JSON.")
    }
  }

  async function doImport() {
    if (!pending || busy) return
    setBusy(true)
    try {
      const backup = validateBackup(pending.json)
      const summary: ImportSummary = await importBackup(backup)
      setPending(null)
      onReload()
      onToast(
        `Restored ${summary.profiles} profiles, ${summary.sessions} sessions, ${summary.prs} PRs.`,
      )
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Import failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Section
      title="Your data"
      subtitle="Everything lives in this browser's storage on this device. There is no cloud copy — export regularly."
    >
      <div className="flex gap-2">
        <Button className="flex-1" onClick={doExport}>
          <DownloadIcon size={16} /> Export
        </Button>
        <Button className="flex-1" onClick={() => fileRef.current?.click()}>
          <UploadIcon size={16} /> Import
        </Button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void onFile(f)
          e.target.value = ''
        }}
      />

      {storage && (
        <p className="text-xs text-muted mt-3 tabular-nums">
          Using {(storage.usage / 1024).toFixed(0)} KB
          {storage.quota > 0 &&
            ` of ~${(storage.quota / 1024 / 1024).toFixed(0)} MB available`}
          .{' '}
          {persisted === true
            ? 'Storage is marked persistent.'
            : 'Storage is not marked persistent.'}
        </p>
      )}

      {persisted === false && (
        <Button
          size="sm"
          full
          className="mt-2"
          onClick={async () => {
            const ok = await requestPersistence()
            setPersisted(ok)
            onToast(
              ok
                ? 'Storage is now persistent.'
                : 'Safari declined — adding the app to your home screen usually grants it.',
            )
          }}
        >
          Request persistent storage
        </Button>
      )}

      <Button variant="danger" full className="mt-4" onClick={() => setConfirmClear(true)}>
        <TrashIcon size={16} /> Clear all data
      </Button>

      {/* confirm import */}
      <Sheet open={pending !== null} onClose={() => setPending(null)} title="Restore backup?">
        <p className="text-sm text-muted leading-relaxed">
          <span className="text-fg font-semibold">{pending?.label}</span> will{' '}
          <span className="text-fg font-semibold">replace everything</span> currently on
          this device — all profiles, history, PRs and settings. Export your current data
          first if you want to keep it.
        </p>
        <Button variant="primary" size="lg" full className="mt-5" disabled={busy} onClick={doImport}>
          {busy ? 'Restoring…' : 'Replace and restore'}
        </Button>
        <Button variant="ghost" full className="mt-2" onClick={() => setPending(null)}>
          Cancel
        </Button>
      </Sheet>

      {/* confirm clear */}
      <Sheet open={confirmClear} onClose={() => setConfirmClear(false)} title="Clear all data?">
        <p className="text-sm text-muted leading-relaxed">
          Every workout, PR, streak and XP point for{' '}
          <span className="text-fg font-semibold">both profiles</span> is deleted and the
          app resets to its seeded state. There is no cloud backup. This can't be undone.
        </p>
        <Button
          variant="danger"
          size="lg"
          full
          className="mt-5"
          onClick={async () => {
            await clearAllData()
            setConfirmClear(false)
            onReload()
            onToast('All data cleared.')
          }}
        >
          Delete everything
        </Button>
        <Button variant="ghost" full className="mt-2" onClick={() => setConfirmClear(false)}>
          Cancel
        </Button>
      </Sheet>
    </Section>
  )
}

/* ------------------------------------------------------------------ About */

function AboutSection() {
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true

  return (
    <Section title="About">
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted">Version</dt>
          <dd className="font-medium">RepLog 1.0</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted">Installed to home screen</dt>
          <dd className="font-medium">{standalone ? 'Yes' : 'No'}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted">Network</dt>
          <dd className="font-medium">{online ? 'Online' : 'Offline — still fine'}</dd>
        </div>
      </dl>
      <p className="text-xs text-muted mt-4 leading-relaxed">
        RepLog makes no network requests once it's loaded. Your workouts never leave
        this device.
      </p>
    </Section>
  )
}
