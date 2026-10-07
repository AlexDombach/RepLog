import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { useApp } from '../state/AppContext'
import type { LoggedSet, PersonalRecord, Session, SessionExercise } from '../db/types'
import { MUSCLE_LABELS } from '../db/types'
import { Button, Card, Sheet, Stepper, cx } from '../components/ui'
import ExercisePicker from '../components/ExercisePicker'
import RestTimer, { useRestTimer } from '../components/RestTimer'
import {
  CheckIcon,
  ChevronLeft,
  PlusIcon,
  TrashIcon,
  TrophyIcon,
} from '../components/Icons'
import { formatElapsed } from '../lib/date'
import { epley } from '../lib/xp'
import { lastPerformance } from '../lib/stats'
import { beepFinish, beepPr, beepSetDone, unlockAudio } from '../lib/feedback'
import { buildSets, discardSession, finishSession, type FinishResult } from '../lib/session'

/** Weight step: 2.5 lb / 1 kg matches the smallest plate jump in most gyms. */
const weightStep = (units: 'lb' | 'kg') => (units === 'lb' ? 2.5 : 1)

export default function ActiveSession() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const { profile, exercises } = useApp()
  const nav = useNavigate()

  const session = useLiveQuery(
    () => (sessionId ? db.sessions.get(sessionId) : undefined),
    [sessionId],
  )
  const history = useLiveQuery(
    () => (profile ? db.sessions.where({ profileId: profile.id }).toArray() : []),
    [profile?.id],
    [] as Session[],
  )
  const prs = useLiveQuery(
    () => (profile ? db.prs.where({ profileId: profile.id }).toArray() : []),
    [profile?.id],
    [] as PersonalRecord[],
  )
  const prById = useMemo(() => new Map(prs.map((p) => [p.exerciseId, p])), [prs])

  /**
   * Both profiles share one phone, so the header switcher can be tapped while
   * someone else's workout is on screen. The sets would still save to the
   * session's real owner, but it invites logging into the wrong person's
   * workout — so bounce to your own home instead. Their session stays active
   * and is resumable from there.
   */
  useEffect(() => {
    if (session && profile && session.profileId !== profile.id) {
      nav('/', { replace: true })
    }
  }, [session, profile, nav])

  const timer = useRestTimer({
    sound: profile?.soundEnabled ?? true,
    haptic: profile?.vibrationEnabled ?? true,
  })

  const [addOpen, setAddOpen] = useState(false)
  const [confirmFinish, setConfirmFinish] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [result, setResult] = useState<FinishResult | null>(null)
  const [prFlash, setPrFlash] = useState<string | null>(null)
  const [elapsedNonce, setElapsedNonce] = useState(0)

  // Re-render the header clock once a minute.
  useEffect(() => {
    const id = setInterval(() => setElapsedNonce((n) => n + 1), 30_000)
    return () => clearInterval(id)
  }, [])
  void elapsedNonce

  /** Patch one exercise's sets in place. */
  const patch = useCallback(
    async (exIndex: number, mutate: (ex: SessionExercise) => SessionExercise) => {
      if (!session) return
      const exercises = session.exercises.map((e, i) => (i === exIndex ? mutate(e) : e))
      await db.sessions.update(session.id, { exercises })
    },
    [session],
  )

  const setField = (exIndex: number, setIndex: number, patchSet: Partial<LoggedSet>) =>
    patch(exIndex, (e) => ({
      ...e,
      sets: e.sets.map((s, i) => (i === setIndex ? { ...s, ...patchSet } : s)),
    }))

  /** Mark a set done: fire haptics, start rest, and flash a PR if it's one. */
  async function toggleDone(exIndex: number, setIndex: number) {
    if (!session || !profile) return
    const ex = session.exercises[exIndex]
    const set = ex.sets[setIndex]
    const nowDone = !set.done

    unlockAudio()
    await setField(exIndex, setIndex, { done: nowDone })

    if (!nowDone) return

    beepSetDone(profile.soundEnabled, profile.vibrationEnabled)
    timer.start(profile.restSeconds)

    // Live PR check against the stored best (so you see it the moment it lands).
    const best = prById.get(ex.exerciseId)
    const beatsWeight = set.weight > 0 && set.weight > (best?.bestWeight ?? 0)
    const beatsE1rm =
      set.weight > 0 && epley(set.weight, set.reps) > (best?.bestE1rm ?? 0) + 0.01
    const beatsReps = set.weight === 0 && set.reps > (best?.bestReps ?? 0)
    if (beatsWeight || beatsE1rm || beatsReps) {
      setPrFlash(ex.name)
      beepPr(profile.soundEnabled, profile.vibrationEnabled)
      setTimeout(() => setPrFlash(null), 2200)
    }
  }

  async function addSet(exIndex: number) {
    await patch(exIndex, (e) => {
      const last = e.sets[e.sets.length - 1]
      return {
        ...e,
        sets: [...e.sets, { ...(last ?? { reps: e.repRange[0], weight: 0 }), done: false }],
        targetSets: Math.max(e.targetSets, e.sets.length + 1),
      }
    })
  }

  async function removeSet(exIndex: number, setIndex: number) {
    await patch(exIndex, (e) => ({
      ...e,
      sets: e.sets.filter((_, i) => i !== setIndex),
    }))
  }

  async function removeExercise(exIndex: number) {
    if (!session) return
    await db.sessions.update(session.id, {
      exercises: session.exercises.filter((_, i) => i !== exIndex),
    })
  }

  async function doFinish() {
    if (!session) return
    timer.stop()
    const r = await finishSession(session.id)
    setConfirmFinish(false)
    if (r) {
      setResult(r)
      beepFinish(profile!.soundEnabled, profile!.vibrationEnabled)
    } else {
      nav('/', { replace: true })
    }
  }

  // ------------------------------------------------------------------ render

  if (session === undefined) {
    return <div className="p-8 text-center text-muted">Loading…</div>
  }
  if (session === null || !session) {
    return (
      <div className="p-8 text-center">
        <p className="font-bold">That workout is gone.</p>
        <Button className="mt-4" onClick={() => nav('/workout')}>
          Back to Workout
        </Button>
      </div>
    )
  }

  const totalSets = session.exercises.reduce((n, e) => n + e.sets.length, 0)
  const doneSets = session.exercises.reduce(
    (n, e) => n + e.sets.filter((s) => s.done).length,
    0,
  )
  const pct = totalSets ? doneSets / totalSets : 0

  return (
    <div className="pb-4">
      {/* ---------------- Sticky session header ---------------- */}
      <div className="sticky top-0 z-10 bg-ink/90 backdrop-blur-xl border-b border-line">
        <div className="px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => nav('/workout')}
            aria-label="Back"
            className="h-10 w-10 -ml-2 rounded-xl grid place-items-center text-muted active:bg-surface-2"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <p className="font-bold truncate leading-tight">{session.title}</p>
            <p className="text-xs text-muted tabular-nums">
              {formatElapsed(Date.now() - session.startedAt)} · {doneSets}/{totalSets} sets
            </p>
          </div>
          <Button size="sm" variant="primary" onClick={() => setConfirmFinish(true)}>
            Finish
          </Button>
        </div>
        <div className="h-1 bg-surface-2">
          <div
            className="h-full bg-accent transition-[width] duration-300"
            style={{ width: `${pct * 100}%` }}
          />
        </div>
      </div>

      {/* ---------------- Rest timer ---------------- */}
      {timer.active && (
        <div className="px-4 pt-3 sticky top-[72px] z-10">
          <RestTimer timer={timer} />
        </div>
      )}

      {/* ---------------- Exercises ---------------- */}
      <div className="px-4 pt-3 space-y-3">
        {session.exercises.map((ex, exIndex) => {
          const lib = exercises.find((e) => e.id === ex.exerciseId)
          const last = lastPerformance(
            history.filter((s) => s.id !== session.id),
            ex.exerciseId,
          )
          const best = prById.get(ex.exerciseId)
          const allDone = ex.sets.length > 0 && ex.sets.every((s) => s.done)
          const isCardio = lib?.type === 'cardio'

          return (
            <Card
              key={`${ex.exerciseId}-${exIndex}`}
              className={cx('overflow-hidden', allDone && 'border-accent/40')}
            >
              {/* exercise header */}
              <div className="p-4 pb-3">
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold leading-tight">{ex.name}</h3>
                    <p className="text-xs text-muted mt-0.5">
                      {MUSCLE_LABELS[ex.primaryMuscle]} · target {ex.targetSets} ×{' '}
                      {ex.repRange[0]}–{ex.repRange[1]}
                      {isCardio ? ' min' : ''}
                      {lib?.perSide ? ' · per side' : ''}
                    </p>
                  </div>
                  {allDone && <CheckIcon size={20} className="text-accent shrink-0 mt-0.5" />}
                  <button
                    aria-label="Remove exercise"
                    onClick={() => removeExercise(exIndex)}
                    className="h-8 w-8 shrink-0 rounded-lg grid place-items-center text-muted/60 active:bg-surface-2 active:text-danger"
                  >
                    <TrashIcon size={15} />
                  </button>
                </div>

                {/* reference lines */}
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs">
                  {last ? (
                    <span className="text-muted tabular-nums">
                      Last time:{' '}
                      <span className="text-fg font-semibold">
                        {last.sets}×{last.reps}
                        {last.weight > 0 ? ` @ ${last.weight} ${session.units}` : ''}
                      </span>
                    </span>
                  ) : (
                    <span className="text-muted">First time — set your baseline.</span>
                  )}
                  {best && best.bestWeight > 0 && (
                    <span className="text-muted tabular-nums">
                      PR:{' '}
                      <span className="text-accent font-semibold">
                        {best.bestWeight} {session.units}
                      </span>
                    </span>
                  )}
                </div>

                {lib?.instructions && (
                  <details className="mt-2 group">
                    <summary className="text-xs text-accent font-semibold list-none cursor-pointer select-none">
                      Form cue
                    </summary>
                    <p className="text-xs text-muted leading-relaxed mt-1.5">
                      {lib.instructions}
                    </p>
                    {lib.tip && (
                      <p className="text-xs text-fg/80 leading-relaxed mt-1.5 italic">
                        {lib.tip}
                      </p>
                    )}
                  </details>
                )}
              </div>

              {/* set rows */}
              <div className="border-t border-line divide-y divide-line">
                {ex.sets.map((set, setIndex) => (
                  <SetRow
                    key={setIndex}
                    index={setIndex}
                    set={set}
                    units={session.units}
                    cardio={isCardio}
                    onReps={(v) => setField(exIndex, setIndex, { reps: v })}
                    onWeight={(v) => setField(exIndex, setIndex, { weight: v })}
                    onSeconds={(v) => setField(exIndex, setIndex, { seconds: v })}
                    onToggle={() => toggleDone(exIndex, setIndex)}
                    onRemove={
                      ex.sets.length > 1 ? () => removeSet(exIndex, setIndex) : undefined
                    }
                  />
                ))}
              </div>

              <button
                onClick={() => addSet(exIndex)}
                className="w-full py-3 text-sm font-semibold text-muted border-t border-line active:bg-surface-2 active:text-fg flex items-center justify-center gap-1.5"
              >
                <PlusIcon size={15} /> Add set
              </button>
            </Card>
          )
        })}

        <Button full onClick={() => setAddOpen(true)}>
          <PlusIcon size={18} /> Add exercise
        </Button>

        <Button
          variant="ghost"
          full
          size="sm"
          className="mt-2"
          onClick={() => setConfirmDiscard(true)}
        >
          Discard workout
        </Button>
      </div>

      {/* ---------------- PR toast ---------------- */}
      {prFlash && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-24 z-40 animate-rise">
          <div className="flex items-center gap-2.5 px-5 py-3 rounded-2xl bg-accent text-accent-ink shadow-2xl animate-pop">
            <TrophyIcon size={20} />
            <div>
              <p className="font-black leading-tight">New PR!</p>
              <p className="text-xs font-semibold opacity-80 leading-tight">{prFlash}</p>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- Add exercise ---------------- */}
      <ExercisePicker
        open={addOpen}
        onClose={() => setAddOpen(false)}
        exclude={session.exercises.map((e) => e.exerciseId)}
        onPick={async (ex) => {
          await db.sessions.update(session.id, {
            exercises: [
              ...session.exercises,
              {
                exerciseId: ex.id,
                name: ex.name,
                primaryMuscle: ex.primaryMuscle,
                targetSets: ex.defaultSets,
                repRange: ex.repRange,
                sets: buildSets(ex, ex.defaultSets, history),
              },
            ],
          })
        }}
      />

      {/* ---------------- Confirm finish ---------------- */}
      <Sheet
        open={confirmFinish}
        onClose={() => setConfirmFinish(false)}
        title="Finish workout?"
      >
        <p className="text-muted text-sm leading-relaxed">
          {doneSets === 0
            ? "You haven't marked any sets done yet — finishing now would save an empty workout."
            : `${doneSets} completed set${doneSets === 1 ? '' : 's'} will be saved. Unchecked sets are dropped.`}
        </p>
        <Button
          variant="primary"
          size="lg"
          full
          className="mt-5"
          disabled={doneSets === 0}
          onClick={doFinish}
        >
          Finish & save
        </Button>
        <Button variant="ghost" full className="mt-2" onClick={() => setConfirmFinish(false)}>
          Keep going
        </Button>
      </Sheet>

      {/* ---------------- Confirm discard ---------------- */}
      <Sheet
        open={confirmDiscard}
        onClose={() => setConfirmDiscard(false)}
        title="Discard this workout?"
      >
        <p className="text-muted text-sm leading-relaxed">
          Everything logged in this session will be deleted. This can't be undone.
        </p>
        <Button
          variant="danger"
          size="lg"
          full
          className="mt-5"
          onClick={async () => {
            await discardSession(session.id)
            nav('/workout', { replace: true })
          }}
        >
          Discard
        </Button>
        <Button variant="ghost" full className="mt-2" onClick={() => setConfirmDiscard(false)}>
          Cancel
        </Button>
      </Sheet>

      {/* ---------------- Completion ---------------- */}
      {result && <CompletionSheet result={result} onClose={() => nav('/', { replace: true })} />}
    </div>
  )
}

