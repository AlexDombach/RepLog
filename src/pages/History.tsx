import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { useApp } from '../state/AppContext'
import type { MuscleGroup, PersonalRecord, Session } from '../db/types'
import { MUSCLE_LABELS } from '../db/types'
import { Card, Chip, EmptyState, Sheet, cx } from '../components/ui'
import Heatmap, { HeatmapLegend } from '../components/Heatmap'
import { HistoryIcon, TrophyIcon } from '../components/Icons'
import {
  completedSetCount,
  currentStreak,
  longestStreak,
  sessionVolume,
  volumeByMuscle,
  workoutDays,
} from '../lib/stats'
import { formatRelativeDate, formatTime, startOfWeek } from '../lib/date'

type Tab = 'sessions' | 'volume' | 'prs'

export default function History() {
  const { profile, exercises } = useApp()
  const nav = useNavigate()
  const pid = profile!.id
  const [tab, setTab] = useState<Tab>('sessions')
  const [dayPick, setDayPick] = useState<{ key: string; list: Session[] } | null>(null)

  const sessions = useLiveQuery(
    () => db.sessions.where({ profileId: pid }).toArray(),
    [pid],
    [] as Session[],
  )
  const prs = useLiveQuery(
    () => db.prs.where({ profileId: pid }).toArray(),
    [pid],
    [] as PersonalRecord[],
  )

  const complete = useMemo(
    () =>
      sessions
        .filter((s) => s.status === 'complete')
        .sort((a, b) => b.startedAt - a.startedAt),
    [sessions],
  )
  const days = useMemo(() => workoutDays(sessions), [sessions])

  return (
    <div className="px-4 pt-4 space-y-4">
      {/* ---------------- Heatmap ---------------- */}
      <Card className="p-4">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="font-bold">Consistency</h2>
          <span className="text-xs text-muted tabular-nums">
            {days.length} day{days.length === 1 ? '' : 's'} trained
          </span>
        </div>
        <Heatmap
          sessions={sessions}
          weeks={17}
          onPickDay={(key, list) => list.length && setDayPick({ key, list })}
        />
        <div className="flex items-center justify-between mt-3">
          <HeatmapLegend />
          <span className="text-xs text-muted tabular-nums">
            {currentStreak(days)} now · {longestStreak(days)} best
          </span>
        </div>
      </Card>

      {/* ---------------- Tabs ---------------- */}
      <div className="flex gap-2">
        <Chip active={tab === 'sessions'} onClick={() => setTab('sessions')} className="flex-1">
          Sessions
        </Chip>
        <Chip active={tab === 'volume'} onClick={() => setTab('volume')} className="flex-1">
          Volume
        </Chip>
        <Chip active={tab === 'prs'} onClick={() => setTab('prs')} className="flex-1">
          PRs
        </Chip>
      </div>

      {tab === 'sessions' && <SessionList sessions={complete} onOpen={(id) => nav(`/history/${id}`)} />}
      {tab === 'volume' && <VolumePanel sessions={complete} />}
      {tab === 'prs' && (
        <PrPanel
          prs={prs}
          units={profile!.units}
          nameFor={(id) =>
            exercises.find((e) => e.id === id)?.name ??
            complete
              .flatMap((s) => s.exercises)
              .find((e) => e.exerciseId === id)?.name ??
            id
          }
        />
      )}

      {/* ---------------- Day picker ---------------- */}
      <Sheet
        open={dayPick !== null}
        onClose={() => setDayPick(null)}
        title={dayPick ? formatRelativeDate(dayPick.key) : ''}
      >
        <div className="space-y-2">
          {dayPick?.list.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                setDayPick(null)
                nav(`/history/${s.id}`)
              }}
              className="w-full text-left p-3 rounded-xl bg-surface-2 active:bg-line"
            >
              <p className="font-bold">{s.title}</p>
              <p className="text-xs text-muted tabular-nums">
                {formatTime(s.startedAt)} · {completedSetCount(s)} sets · +{s.xpAwarded} XP
              </p>
            </button>
          ))}
        </div>
      </Sheet>
    </div>
  )
}

/* ------------------------------------------------------------- Session list */

