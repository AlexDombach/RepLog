import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, uid } from '../db'
import { useApp } from '../state/AppContext'
import type { Exercise, MuscleGroup, PersonalRecord } from '../db/types'
import { MUSCLE_GROUPS, MUSCLE_LABELS } from '../db/types'
import { Button, Card, Chip, EmptyState, Sheet, Toggle, cx } from '../components/ui'
import { PlusIcon, SearchIcon, TrashIcon, TrophyIcon } from '../components/Icons'
import { enabledEquipmentIds, isAvailable } from '../lib/generator'

export default function Library() {
  const { exercises, equipment, profile } = useApp()
  const [q, setQ] = useState('')
  const [muscle, setMuscle] = useState<MuscleGroup | null>(null)
  const [onlyAvailable, setOnlyAvailable] = useState(true)
  const [detail, setDetail] = useState<Exercise | null>(null)
  const [addOpen, setAddOpen] = useState(false)

  const prs = useLiveQuery(
    () => (profile ? db.prs.where({ profileId: profile.id }).toArray() : []),
    [profile?.id],
    [] as PersonalRecord[],
  )
  const prById = useMemo(() => new Map(prs.map((p) => [p.exerciseId, p])), [prs])

  const enabled = useMemo(() => enabledEquipmentIds(equipment), [equipment])
  const eqName = useMemo(
    () => new Map(equipment.map((e) => [e.id, e.name])),
    [equipment],
  )

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return exercises.filter(
      (e) =>
        (!onlyAvailable || isAvailable(e, enabled)) &&
        (!muscle || e.primaryMuscle === muscle || e.secondaryMuscles.includes(muscle)) &&
        (!needle || e.name.toLowerCase().includes(needle)),
    )
  }, [exercises, enabled, onlyAvailable, muscle, q])

  // Group by primary muscle for a scannable list.
  const grouped = useMemo(() => {
    const map = new Map<MuscleGroup, Exercise[]>()
    for (const e of results) {
      const list = map.get(e.primaryMuscle) ?? []
      list.push(e)
      map.set(e.primaryMuscle, list)
    }
    return MUSCLE_GROUPS.filter((m) => map.has(m)).map(
      (m) => [m, map.get(m)!] as const,
    )
  }, [results])

  return (
    <div className="px-4 pt-4 space-y-3">
      <div className="relative">
        <SearchIcon size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search exercises"
          className="w-full h-12 pl-10 pr-3 rounded-xl bg-surface border border-line outline-none focus:border-accent/60"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1">
        <Chip active={muscle === null} onClick={() => setMuscle(null)} className="shrink-0">
          All
        </Chip>
        {MUSCLE_GROUPS.map((m) => (
          <Chip
            key={m}
            active={muscle === m}
            onClick={() => setMuscle(muscle === m ? null : m)}
            className="shrink-0"
          >
            {MUSCLE_LABELS[m]}
          </Chip>
        ))}
      </div>

      <Card className="px-4">
        <Toggle
          checked={onlyAvailable}
          onChange={setOnlyAvailable}
          label="Only what I can do"
          sublabel="Hides exercises needing equipment that's switched off"
        />
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted tabular-nums">
          {results.length} exercise{results.length === 1 ? '' : 's'}
        </p>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <PlusIcon size={15} /> Custom
        </Button>
      </div>

      {grouped.length === 0 ? (
        <Card>
          <EmptyState
            title="Nothing here"
            body="Try another muscle group, or turn off the availability filter."
          />
        </Card>
      ) : (
        grouped.map(([m, list]) => (
          <div key={m}>
            <h2 className="text-[11px] uppercase tracking-widest text-muted font-bold px-1 mb-1.5 mt-3">
              {MUSCLE_LABELS[m]}
            </h2>
            <div className="space-y-1.5">
              {list.map((e) => {
                const available = isAvailable(e, enabled)
                const pr = prById.get(e.id)
                return (
                  <Card
                    key={e.id}
                    className={cx('active:bg-surface-2', !available && 'opacity-50')}
                  >
                    <button onClick={() => setDetail(e)} className="w-full text-left p-3.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold flex-1 min-w-0 truncate">
                          {e.name}
                        </span>
                        {pr && pr.bestWeight > 0 && (
                          <span className="shrink-0 flex items-center gap-1 text-[10px] font-bold text-accent tabular-nums">
                            <TrophyIcon size={11} />
                            {pr.bestWeight} {profile!.units}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted mt-0.5 tabular-nums">
                        {e.defaultSets} × {e.repRange[0]}–{e.repRange[1]}
                        {e.type === 'cardio' ? ' min' : ''} ·{' '}
                        {e.equipment.map((id) => eqName.get(id) ?? id).join(', ')}
                      </p>
                    </button>
                  </Card>
                )
              })}
            </div>
          </div>
        ))
      )}

      <ExerciseDetail
        exercise={detail}
        onClose={() => setDetail(null)}
        equipmentName={(id) => eqName.get(id) ?? id}
        pr={detail ? prById.get(detail.id) : undefined}
        units={profile!.units}
      />

      <CustomExerciseSheet open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  )
}

/* ------------------------------------------------------------ detail sheet */

function ExerciseDetail({
  exercise,
  onClose,
  equipmentName,
  pr,
  units,
}: {
  exercise: Exercise | null
  onClose: () => void
  equipmentName: (id: string) => string
  pr?: PersonalRecord
  units: 'lb' | 'kg'
}) {
  if (!exercise) return null
  return (
    <Sheet open onClose={onClose} title={exercise.name}>
      <div className="flex flex-wrap gap-1.5 mb-4">
        <Tag>{MUSCLE_LABELS[exercise.primaryMuscle]}</Tag>
        {exercise.secondaryMuscles.map((m) => (
          <Tag key={m} muted>
            {MUSCLE_LABELS[m]}
          </Tag>
        ))}
        {exercise.compound && <Tag muted>compound</Tag>}
        {exercise.perSide && <Tag muted>per side</Tag>}
      </div>

      <p className="text-sm leading-relaxed">{exercise.instructions}</p>
      {exercise.tip && (
        <p className="text-sm leading-relaxed text-accent mt-3 pl-3 border-l-2 border-accent/40">
          {exercise.tip}
        </p>
      )}

      <dl className="mt-5 space-y-2 text-sm">
        <Row
          label="Prescription"
          value={`${exercise.defaultSets} sets × ${exercise.repRange[0]}–${exercise.repRange[1]} ${exercise.type === 'cardio' ? 'min' : 'reps'}`}
        />
        <Row label="Equipment" value={exercise.equipment.map(equipmentName).join(', ')} />
        {pr && (
          <>
            <Row
              label="Best weight"
              value={pr.bestWeight > 0 ? `${pr.bestWeight} ${units}` : '—'}
            />
            <Row label="Best reps" value={String(pr.bestReps)} />
            <Row
              label="Est. 1RM"
              value={pr.bestE1rm > 0 ? `${Math.round(pr.bestE1rm)} ${units}` : '—'}
            />
          </>
        )}
      </dl>

      {exercise.custom && (
        <Button
          variant="danger"
          full
          className="mt-6"
          onClick={async () => {
            await db.exercises.delete(exercise.id)
            onClose()
          }}
        >
          <TrashIcon size={16} /> Delete custom exercise
        </Button>
      )}
    </Sheet>
  )
}

function Tag({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <span
      className={cx(
        'text-[11px] font-semibold px-2.5 py-1 rounded-full',
        muted ? 'bg-surface-2 text-muted' : 'bg-accent/15 text-accent',
      )}
    >
      {children}
    </span>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted shrink-0">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  )
}

/* ------------------------------------------------------ custom exercise */

function CustomExerciseSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { equipment } = useApp()
  const [name, setName] = useState('')
  const [muscle, setMuscle] = useState<MuscleGroup>('chest')
  const [eq, setEq] = useState<string[]>([])
  const [sets, setSets] = useState(3)
  const [repMin, setRepMin] = useState(8)
  const [repMax, setRepMax] = useState(12)
  const [compound, setCompound] = useState(false)
  const [instructions, setInstructions] = useState('')

  async function save() {
    if (!name.trim()) return
    const exercise: Exercise = {
      id: uid('ex'),
      name: name.trim(),
      primaryMuscle: muscle,
      secondaryMuscles: [],
      equipment: eq.length ? eq : ['bodyweight'],
      type: 'strength',
      defaultSets: sets,
      repRange: [Math.min(repMin, repMax), Math.max(repMin, repMax)],
      instructions: instructions.trim() || 'Your own movement.',
      compound,
      custom: true,
    }
    await db.exercises.add(exercise)
    setName('')
    setInstructions('')
    setEq([])
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title="Custom exercise">
      <Field label="Name">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Landmine Press"
          className="w-full h-12 px-3 rounded-xl bg-surface-2 border border-line outline-none focus:border-accent/60"
        />
      </Field>

      <Field label="Primary muscle">
        <div className="flex flex-wrap gap-2">
          {MUSCLE_GROUPS.map((m) => (
            <Chip key={m} active={muscle === m} onClick={() => setMuscle(m)}>
              {MUSCLE_LABELS[m]}
            </Chip>
          ))}
        </div>
      </Field>

      <Field label="Equipment needed">
        <div className="flex flex-wrap gap-2">
          {equipment.map((e) => (
            <Chip
              key={e.id}
              active={eq.includes(e.id)}
              onClick={() =>
                setEq(eq.includes(e.id) ? eq.filter((x) => x !== e.id) : [...eq, e.id])
              }
            >
              {e.name}
            </Chip>
          ))}
        </div>
      </Field>

      <Field label="Prescription">
        <div className="flex items-center gap-2">
          <NumBox value={sets} onChange={setSets} min={1} max={10} label="sets" />
          <span className="text-muted">×</span>
          <NumBox value={repMin} onChange={setRepMin} min={1} max={100} label="min" />
          <span className="text-muted">–</span>
          <NumBox value={repMax} onChange={setRepMax} min={1} max={100} label="max" />
        </div>
      </Field>

      <div className="py-1">
        <Toggle
          checked={compound}
          onChange={setCompound}
          label="Compound movement"
          sublabel="Generator puts compounds first"
        />
      </div>

      <Field label="Form cue (optional)">
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          rows={3}
          className="w-full p-3 rounded-xl bg-surface-2 border border-line outline-none focus:border-accent/60 resize-none"
        />
      </Field>

      <Button variant="primary" size="lg" full className="mt-2" disabled={!name.trim()} onClick={save}>
        Save exercise
      </Button>
    </Sheet>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <label className="block text-[11px] uppercase tracking-widest text-muted font-bold mb-2">
        {label}
      </label>
      {children}
    </div>
  )
}

function NumBox({
  value,
  onChange,
  min,
  max,
  label,
}: {
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  label: string
}) {
  return (
    <label className="flex-1">
      <input
        type="number"
        inputMode="numeric"
        value={value}
        min={min}
        max={max}
        onChange={(e) => {
          const n = Number(e.target.value)
          if (!Number.isNaN(n)) onChange(Math.min(max, Math.max(min, n)))
        }}
        className="w-full h-12 px-3 rounded-xl bg-surface-2 border border-line outline-none text-center font-bold tabular-nums focus:border-accent/60"
      />
      <span className="block text-[10px] uppercase tracking-wider text-muted text-center mt-1">
        {label}
      </span>
    </label>
  )
}