/* ------------------------------------------------------------------ SetRow */

function SetRow({
  index,
  set,
  units,
  cardio,
  onReps,
  onWeight,
  onSeconds,
  onToggle,
  onRemove,
}: {
  index: number
  set: LoggedSet
  units: 'lb' | 'kg'
  cardio: boolean
  onReps: (v: number) => void
  onWeight: (v: number) => void
  onSeconds: (v: number) => void
  onToggle: () => void
  onRemove?: () => void
}) {
  const holdRef = useRef<number | null>(null)

  return (
    <div
      className={cx(
        'px-3 py-2.5 flex items-center gap-2 transition-colors',
        set.done && 'bg-accent/8',
      )}
    >
      {/* set number — press and hold to delete the row */}
      <button
        className="h-9 w-7 shrink-0 text-xs font-bold text-muted tabular-nums grid place-items-center"
        onPointerDown={() => {
          if (!onRemove) return
          holdRef.current = window.setTimeout(onRemove, 650)
        }}
        onPointerUp={() => holdRef.current && clearTimeout(holdRef.current)}
        onPointerLeave={() => holdRef.current && clearTimeout(holdRef.current)}
        title={onRemove ? 'Hold to delete set' : undefined}
      >
        {index + 1}
      </button>

      {cardio ? (
        <div className="flex-1 min-w-0">
          <Stepper
            value={Math.round((set.seconds ?? 0) / 60)}
            onChange={(v) => onSeconds(v * 60)}
            step={1}
            min={0}
            max={180}
            suffix="min"
            aria-label="Minutes"
          />
        </div>
      ) : (
        <>
          <div className="flex-1 min-w-0">
            <Stepper
              value={set.reps}
              onChange={onReps}
              step={1}
              min={0}
              max={100}
              suffix="reps"
              aria-label="Reps"
            />
          </div>
          <div className="flex-1 min-w-0">
            <Stepper
              value={set.weight}
              onChange={onWeight}
              step={weightStep(units)}
              min={0}
              max={600}
              decimals={1}
              suffix={units}
              aria-label="Weight"
            />
          </div>
        </>
      )}

      <button
        onClick={onToggle}
        aria-label={set.done ? 'Mark set not done' : 'Mark set done'}
        aria-pressed={set.done}
        className={cx(
          'h-12 w-12 shrink-0 rounded-xl grid place-items-center border transition-colors',
          set.done
            ? 'bg-accent border-accent text-accent-ink animate-pop'
            : 'bg-surface-2 border-line text-muted active:bg-line',
        )}
      >
        <CheckIcon size={22} />
      </button>
    </div>
  )
}

