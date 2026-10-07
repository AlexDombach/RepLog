import type { Equipment } from './types'

/** Stable ids — exercises reference these. */
export const EQ = {
  dumbbells: 'dumbbells',
  kettlebells: 'kettlebells',
  flatBench: 'flat-bench',
  inclineBench: 'incline-bench',
  rower: 'rower',
  cable: 'cable-trainer',
  pullupGrip: 'pullup-grip',
  bodyweight: 'bodyweight',
} as const

export const SEED_EQUIPMENT: Equipment[] = [
  { id: EQ.bodyweight, name: 'Bodyweight', enabled: true, custom: false, order: 0 },
  { id: EQ.dumbbells, name: 'Dumbbells', enabled: true, custom: false, order: 1 },
  { id: EQ.kettlebells, name: 'Kettlebells', enabled: true, custom: false, order: 2 },
  { id: EQ.flatBench, name: 'Flat bench', enabled: true, custom: false, order: 3 },
  {
    id: EQ.inclineBench,
    name: 'Adjustable / incline bench',
    enabled: true,
    custom: false,
    order: 4,
  },
  { id: EQ.rower, name: 'Rowing machine', enabled: true, custom: false, order: 5 },
  {
    id: EQ.cable,
    name: 'Functional trainer (cable)',
    enabled: true,
    custom: false,
    order: 6,
    attachments: ['Rope', 'Straight bar', 'Single D-handle (x2)', 'Ankle strap'],
  },
  {
    id: EQ.pullupGrip,
    name: 'Pull-up / chin-up grip',
    enabled: true,
    custom: false,
    order: 7,
  },
]
