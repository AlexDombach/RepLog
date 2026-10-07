import {
  useEffect,
  useRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react'
import { XIcon } from './Icons'

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

/* ------------------------------------------------------------------ Card */

export function Card({
  children,
  className = '',
  ...rest
}: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cx(
        'rounded-2xl bg-surface border border-line',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  )
}

/* ---------------------------------------------------------------- Button */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  full?: boolean
}

export function Button({
  variant = 'secondary',
  size = 'md',
  full,
  className = '',
  ...rest
}: ButtonProps) {
  const variants: Record<string, string> = {
    primary: 'bg-accent text-accent-ink font-bold active:brightness-90',
    secondary: 'bg-surface-2 text-fg border border-line active:bg-line',
    ghost: 'text-muted active:text-fg',
    danger: 'bg-danger/15 text-danger border border-danger/35 active:bg-danger/25',
  }
  const sizes: Record<string, string> = {
    // min-h keeps every tap target comfortably above the 44pt iOS guideline
    sm: 'min-h-9 px-3 text-sm rounded-xl',
    md: 'min-h-12 px-4 rounded-xl',
    lg: 'min-h-14 px-5 text-lg rounded-2xl font-bold',
  }
  return (
    <button
      className={cx(
        'inline-flex items-center justify-center gap-2 transition-[filter,background-color] select-none disabled:opacity-40',
        variants[variant],
        sizes[size],
        full && 'w-full',
        className,
      )}
      {...rest}
    />
  )
}

/* ---------------------------------------------------------------- Stepper */

interface StepperProps {
  value: number
  onChange: (v: number) => void
  step?: number
  min?: number
  max?: number
  /** Shown under the number, e.g. 'lb' or 'reps'. */
  suffix?: string
  /** Large variant for the active-set row. */
  decimals?: number
  disabled?: boolean
  'aria-label'?: string
}

/**
 * Big +/- stepper. Press-and-hold repeats so you can run the weight up fast
 * without typing — the number itself is still an editable input.
 */
export function Stepper({
  value,
  onChange,
  step = 1,
  min = 0,
  max = 9999,
  suffix,
  decimals = 0,
  disabled,
  'aria-label': ariaLabel,
}: StepperProps) {
  const timer = useRef<number | null>(null)
  const held = useRef(0)

  const clamp = (v: number) =>
    Math.min(max, Math.max(min, Math.round(v / step) * step))

  const bump = (dir: 1 | -1) => onChange(clamp(value + dir * step))

  const startHold = (dir: 1 | -1) => {
    stopHold()
    held.current = 0
    timer.current = window.setInterval(() => {
      held.current++
      // Accelerate: after ~1s of holding, move in bigger jumps.
      const mult = held.current > 12 ? 5 : held.current > 6 ? 2 : 1
      onChange(clamp(value + dir * step * mult))
    }, 90)
  }
  const stopHold = () => {
    if (timer.current !== null) {
      clearInterval(timer.current)
      timer.current = null
    }
  }
  useEffect(() => stopHold, [])

  const btn =
    'h-12 w-12 shrink-0 rounded-xl bg-surface-2 border border-line flex items-center justify-center text-2xl font-bold active:bg-line disabled:opacity-30'

  return (
    <div className="flex items-center gap-1.5" aria-label={ariaLabel}>
      <button
        type="button"
        className={btn}
        disabled={disabled || value <= min}
        onPointerDown={() => startHold(-1)}
        onPointerUp={stopHold}
        onPointerLeave={stopHold}
        onPointerCancel={stopHold}
        onClick={() => bump(-1)}
        aria-label="Decrease"
      >
        −
      </button>

      <label className="flex-1 min-w-0">
        <input
          type="number"
          inputMode="decimal"
          value={Number.isFinite(value) ? Number(value.toFixed(decimals)) : 0}
          disabled={disabled}
          onChange={(e) => {
            const n = Number(e.target.value)
            if (!Number.isNaN(n)) onChange(Math.min(max, Math.max(min, n)))
          }}
          onFocus={(e) => e.currentTarget.select()}
          className="w-full h-12 bg-transparent text-center text-2xl font-bold tabular-nums outline-none disabled:opacity-40"
        />
        {suffix && (
          <div className="text-[10px] uppercase tracking-widest text-muted text-center -mt-1">
            {suffix}
          </div>
        )}
      </label>

      <button
        type="button"
        className={btn}
        disabled={disabled || value >= max}
        onPointerDown={() => startHold(1)}
        onPointerUp={stopHold}
        onPointerLeave={stopHold}
        onPointerCancel={stopHold}
        onClick={() => bump(1)}
        aria-label="Increase"
      >
        +
      </button>
    </div>
  )
}

