/**
 * XP & levelling.
 *
 * Curve: level N requires 100 * N XP to clear, so cumulative XP for level L is
 * 50 * L * (L - 1). That keeps early levels quick (first level-up after one
 * workout) while still stretching out meaningfully over months.
 */

export const XP = {
  /** Base award for finishing any workout. */
  workout: 60,
  /** Per completed set. */
  perSet: 5,
  /** Per new personal record in the session. */
  perPr: 25,
  /** Per day of streak, capped — keeps long streaks motivating but not silly. */
  perStreakDay: 4,
  streakBonusCap: 60,
} as const

/** Total XP needed to have REACHED a given level (level 1 = 0 XP). */
export function xpForLevel(level: number): number {
  const l = Math.max(1, level)
  return 50 * l * (l - 1)
}

export function levelFromXp(xp: number): number {
  // Invert 50*L*(L-1) <= xp  →  L = floor((1 + sqrt(1 + xp/12.5)) / 2)
  const l = Math.floor((1 + Math.sqrt(1 + xp / 12.5)) / 2)
  return Math.max(1, l)
}

export interface LevelProgress {
  level: number
  /** XP accumulated inside the current level. */
  into: number
  /** XP span of the current level. */
  span: number
  /** 0..1 */
  pct: number
  toNext: number
}

export function levelProgress(xp: number): LevelProgress {
  const level = levelFromXp(xp)
  const base = xpForLevel(level)
  const next = xpForLevel(level + 1)
  const span = next - base
  const into = xp - base
  return { level, into, span, pct: span > 0 ? into / span : 0, toNext: next - xp }
}

/** XP awarded for a finished session. */
export function sessionXp(opts: {
  completedSets: number
  prCount: number
  streakDays: number
}): number {
  const streakBonus = Math.min(
    XP.streakBonusCap,
    Math.max(0, opts.streakDays - 1) * XP.perStreakDay,
  )
  return (
    XP.workout + opts.completedSets * XP.perSet + opts.prCount * XP.perPr + streakBonus
  )
}

/** Epley estimated 1-rep max. Bodyweight (weight 0) has no meaningful e1RM. */
export function epley(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0
  return weight * (1 + reps / 30)
}
