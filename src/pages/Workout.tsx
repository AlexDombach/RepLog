import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { useApp } from '../state/AppContext'
import type { Exercise, MuscleGroup, Session } from '../db/types'
import { MUSCLE_GROUPS, MUSCLE_LABELS } from '../db/types'
import { Button, Card, Chip, Sheet, cx } from '../components/ui'
import ExercisePicker from '../components/ExercisePicker'
import {
  ChevronDown,
  DumbbellIcon,
  PlayIcon,
  PlusIcon,
  SwapIcon,
  TrashIcon,
} from '../components/Icons'
import {
  SIZE_COUNTS,
  SIZE_LABELS,
  enabledEquipmentIds,
  generateWorkout,
  isAvailable,
  swapCandidates,
  type GeneratedItem,
  type WorkoutSize,
} from '../lib/generator'
import { startSession, type PlanItem } from '../lib/session'

const SIZES: WorkoutSize[] = ['quick', 'standard', 'long']

export default function Workout() {
  const { profile, exercises, equipment } = useApp()
  const nav = useNavigate()
  const pid = profile!.id

  const draft = useLiveQuery(() => db.drafts.get(pid), [pid])
  const history = useLiveQuery(
    () => db.sessions.where({ profileId: pid }).toArray(),
    [pid],
    [] as Session[],
  )
  const active = useMemo(
    () =>
      history
        .filter((s) => s.status === 'active')
        .sort((a, b) => b.startedAt - a.startedAt)[0],
    [history],
  )

  const byId = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises])
  const enabled = useMemo(() => enabledEquipmentIds(equipment), [equipment])

  // --- local plan state, synced from the persisted draft ---------------
  const [title, setTitle] = useState('')
  const [plan, setPlan] = useState<PlanItem[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (draft === undefined) return // still loading
    if (loaded) return
    setTitle(draft?.title ?? 'Workout')
    setPlan(draft?.items ?? [])
    setLoaded(true)
  }, [draft, loaded])

  // Reset when the profile changes — each profile has its own draft.
  useEffect(() => {
    setLoaded(false)
  }, [pid])

  // Persist the plan (debounced) so a reload mid-edit doesn't lose it.
  useEffect(() => {
    if (!loaded) return
    const t = setTimeout(() => {
      void db.drafts.put({
        id: pid,
        profileId: pid,
        title: title || 'Workout',
        items: plan,
        updatedAt: Date.now(),
      })
    }, 300)
    return () => clearTimeout(t)
  }, [plan, title, pid, loaded])

  // --- generator controls ----------------------------------------------
  const [genOpen, setGenOpen] = useState(false)
  const [muscles, setMuscles] = useState<MuscleGroup[]>(['shoulders', 'biceps'])
  const [size, setSize] = useState<WorkoutSize>('standard')

  const [pickerOpen, setPickerOpen] = useState(false)
  const [swapIndex, setSwapIndex] = useState<number | null>(null)
  const [starting, setStarting] = useState(false)

  function runGenerator() {
    const items: GeneratedItem[] = generateWorkout({
      muscles,
      size,
      exercises,
      equipment,
      history,
    })
    setPlan(items)
    setTitle(
      muscles.length === 0
        ? 'Full Body'
        : muscles.map((m) => MUSCLE_LABELS[m]).join(' & '),
    )
    setGenOpen(false)
  }

  /** Exercises in the plan whose equipment got switched off in Settings. */
  const unavailable = useMemo(
    () =>
      new Set(
        plan
          .map((p) => byId.get(p.exerciseId))
          .filter((e): e is Exercise => !!e && !isAvailable(e, enabled))
          .map((e) => e.id),
      ),
    [plan, byId, enabled],
  )

  async function start() {
    if (!plan.length || starting) return
    setStarting(true)
    try {
      const session = await startSession(profile!, title || 'Workout', plan, exercises)
      nav(`/workout/active/${session.id}`)
    } finally {
      setStarting(false)
    }
  }

  const move = (from: number, to: number) => {
    if (to < 0 || to >= plan.length) return
    const next = [...plan]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    setPlan(next)
  }

  return (
    <div className="px-4 pt-4 space-y-4">
      {active && (
        <Card className="p-4 border-accent/40 bg-accent/5 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-widest text-accent font-bold">
              In progress
            </p>
            <p className="font-bold truncate">{active.title}</p>
          </div>
          <Button variant="primary" onClick={() => nav(`/workout/active/${active.id}`)}>
            <PlayIcon size={18} /> Resume
          </Button>
        </Card>
      )}

      {/* ---------------- Plan header ---------------- */}
      <Card className="p-4">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Workout name"
          className="w-full bg-transparent text-2xl font-black tracking-tight outline-none"
        />
        <p className="text-xs text-muted mt-1 tabular-nums">
          {plan.length} exercise{plan.length === 1 ? '' : 's'} ·{' '}
          {plan.reduce((n, p) => n + p.targetSets, 0)} sets
        </p>

        <div className="flex gap-2 mt-4">
          <Button className="flex-1" onClick={() => setGenOpen(true)}>
            <DumbbellIcon size={18} /> Generate
          </Button>
          <Button className="flex-1" onClick={() => setPickerOpen(true)}>
            <PlusIcon size={18} /> Add
          </Button>
        </div>
      </Card>

      {/* ---------------- Plan items ---------------- */}
      {plan.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="font-bold text-lg">Empty workout</p>
          <p className="text-muted text-sm mt-1.5 leading-relaxed">
            Generate one from your target muscles, or add exercises by hand.
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {plan.map((item, i) => {
            const ex = byId.get(item.exerciseId)
            if (!ex) return null
            const gone = unavailable.has(ex.id)
            return (
              <Card key={`${ex.id}-${i}`} className={cx('p-3', gone && 'border-warn/50')}>
                <div className="flex items-start gap-2">
                  <span className="mt-1 h-6 w-6 shrink-0 rounded-lg bg-surface-2 grid place-items-center text-xs font-bold text-muted tabular-nums">
                    {i + 1}
                  </span>

                  <div className="flex-1 min-w-0">
                    <p className="font-bold leading-tight">{ex.name}</p>
                    <p className="text-xs text-muted mt-0.5">
                      {MUSCLE_LABELS[ex.primaryMuscle]}
                      {ex.perSide ? ' · per side' : ''}
                      {ex.compound ? ' · compound' : ''}
                    </p>
                    {gone && (
                      <p className="text-xs text-warn mt-1">
                        Needs equipment that's turned off in Settings.
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 gap-1">
                    <IconBtn label="Move up" onClick={() => move(i, i - 1)}>
                      <ChevronDown size={16} className="rotate-180" />
                    </IconBtn>
                    <IconBtn label="Move down" onClick={() => move(i, i + 1)}>
                      <ChevronDown size={16} />
                    </IconBtn>
                    <IconBtn label="Swap" onClick={() => setSwapIndex(i)}>
                      <SwapIcon size={16} />
                    </IconBtn>
                    <IconBtn
                      label="Remove"
                      onClick={() => setPlan(plan.filter((_, x) => x !== i))}
                    >
                      <TrashIcon size={16} />
                    </IconBtn>
                  </div>
                </div>

                {/* sets × reps controls */}
                <div className="flex items-center gap-3 mt-3 pl-8">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] uppercase tracking-wider text-muted w-8">
                      Sets
                    </span>
                    <MiniStep
                      value={item.targetSets}
                      min={1}
                      max={10}
                      onChange={(v) =>
                        setPlan(
                          plan.map((p, x) => (x === i ? { ...p, targetSets: v } : p)),
                        )
                      }
                    />
                  </div>
                  <span className="text-sm text-muted tabular-nums">
                    × {item.repRange[0]}–{item.repRange[1]}{' '}
                    {ex.type === 'cardio' ? 'min' : 'reps'}
                  </span>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* ---------------- Start ---------------- */}
      {plan.length > 0 && (
        <Button
          variant="primary"
          size="lg"
          full
          disabled={starting}
          onClick={start}
          className="animate-glow"
        >
          <PlayIcon size={20} /> Start workout
        </Button>
      )}

      {/* ---------------- Generator sheet ---------------- */}
      <Sheet open={genOpen} onClose={() => setGenOpen(false)} title="Generate workout">
        <p className="text-sm text-muted mb-3">
          Target muscles — leave empty for full body.
        </p>
        <div className="flex flex-wrap gap-2">
          {MUSCLE_GROUPS.map((m) => (
            <Chip
              key={m}
              active={muscles.includes(m)}
              onClick={() =>
                setMuscles(
                  muscles.includes(m)
                    ? muscles.filter((x) => x !== m)
                    : [...muscles, m],
                )
              }
            >
              {MUSCLE_LABELS[m]}
            </Chip>
          ))}
        </div>

        <p className="text-sm text-muted mt-6 mb-3">Length</p>
        <div className="flex gap-2">
          {SIZES.map((s) => (
            <Chip key={s} active={size === s} onClick={() => setSize(s)} className="flex-1">
              {SIZE_LABELS[s]} · {SIZE_COUNTS[s]}
            </Chip>
          ))}
        </div>

        <p className="text-xs text-muted mt-5 leading-relaxed">
          Only exercises your enabled equipment supports are used. Compounds come
          first, and movements you've done recently are pushed down the list, so
          you get something different each time.
        </p>

        <Button variant="primary" size="lg" full className="mt-5" onClick={runGenerator}>
          Generate
        </Button>
      </Sheet>

      {/* ---------------- Add exercise ---------------- */}
      <ExercisePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        exclude={plan.map((p) => p.exerciseId)}
        onPick={(ex) =>
          setPlan([
            ...plan,
            { exerciseId: ex.id, targetSets: ex.defaultSets, repRange: ex.repRange },
          ])
        }
      />

      {/* ---------------- Swap ---------------- */}
      <SwapSheet
        index={swapIndex}
        plan={plan}
        exercises={exercises}
        onClose={() => setSwapIndex(null)}
        onPick={(ex) => {
          if (swapIndex === null) return
          setPlan(
            plan.map((p, i) =>
              i === swapIndex
                ? { exerciseId: ex.id, targetSets: ex.defaultSets, repRange: ex.repRange }
                : p,
            ),
          )
          setSwapIndex(null)
        }}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ bits */

function IconBtn({
  children,
  onClick,
  label,
}: {
  children: React.ReactNode
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="h-9 w-9 rounded-lg bg-surface-2 text-muted grid place-items-center active:bg-line active:text-fg"
    >
      {children}
    </button>
  )
}

function MiniStep({
  value,
  onChange,
  min,
  max,
}: {
  value: number
  onChange: (v: number) => void
  min: number
  max: number
}) {
  return (
    <div className="flex items-center">
      <button
        className="h-9 w-9 rounded-l-lg bg-surface-2 border border-line grid place-items-center font-bold active:bg-line disabled:opacity-30"
        disabled={value <= min}
        onClick={() => onChange(value - 1)}
        aria-label="Fewer sets"
      >
        −
      </button>
      <span className="h-9 w-9 bg-surface-2 border-y border-line grid place-items-center font-bold tabular-nums">
        {value}
      </span>
      <button
        className="h-9 w-9 rounded-r-lg bg-surface-2 border border-line grid place-items-center font-bold active:bg-line disabled:opacity-30"
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
        aria-label="More sets"
      >
        +
      </button>
    </div>
  )
}

function SwapSheet({
  index,
  plan,
  exercises,
  onClose,
  onPick,
}: {
  index: number | null
  plan: PlanItem[]
  exercises: Exercise[]
  onClose: () => void
  onPick: (ex: Exercise) => void
}) {
  const { equipment } = useApp()
  const current =
    index === null ? undefined : exercises.find((e) => e.id === plan[index]?.exerciseId)

  const candidates = useMemo(() => {
    if (!current) return []
    return swapCandidates(
      current,
      plan.map((p) => p.exerciseId),
      exercises,
      equipment,
    )
  }, [current, plan, exercises, equipment])

  return (
    <Sheet
      open={index !== null && !!current}
      onClose={onClose}
      title={current ? `Swap ${current.name}` : 'Swap'}
    >
      {candidates.length === 0 ? (
        <p className="text-muted text-sm py-6 text-center">
          No other available exercise hits that muscle. Enable more equipment in
          Settings for more options.
        </p>
      ) : (
        <div className="space-y-1.5">
          {candidates.map((e) => (
            <button
              key={e.id}
              onClick={() => onPick(e)}
              className="w-full text-left p-3 rounded-xl bg-surface-2 active:bg-line"
            >
              <p className="font-semibold">{e.name}</p>
              <p className="text-xs text-muted tabular-nums">
                {e.defaultSets} × {e.repRange[0]}–{e.repRange[1]}
                {e.compound ? ' · compound' : ''}
              </p>
            </button>
          ))}
        </div>
      )}
    </Sheet>
  )
}