/* ---------------------------------------------------------------- Sheet */

/** Bottom sheet. Used for the profile switcher, swap picker, confirms. */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close"
      />
      <div className="relative w-full max-w-lg bg-surface border-t border-line rounded-t-3xl animate-rise max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 pt-4 pb-2 shrink-0">
          <h2 className="text-lg font-bold">{title}</h2>
          <button
            onClick={onClose}
            className="h-10 w-10 -mr-2 rounded-full flex items-center justify-center text-muted active:bg-surface-2"
            aria-label="Close"
          >
            <XIcon size={20} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 pb-safe">
          <div className="pb-6">{children}</div>
        </div>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- Toggle */

export function Toggle({
  checked,
  onChange,
  label,
  sublabel,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: ReactNode
  sublabel?: ReactNode
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="w-full flex items-center justify-between gap-4 py-3 text-left"
    >
      <span className="min-w-0">
        <span className="block font-medium">{label}</span>
        {sublabel && <span className="block text-sm text-muted mt-0.5">{sublabel}</span>}
      </span>
      <span
        className={cx(
          'relative h-7 w-12 shrink-0 rounded-full transition-colors',
          checked ? 'bg-accent' : 'bg-surface-2 border border-line',
        )}
      >
        <span
          className={cx(
            'absolute top-1 h-5 w-5 rounded-full bg-white transition-transform shadow',
            checked ? 'translate-x-6' : 'translate-x-1',
          )}
        />
      </span>
    </button>
  )
}

/* ---------------------------------------------------------------- Chip */

export function Chip({
  active,
  children,
  onClick,
  className = '',
}: {
  active?: boolean
  children: ReactNode
  onClick?: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'min-h-10 px-3.5 rounded-full text-sm font-medium border transition-colors',
        active
          ? 'bg-accent text-accent-ink border-accent'
          : 'bg-surface-2 text-muted border-line active:text-fg',
        className,
      )}
    >
      {children}
    </button>
  )
}

/* -------------------------------------------------------------- EmptyState */

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: ReactNode
  title: string
  body?: string
  action?: ReactNode
}) {
  return (
    <div className="text-center py-14 px-6">
      {icon && <div className="text-muted/50 flex justify-center mb-3">{icon}</div>}
      <p className="font-bold text-lg">{title}</p>
      {body && <p className="text-muted mt-1.5 text-sm leading-relaxed">{body}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  )
}

/* ---------------------------------------------------------------- Stat */

export function Stat({
  value,
  label,
  accent,
  icon,
}: {
  value: ReactNode
  label: string
  accent?: boolean
  icon?: ReactNode
}) {
  return (
    <Card className="p-3.5 flex-1 min-w-0">
      <div className="flex items-start gap-1 text-muted mb-1.5 min-h-7">
        <span className="mt-px shrink-0">{icon}</span>
        <span className="text-[9px] uppercase tracking-wide leading-tight">{label}</span>
      </div>
      <div
        className={cx(
          'text-3xl font-bold tabular-nums leading-none',
          accent && 'text-accent',
        )}
      >
        {value}
      </div>
    </Card>
  )
}
