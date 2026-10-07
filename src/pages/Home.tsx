import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { useApp } from '../state/AppContext'
import type { Session } from '../db/types'
import { Button, Card, EmptyState, Stat, cx } from '../components/ui'
import Heatmap from '../components/Heatmap'
import {
  BoltIcon,
  DumbbellIcon,
  FlameIcon,
  PlayIcon,
  TrophyIcon,
} from '../components/Icons'
import {
  currentStreak,
  longestStreak,
  sessionsThisWeek,
  workoutDays,
  completedSetCount,
} from '../lib/stats'
import { levelProgress } from '../lib/xp'
import { formatRelativeDate, formatElapsed } from '../lib/date'

export default function Home() {
  const { profile } = useApp()
  const nav = useNavigate()
  const pid = profile!.id

  const sessions = useLiveQuery(
    () => db.sessions.where({ profileId: pid }).toArray(),
    [pid],
    [] as Session[],
  )
  const draft = useLiveQuery(() => db.drafts.get(pid), [pid])

  const stats = useMemo(() => {
    const complete = sessions.filter((s) => s.status === 'complete')
    const days = workoutDays(sessions)
    return {
      complete,
      days,
      streak: currentStreak(days),
      best: longestStreak(days),
      week: sessionsThisWeek(sessions).length,
      recent: [...complete].sort((a, b) => b.startedAt - a.startedAt).slice(0, 3),
    }
  }, [sessions])

  const active = useMemo(
    () =>
      sessions
        .filter((s) => s.status === 'active')
        .sort((a, b) => b.startedAt - a.startedAt)[0],
    [sessions],
  )

  const lvl = levelProgress(profile!.xp)

  return (
    <div className="px-4 pt-4 space-y-4">
      {/* ---------------- Greeting + level ---------------- */}
      <Card className="p-5 relative overflow-hidden">
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-accent/10 blur-2xl" />
        <div className="relative">
          <p className="text-muted text-sm">Welcome back,</p>
          <h1 className="text-3xl font-black tracking-tight">{profile!.name}</h1>

          <div className="mt-5 flex items-end justify-between">
            <div>
              <div className="text-4xl font-black text-accent tabular-nums leading-none">
                {lvl.level}
              </div>
              <div className="text-[11px] uppercase tracking-widest text-muted mt-1.5">
                Level
              </div>
            </div>
            <div className="text-right">
              <div className="text-4xl font-black tabular-nums leading-none">
                {profile!.xp.toLocaleString()}
              </div>
              <div className="text-[11px] uppercase tracking-widest text-muted mt-1.5">
                Total XP
              </div>
            </div>
          </div>

          {/* level progress */}
          <div className="mt-3 h-2.5 rounded-full bg-surface-2 overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-[width] duration-700"
              style={{ width: `${Math.max(3, lvl.pct * 100)}%` }}
            />
          </div>
          <p className="text-xs text-muted mt-1.5 tabular-nums">
            {lvl.toNext} XP to level {lvl.level + 1}
          </p>
        </div>
      </Card>

      {/* ---------------- Start / resume ---------------- */}
      {active ? (
        <Card className="p-4 border-accent/40 bg-accent/5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-widest text-accent font-bold">
                In progress
              </p>
              <p className="font-bold truncate">{active.title}</p>
              <p className="text-xs text-muted mt-0.5 tabular-nums">
                {completedSetCount(active)} sets ·{' '}
                {formatElapsed(Date.now() - active.startedAt)}
              </p>
            </div>
            <Button
              variant="primary"
              onClick={() => nav(`/workout/active/${active.id}`)}
            >
              <PlayIcon size={18} /> Resume
            </Button>
          </div>
        </Card>
      ) : (
        <Button variant="primary" size="lg" full onClick={() => nav('/workout')}>
          <DumbbellIcon size={22} />
          {draft ? `Start "${draft.title}"` : "Start today's workout"}
        </Button>
      )}

      {/* ---------------- Stat row ---------------- */}
      <div className="flex gap-3">
        <Stat
          value={stats.streak}
          label="Day streak"
          accent={stats.streak > 0}
          icon={<FlameIcon size={13} />}
        />
        <Stat value={stats.days.length} label="Total days" icon={<TrophyIcon size={13} />} />
        <Stat value={stats.week} label="This week" icon={<BoltIcon size={13} />} />
      </div>

      {/* ---------------- Heatmap ---------------- */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold">Consistency</h2>
          <button
            className="text-xs text-accent font-semibold"
            onClick={() => nav('/history')}
          >
            See all
          </button>
        </div>
        <Heatmap
          sessions={sessions}
          weeks={13}
          onPickDay={(_key, day) => {
            if (day.length) nav(`/history/${day[0].id}`)
          }}
        />
        {stats.best > 1 && (
          <p className="text-xs text-muted mt-3">
            Longest streak: <span className="text-fg font-semibold">{stats.best} days</span>
          </p>
        )}
      </Card>

      {/* ---------------- Recent ---------------- */}
      <Card className="p-4">
        <h2 className="font-bold mb-3">Recent workouts</h2>
        {stats.recent.length === 0 ? (
          <EmptyState
            title="No workouts yet"
            body="Finish your first session and it'll show up here — along with your streak and XP."
          />
        ) : (
          <div className="space-y-2">
            {stats.recent.map((s) => (
              <button
                key={s.id}
                onClick={() => nav(`/history/${s.id}`)}
                className={cx(
                  'w-full flex items-center gap-3 p-3 rounded-xl bg-surface-2 text-left active:bg-line',
                )}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{s.title}</p>
                  <p className="text-xs text-muted tabular-nums">
                    {formatRelativeDate(s.dateKey)} · {s.exercises.length} exercises ·{' '}
                    {completedSetCount(s)} sets
                  </p>
                </div>
                {s.prs.length > 0 && (
                  <span className="shrink-0 text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-full bg-accent/15 text-accent">
                    {s.prs.length} PR
                  </span>
                )}
                <span className="shrink-0 text-xs font-bold text-accent tabular-nums">
                  +{s.xpAwarded}
                </span>
              </button>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
