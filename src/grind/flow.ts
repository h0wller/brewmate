import type { BrewLog, BrewStep } from '../types'

/* Время заваривания против плана рецепта. Сигнал только для методов, где вода проходит через слой кофе:
   там помол прямо задаёт скорость. В погружных методах (френч-пресс, аэропресс) время от помола почти не зависит. */
export type Flow = 'slow' | 'fast'

const PERCOLATION = new Set(['v60', 'drip'])
export const SLOW_RATIO = 1.3     // дольше плана больше чем на 30 %
export const FAST_RATIO = 0.75    // быстрее плана больше чем на 25 %
const MIN_PLAN_S = 60             // у совсем коротких рецептов разброс времени слишком велик

export const plannedSeconds = (steps: BrewStep[]): number =>
  steps.reduce((s, x) => s + (Number.isFinite(x.duration) && x.duration > 0 ? x.duration : 0), 0)

export function flowSignal(log: Pick<BrewLog, 'method' | 'steps' | 'durationS'>): Flow | undefined {
  if (!PERCOLATION.has(log.method)) return undefined
  const plan = plannedSeconds(log.steps)
  const actual = log.durationS
  if (plan < MIN_PLAN_S || !(actual > 0)) return undefined
  if (actual > plan * SLOW_RATIO) return 'slow'
  if (actual < plan * FAST_RATIO) return 'fast'
  return undefined
}
