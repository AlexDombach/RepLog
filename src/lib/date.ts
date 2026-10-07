/** Local-time date helpers. All streak/heatmap logic keys off `dateKey`. */

/** 'YYYY-MM-DD' in the device's local timezone (NOT UTC — midnight matters here). */
export function dateKey(d: Date | number = new Date()): string {
  const date = typeof d === 'number' ? new Date(d) : d
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Parse a 'YYYY-MM-DD' key back to local midnight. */
export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(d: Date, n: number): Date {
  const out = new Date(d)
  out.setDate(out.getDate() + n)
  return out
}

/** Whole days between two date keys (b - a). */
export function daysBetween(a: string, b: string): number {
  const ms = fromDateKey(b).getTime() - fromDateKey(a).getTime()
  return Math.round(ms / 86_400_000)
}

/** Monday-start week containing `d`. */
export function startOfWeek(d: Date = new Date()): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const dow = (out.getDay() + 6) % 7 // 0 = Monday
  out.setDate(out.getDate() - dow)
  return out
}

export function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

/** 'Today' / 'Yesterday' / 'Mon, Oct 6' */
export function formatRelativeDate(key: string): string {
  const today = dateKey()
  const diff = daysBetween(key, today)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return formatDate(fromDateKey(key).getTime())
}

/** mm:ss */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** '48m' / '1h 12m' */
export function formatElapsed(ms: number): string {
  const mins = Math.round(ms / 60_000)
  if (mins < 60) return `${mins}m`
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}
