import { useCallback, useEffect, useRef, useState } from 'react'
import { formatDuration } from '../lib/date'
import { beepRestDone } from '../lib/feedback'
import { PauseIcon, PlayIcon, TimerIcon, XIcon } from './Icons'
import { cx } from './ui'

interface RestState {
  /** Epoch ms the timer should fire. */
  endsAt: number
  total: number
  paused: boolean
  /** Seconds left when paused. */
  remainingWhenPaused: number
}

/**
 * Rest timer hook. Deliberately driven off wall-clock time rather than an
 * interval count, so backgrounding Safari (screen lock mid-set) doesn't
 * desync it — on resume it shows the true remaining time.
 */
export function useRestTimer(opts: { sound: boolean; haptic: boolean }) {
  const [state, setState] = useState<RestState | null>(null)
  const [, tick] = useState(0)
  const firedRef = useRef(false)
  const optsRef = useRef(opts)
  optsRef.current = opts

  // 250ms repaint cadence — smooth enough, cheap enough.
  useEffect(() => {
    if (!state || state.paused) return
    const id = setInterval(() => tick((n) => n + 1), 250)
    return () => clearInterval(id)
  }, [state])

  const remaining = state
    ? state.paused
      ? state.remainingWhenPaused
      : Math.max(0, (state.endsAt - Date.now()) / 1000)
    : 0

  // Fire once when it hits zero.
  useEffect(() => {
    if (!state || state.paused) return
    if (remaining > 0) {
      firedRef.current = false
      return
    }
    if (firedRef.current) return
    firedRef.current = true
    beepRestDone(optsRef.current.sound, optsRef.current.haptic)
  }, [remaining, state])

  const start = useCallback((seconds: number) => {
    firedRef.current = false
    setState({
      endsAt: Date.now() + seconds * 1000,
      total: seconds,
      paused: false,
      remainingWhenPaused: seconds,
    })
  }, [])

  const stop = useCallback(() => setState(null), [])

  const add = useCallback((seconds: number) => {
    setState((s) => {
      if (!s) return s
      firedRef.current = false
      return s.paused
        ? { ...s, remainingWhenPaused: Math.max(0, s.remainingWhenPaused + seconds), total: s.total + seconds }
        : { ...s, endsAt: s.endsAt + seconds * 1000, total: s.total + seconds }
    })
  }, [])

  const toggle = useCallback(() => {
    setState((s) => {
      if (!s) return s
      if (s.paused) {
        return { ...s, paused: false, endsAt: Date.now() + s.remainingWhenPaused * 1000 }
      }
      return {
        ...s,
        paused: true,
        remainingWhenPaused: Math.max(0, (s.endsAt - Date.now()) / 1000),
      }
    })
  }, [])

  return {
    active: state !== null,
    remaining,
    total: state?.total ?? 0,
    paused: state?.paused ?? false,
    done: state !== null && remaining <= 0,
    start,
    stop,
    add,
    toggle,
  }
}

export type RestTimerApi = ReturnType<typeof useRestTimer>

/** The pinned bar above the action row during an active session. */
export default function RestTimer({ timer }: { timer: RestTimerApi }) {
  if (!timer.active) return null
  const pct = timer.total > 0 ? timer.remaining / timer.total : 0
  const done = timer.done

  return (
    <div
      className={cx(
        'relative overflow-hidden rounded-2xl border px-4 py-3 flex items-center gap-3',
        done ? 'border-accent bg-accent/15 animate-pop' : 'border-line bg-surface',
      )}
    >
      {/* progress fill */}
      <div
        className="absolute inset-y-0 left-0 bg-accent/15 transition-[width] duration-200 ease-linear"
        style={{ width: `${pct * 100}%` }}
      />

      <TimerIcon size={20} className={cx('relative shrink-0', done ? 'text-accent' : 'text-muted')} />

      <div className="relative flex-1 min-w-0">
        <div className="text-[10px] uppercase tracking-widest text-muted">
          {done ? 'Rest over — go' : 'Resting'}
        </div>
        <div
          className={cx(
            'text-2xl font-black tabular-nums leading-none',
            done && 'text-accent',
          )}
        >
          {formatDuration(timer.remaining)}
        </div>
      </div>

      <div className="relative flex items-center gap-1.5 shrink-0">
        <button
          onClick={() => timer.add(30)}
          className="h-10 px-2.5 rounded-xl bg-surface-2 border border-line text-xs font-bold active:bg-line"
        >
          +30s
        </button>
        <button
          onClick={timer.toggle}
          aria-label={timer.paused ? 'Resume rest' : 'Pause rest'}
          className="h-10 w-10 rounded-xl bg-surface-2 border border-line grid place-items-center active:bg-line"
        >
          {timer.paused ? <PlayIcon size={16} /> : <PauseIcon size={16} />}
        </button>
        <button
          onClick={timer.stop}
          aria-label="Skip rest"
          className="h-10 w-10 rounded-xl bg-surface-2 border border-line grid place-items-center text-muted active:bg-line"
        >
          <XIcon size={16} />
        </button>
      </div>
    </div>
  )
}
