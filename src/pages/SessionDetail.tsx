import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { useApp } from '../state/AppContext'
import { MUSCLE_LABELS } from '../db/types'
import { Button, Card, Sheet, cx } from '../components/ui'
import { ChevronLeft, TrashIcon, TrophyIcon } from '../components/Icons'
import { completedSetCount, sessionVolume } from '../lib/stats'
import { formatDate, formatElapsed, formatTime } from '../lib/date'
import { rebuildPrs } from '../lib/session'

export default function SessionDetail() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const { profile } = useApp()
  const nav = useNavigate()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const session = useLiveQuery(
    () => (sessionId ? db.sessions.get(sessionId) : undefined),
    [sessionId],
  )

  if (session === undefined) {
    return <div className="p-8 text-center text-muted">Loading…</div>
  }
  if (!session) {
    return (
      <div className="p-8 text-center">
        <p className="font-bold">Workout not found.</p>
        <Button className="mt-4" onClick={() => nav('/history')}>
          Back to History
        </Button>
      </div>
    )
  }

  const prs = new Set(session.prs)
  const duration = session.finishedAt ? session.finishedAt - session.startedAt : 0

  /**
   * Deleting a session rolls back the XP it awarded and rebuilds the PR table
   * from the remaining history, so the dashboard never shows phantom numbers.
   */
  async function deleteSession() {
    if (!profile || !session) return
    await db.sessions.delete(session.id)
    await db.profiles.update(profile.id, {
      xp: Math.max(0, profile.xp - session.xpAwarded),
    })
    await rebuildPrs(profile.id)
    nav('/history', { replace: true })
  }

  return (
    <div className="px-4 pt-3 space-y-3">
      <div className="flex items-center gap-2">
        <button
          onClick={() => nav(-1)}
          aria-label="Back"
          className="h-10 w-10 -ml-2 rounded-xl grid place-items-center text-muted active:bg-surface-2"
        >
          <ChevronLeft size={20} />
        </button>
        <span className="text-sm text-muted">Back</span>
        <div className="flex-1" />
        <button
          onClick={() => setConfirmDelete(true)}
          aria-label="Delete workout"
          className="h-10 w-10 rounded-xl grid place-items-center text-muted active:bg-surface-2 active:text-danger"
        >
          <TrashIcon size={18} />
        </button>
      </div>

      {/* ---------------- Summary ---------------- */}
      <Card className="p-5">
        <h1 className="text-2xl font-black tracking-tight">{session.title}</h1>
        <p className="text-sm text-muted mt-1 tabular-nums">
          {formatDate(session.startedAt)} · {formatTime(session.startedAt)}
          {duration > 0 && ` · ${formatElapsed(duration)}`}
          {session.status === 'active' && ' · in progress'}
        </p>

        <div className="flex gap-3 mt-5">
          <Summary value={session.exercises.length} label="Exercises" />
          <Summary value={completedSetCount(session)} label="Sets" />
          <Summary
            value={Math.round(sessionVolume(session)).toLocaleString()}
            label={`Volume (${session.units})`}
          />
          <Summary value={`+${session.xpAwarded}`} label="XP" accent />
        </div>
      </Card>

      {/* ---------------- Exercises ---------------- */}
      {session.exercises.map((ex, i) => (
        <Card key={`${ex.exerciseId}-${i}`} className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="font-bold leading-tight">{ex.name}</h2>
              <p className="text-xs text-muted mt-0.5">
                {MUSCLE_LABELS[ex.primaryMuscle]}
              </p>
            </div>
            {prs.has(ex.exerciseId) && (
              <span className="shrink-0 flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-full bg-accent/15 text-accent">
                <TrophyIcon size={12} /> PR
              </span>
            )}
          </div>

          <div className="mt-3 space-y-1">
            {ex.sets.map((s, si) => (
              <div
                key={si}
                className="flex items-center gap-3 text-sm py-1.5 px-2.5 rounded-lg bg-surface-2 tabular-nums"
              >
                <span className="w-5 text-xs font-bold text-muted">{si + 1}</span>
                {s.seconds !== undefined ? (
                  <span className="font-semibold">{Math.round(s.seconds / 60)} min</span>
                ) : (
                  <>
                    <span className="font-semibold">{s.reps} reps</span>
                    {s.weight > 0 && (
                      <span className="text-muted">
                        @ {s.weight} {session.units}
                      </span>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </Card>
      ))}

      {/* ---------------- Delete ---------------- */}
      <Sheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this workout?"
      >
        <p className="text-sm text-muted leading-relaxed">
          It'll be removed from your history and heatmap, the {session.xpAwarded} XP it
          awarded will be taken back, and your PRs will be recalculated from what's
          left. This can't be undone.
        </p>
        <Button variant="danger" size="lg" full className="mt-5" onClick={deleteSession}>
          Delete workout
        </Button>
        <Button variant="ghost" full className="mt-2" onClick={() => setConfirmDelete(false)}>
          Cancel
        </Button>
      </Sheet>
    </div>
  )
}

function Summary({
  value,
  label,
  accent,
}: {
  value: React.ReactNode
  label: string
  accent?: boolean
}) {
  return (
    <div className="min-w-0 flex-1">
      <div
        className={cx(
          'text-xl font-bold tabular-nums leading-none truncate',
          accent && 'text-accent',
        )}
      >
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-wider text-muted mt-1 truncate">
        {label}
      </div>
    </div>
  )
}
