import { useMemo } from 'react'
import type { Session } from '../db/types'
import { addDays, dateKey, startOfWeek } from '../lib/date'
import { intensityForDay } from '../lib/stats'
import { cx } from './ui'

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

const LEVEL_CLASS = [
  'bg-surface-2',
  'bg-accent/30',
  'bg-accent/60',
  'bg-accent',
] as const

/**
 * GitHub-style consistency grid. Columns are weeks (Monday-start), rows are
 * weekdays. `weeks` controls how far back it reaches.
 */
export default function Heatmap({
  sessions,
  weeks = 17,
  onPickDay,
}: {
  sessions: Session[]
  weeks?: number
  onPickDay?: (key: string, sessions: Session[]) => void
}) {
  const byDay = useMemo(() => {
    const map = new Map<string, Session[]>()
    for (const s of sessions) {
      if (s.status !== 'complete') continue
      const list = map.get(s.dateKey) ?? []
      list.push(s)
      map.set(s.dateKey, list)
    }
    return map
  }, [sessions])

  const columns = useMemo(() => {
    // Last `weeks` weeks ending with the week containing today.
    const thisWeek = startOfWeek()
    return Array.from({ length: weeks }, (_, w) => {
      const monday = addDays(thisWeek, (w - (weeks - 1)) * 7)
      return Array.from({ length: 7 }, (_, d) => addDays(monday, d))
    })
  }, [weeks])

  const today = dateKey()

  return (
    <div className="flex gap-1.5">
      {/* weekday gutter */}
      <div className="flex flex-col gap-[3px] pr-0.5 shrink-0">
        {DAY_LABELS.map((l, i) => (
          <div
            key={i}
            className="h-[13px] text-[9px] leading-[13px] text-muted/60 w-3 text-center"
          >
            {i % 2 === 0 ? l : ''}
          </div>
        ))}
      </div>

      <div className="flex-1 flex gap-[3px] overflow-hidden justify-end">
        {columns.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-[3px]">
            {week.map((date) => {
              const key = dateKey(date)
              const day = byDay.get(key)
              const future = key > today
              const level = day ? intensityForDay(day) : 0
              return (
                <button
                  key={key}
                  type="button"
                  disabled={!day && !onPickDay}
                  onClick={() => onPickDay?.(key, day ?? [])}
                  title={`${key}${day ? ` — ${day.length} workout${day.length > 1 ? 's' : ''}` : ''}`}
                  className={cx(
                    'h-[13px] w-[13px] rounded-[3px] transition-transform',
                    future ? 'bg-surface-2/40' : LEVEL_CLASS[level],
                    key === today && 'ring-1 ring-fg/50',
                    day && 'active:scale-125',
                  )}
                />
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

export function HeatmapLegend() {
  return (
    <div className="flex items-center gap-1.5 text-[10px] text-muted">
      <span>Less</span>
      {LEVEL_CLASS.map((c, i) => (
        <span key={i} className={cx('h-[11px] w-[11px] rounded-[3px]', c)} />
      ))}
      <span>More</span>
    </div>
  )
}