/* -------------------------------------------------------- CompletionSheet */

function CompletionSheet({
  result,
  onClose,
}: {
  result: FinishResult
  onClose: () => void
}) {
  const leveled = result.levelAfter > result.levelBefore
  const sets = result.session.exercises.reduce((n, e) => n + e.sets.length, 0)

  return (
    <Sheet open onClose={onClose} title="">
      <div className="text-center pt-2 pb-2">
        <div className="mx-auto h-20 w-20 rounded-full bg-accent text-accent-ink grid place-items-center animate-pop">
          <CheckIcon size={40} />
        </div>
        <h2 className="text-3xl font-black mt-4 tracking-tight">Workout complete</h2>
        <p className="text-muted mt-1">{result.session.title}</p>

        <div className="flex gap-3 mt-6">
          <div className="flex-1 rounded-2xl bg-surface-2 p-4">
            <div className="text-3xl font-black text-accent tabular-nums leading-none">
              +{result.xpGained}
            </div>
            <div className="text-[10px] uppercase tracking-widest text-muted mt-1.5">
              XP earned
            </div>
          </div>
          <div className="flex-1 rounded-2xl bg-surface-2 p-4">
            <div className="text-3xl font-black tabular-nums leading-none">{sets}</div>
            <div className="text-[10px] uppercase tracking-widest text-muted mt-1.5">
              Sets logged
            </div>
          </div>
        </div>

        {leveled && (
          <div className="mt-3 rounded-2xl bg-accent/15 border border-accent/40 p-4 animate-pop">
            <p className="text-accent font-black text-lg">
              Level {result.levelAfter} unlocked
            </p>
          </div>
        )}

        {result.newPrs.length > 0 && (
          <div className="mt-3 rounded-2xl bg-surface-2 p-4 text-left">
            <p className="flex items-center gap-2 font-bold text-accent">
              <TrophyIcon size={18} />
              {result.newPrs.length} new personal record
              {result.newPrs.length === 1 ? '' : 's'}
            </p>
            <ul className="mt-2 space-y-0.5">
              {result.newPrs.map((id) => {
                const e = result.session.exercises.find((x) => x.exerciseId === id)
                return (
                  <li key={id} className="text-sm text-muted">
                    {e?.name ?? id}
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        <Button variant="primary" size="lg" full className="mt-6" onClick={onClose}>
          Done
        </Button>
      </div>
    </Sheet>
  )
}