function SessionList({
  sessions,
  onOpen,
}: {
  sessions: Session[]
  onOpen: (id: string) => void
}) {
  if (sessions.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<HistoryIcon size={40} />}
          title="No sessions yet"
          body="Finished workouts land here with every set you logged."
        />
      </Card>
    )
  }
  return (
    <div className="space-y-2">
      {sessions.map((s) => (
        <Card key={s.id} className="active:bg-surface-2">
          <button onClick={() => onOpen(s.id)} className="w-full text-left p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-bold truncate">{s.title}</p>
                <p className="text-xs text-muted mt-0.5 tabular-nums">
                  {formatRelativeDate(s.dateKey)} · {formatTime(s.startedAt)}
                </p>
              </div>
              <span className="shrink-0 text-sm font-bold text-accent tabular-nums">
                +{s.xpAwarded} XP
              </span>
            </div>
            <div className="flex gap-4 mt-3 text-xs text-muted tabular-nums">
              <span>
                <span className="text-fg font-semibold">{s.exercises.length}</span> exercises
              </span>
              <span>
                <span className="text-fg font-semibold">{completedSetCount(s)}</span> sets
              </span>
              {sessionVolume(s) > 0 && (
                <span>
                  <span className="text-fg font-semibold">
                    {Math.round(sessionVolume(s)).toLocaleString()}
                  </span>{' '}
                  {s.units} volume
                </span>
              )}
              {s.prs.length > 0 && (
                <span className="text-accent font-semibold">{s.prs.length} PR</span>
              )}
            </div>
          </button>
        </Card>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------ Volume panel */

function VolumePanel({ sessions }: { sessions: Session[] }) {
  const [range, setRange] = useState<'week' | 'month' | 'all'>('week')

  const filtered = useMemo(() => {
    if (range === 'all') return sessions
    const from =
      range === 'week'
        ? startOfWeek().getTime()
        : Date.now() - 30 * 86_400_000
    return sessions.filter((s) => s.startedAt >= from)
  }, [sessions, range])

  const volume = useMemo(() => volumeByMuscle(filtered), [filtered])
  const entries = useMemo(
    () =>
      (Object.entries(volume) as Array<[MuscleGroup, number]>).sort(
        (a, b) => b[1] - a[1],
      ),
    [volume],
  )
  const max = entries.length ? entries[0][1] : 0
  const total = entries.reduce((n, [, v]) => n + v, 0)

  return (
    <Card className="p-4">
      <div className="flex gap-2 mb-4">
        {(['week', 'month', 'all'] as const).map((r) => (
          <Chip key={r} active={range === r} onClick={() => setRange(r)} className="flex-1">
            {r === 'week' ? 'This week' : r === 'month' ? '30 days' : 'All time'}
          </Chip>
        ))}
      </div>

      {entries.length === 0 ? (
        <EmptyState title="No sets yet" body="Log a workout to see how your volume splits across muscle groups." />
      ) : (
        <>
          <p className="text-xs text-muted mb-3 tabular-nums">
            <span className="text-fg font-semibold">{total}</span> working sets across{' '}
            <span className="text-fg font-semibold">{filtered.length}</span> session
            {filtered.length === 1 ? '' : 's'}
          </p>
          <div className="space-y-2.5">
            {entries.map(([m, v]) => (
              <div key={m}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium">{MUSCLE_LABELS[m]}</span>
                  <span className="text-muted tabular-nums">{v} sets</span>
                </div>
                <div className="h-2.5 rounded-full bg-surface-2 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-accent transition-[width] duration-500"
                    style={{ width: `${max ? (v / max) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  )
}

/* ---------------------------------------------------------------- PR panel */

function PrPanel({
  prs,
  units,
  nameFor,
}: {
  prs: PersonalRecord[]
  units: 'lb' | 'kg'
  nameFor: (exerciseId: string) => string
}) {
  const sorted = useMemo(
    () => [...prs].sort((a, b) => b.bestE1rm - a.bestE1rm || b.updatedAt - a.updatedAt),
    [prs],
  )

  if (sorted.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<TrophyIcon size={40} />}
          title="No PRs yet"
          body="Your best weight, best reps and estimated 1RM get tracked automatically for every exercise."
        />
      </Card>
    )
  }

  return (
    <div className="space-y-2">
      {sorted.map((p) => (
        <Card key={p.id} className="p-4">
          <p className="font-bold">{nameFor(p.exerciseId)}</p>
          <div className="flex gap-5 mt-2.5">
            <PrStat label="Best weight" value={p.bestWeight > 0 ? `${p.bestWeight} ${units}` : '—'} />
            <PrStat label="Best reps" value={String(p.bestReps)} />
            <PrStat
              label="Est. 1RM"
              value={p.bestE1rm > 0 ? `${Math.round(p.bestE1rm)} ${units}` : '—'}
              accent
            />
          </div>
        </Card>
      ))}
    </div>
  )
}

function PrStat({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div>
      <div
        className={cx('text-xl font-bold tabular-nums leading-none', accent && 'text-accent')}
      >
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-wider text-muted mt-1">{label}</div>
    </div>
  )
}
