import type { Equipment, Exercise, MuscleGroup, Session } from '../db/types'
import { daysSinceExercise } from './stats'

export type WorkoutSize = 'quick' | 'standard' | 'long'

export const SIZE_COUNTS: Record<WorkoutSize, number> = {
  quick: 4,
  standard: 6,
  long: 8,
}

export const SIZE_LABELS: Record<WorkoutSize, string> = {
  quick: 'Quick',
  standard: 'Standard',
  long: 'Long',
}

export interface GeneratedItem {
  exerciseId: string
  targetSets: number
  repRange: [number, number]
}

export interface GenerateOptions {
  muscles: MuscleGroup[]
  size: WorkoutSize
  exercises: Exercise[]
  equipment: Equipment[]
  /** This profile's past sessions — drives "don't repeat what you just did". */
  history: Session[]
  /** Optional seed for deterministic output (tests). */
  seed?: number
}

/** An exercise is available only if EVERY piece of equipment it needs is enabled. */
export function isAvailable(ex: Exercise, enabledIds: Set<string>): boolean {
  return ex.equipment.every((id) => enabledIds.has(id))
}

export function enabledEquipmentIds(equipment: Equipment[]): Set<string> {
  return new Set(equipment.filter((e) => e.enabled).map((e) => e.id))
}

/** Exercises that match the target muscles (primary first, secondary as filler). */
export function poolFor(
  exercises: Exercise[],
  equipment: Equipment[],
  muscles: MuscleGroup[],
): { primary: Exercise[]; secondary: Exercise[] } {
  const enabled = enabledEquipmentIds(equipment)
  const available = exercises.filter((e) => isAvailable(e, enabled))
  if (muscles.length === 0) return { primary: available, secondary: [] }
  const want = new Set(muscles)
  return {
    primary: available.filter((e) => want.has(e.primaryMuscle)),
    secondary: available.filter(
      (e) => !want.has(e.primaryMuscle) && e.secondaryMuscles.some((m) => want.has(m)),
    ),
  }
}

/** Small deterministic PRNG so `seed` makes output reproducible. */
function rng(seed: number) {
  let s = seed >>> 0 || 1
  return () => {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    return ((s >>> 0) % 100_000) / 100_000
  }
}

/**
 * Score an exercise for selection. Higher wins.
 *  - heavily favours movements not done recently by this profile
 *  - a little jitter so repeat generations aren't identical
 */
function score(ex: Exercise, history: Session[], rand: () => number): number {
  const days = daysSinceExercise(history, ex.id)
  // Never done → strong bonus. Otherwise ramp up over ~2 weeks.
  const recency = days === Infinity ? 14 : Math.min(days, 14)
  return recency * 3 + rand() * 9
}

/**
 * Build an ordered workout.
 *
 * Selection: take the highest-scoring exercises from the primary pool, topping
 * up from the secondary pool if the primary pool is too small. Compounds are
 * guaranteed a slot (up to a third of the workout) so you never get a session
 * that is nothing but isolation work.
 *
 * Ordering: compounds first, then isolation; within each, primary-muscle
 * movements before secondary ones.
 */
export function generateWorkout(opts: GenerateOptions): GeneratedItem[] {
  const { muscles, size, exercises, equipment, history } = opts
  const rand = rng(opts.seed ?? (Date.now() & 0xffff) ^ Math.floor(Math.random() * 0xffff))
  const target = SIZE_COUNTS[size]

  const { primary, secondary } = poolFor(exercises, equipment, muscles)
  const scored = (list: Exercise[]) =>
    list
      .map((e) => ({ e, s: score(e, history, rand) }))
      .sort((a, b) => b.s - a.s)
      .map((x) => x.e)

  const primaryRanked = scored(primary)
  const secondaryRanked = scored(secondary)

  const chosen: Exercise[] = []
  const take = (e: Exercise) => {
    if (!chosen.some((c) => c.id === e.id)) chosen.push(e)
  }

  // 1. Guarantee some compound work (at least 1, at most ceil(target/3)).
  const compoundQuota = Math.max(1, Math.ceil(target / 3))
  for (const e of primaryRanked) {
    if (chosen.length >= compoundQuota) break
    if (e.compound) take(e)
  }

  // 2. Fill from the primary pool, then the secondary pool.
  for (const e of primaryRanked) {
    if (chosen.length >= target) break
    take(e)
  }
  for (const e of secondaryRanked) {
    if (chosen.length >= target) break
    take(e)
  }

  // 3. Order: compounds before isolation, primary-muscle before secondary.
  const want = new Set(muscles)
  const isPrimary = (e: Exercise) => muscles.length === 0 || want.has(e.primaryMuscle)
  const rank = (e: Exercise) =>
    (e.compound ? 0 : 2) + (isPrimary(e) ? 0 : 1)

  return chosen
    .sort((a, b) => rank(a) - rank(b))
    .map((e) => ({
      exerciseId: e.id,
      targetSets: e.defaultSets,
      repRange: e.repRange,
    }))
}

/** Swap one exercise for a different available one targeting the same muscle. */
export function swapCandidates(
  current: Exercise,
  inWorkout: string[],
  exercises: Exercise[],
  equipment: Equipment[],
): Exercise[] {
  const enabled = enabledEquipmentIds(equipment)
  const used = new Set(inWorkout)
  return exercises.filter(
    (e) =>
      e.id !== current.id &&
      !used.has(e.id) &&
      isAvailable(e, enabled) &&
      (e.primaryMuscle === current.primaryMuscle ||
        e.secondaryMuscles.includes(current.primaryMuscle)),
  )
}
