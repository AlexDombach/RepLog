import { useMemo, useState } from 'react'
import type { Exercise, MuscleGroup } from '../db/types'
import { MUSCLE_GROUPS, MUSCLE_LABELS } from '../db/types'
import { useApp } from '../state/AppContext'
import { enabledEquipmentIds, isAvailable } from '../lib/generator'
import { Chip, EmptyState, Sheet, cx } from './ui'
import { SearchIcon } from './Icons'

/**
 * Searchable exercise list filtered to AVAILABLE equipment.
 * Used to add an exercise to a plan and to swap one out.
 */
export default function ExercisePicker({
  open,
  onClose,
  onPick,
  title = 'Add exercise',
  exclude = [],
  /** Pre-select a muscle filter (used by swap). */
  initialMuscle,
}: {
  open: boolean
  onClose: () => void
  onPick: (ex: Exercise) => void
  title?: string
  exclude?: string[]
  initialMuscle?: MuscleGroup
}) {
  const { exercises, equipment } = useApp()
  const [q, setQ] = useState('')
  const [muscle, setMuscle] = useState<MuscleGroup | null>(initialMuscle ?? null)

  const results = useMemo(() => {
    const enabled = enabledEquipmentIds(equipment)
    const excluded = new Set(exclude)
    const needle = q.trim().toLowerCase()
    return exercises.filter(
      (e) =>
        !excluded.has(e.id) &&
        isAvailable(e, enabled) &&
        (!muscle || e.primaryMuscle === muscle || e.secondaryMuscles.includes(muscle)) &&
        (!needle || e.name.toLowerCase().includes(needle)),
    )
  }, [exercises, equipment, exclude, q, muscle])

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="relative mb-3">
        <SearchIcon
          size={18}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
        />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search exercises"
          className="w-full h-12 pl-10 pr-3 rounded-xl bg-surface-2 border border-line outline-none focus:border-accent/60"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-3 -mx-5 px-5">
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

      {results.length === 0 ? (
        <EmptyState
          title="Nothing matches"
          body="Try a different muscle group — or enable more equipment in Settings."
        />
      ) : (
        <div className="space-y-1.5">
          {results.map((e) => (
            <button
              key={e.id}
              onClick={() => {
                onPick(e)
                onClose()
              }}
              className={cx(
                'w-full text-left p-3 rounded-xl bg-surface-2 active:bg-line',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold truncate">{e.name}</span>
                <span className="shrink-0 text-[10px] uppercase tracking-wider text-muted">
                  {MUSCLE_LABELS[e.primaryMuscle]}
                </span>
              </div>
              <p className="text-xs text-muted mt-0.5 tabular-nums">
                {e.defaultSets} × {e.repRange[0]}–{e.repRange[1]}
                {e.compound ? ' · compound' : ''}
                {e.perSide ? ' · per side' : ''}
              </p>
            </button>
          ))}
        </div>
      )}
    </Sheet>
  )
}
