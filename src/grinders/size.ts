/* Общая шкала крупности помола — тот же словарь, что в формате CoffeeJSON (grind.size).
   Это перцептивные уровни от мелкого к крупному, а не микроны и не клики:
   перевод между кофемолками она не даёт, зато одинаково читается везде. */

export const GRIND_SIZES = [
  'extra_fine', 'fine', 'medium_fine', 'medium', 'medium_coarse', 'coarse', 'extra_coarse',
] as const

export type GrindSize = (typeof GRIND_SIZES)[number]

export const SIZE_LABEL: Record<GrindSize, string> = {
  extra_fine: 'очень мелкий',
  fine: 'мелкий',
  medium_fine: 'средне-мелкий',
  medium: 'средний',
  medium_coarse: 'средне-крупный',
  coarse: 'крупный',
  extra_coarse: 'очень крупный',
}

export const isGrindSize = (v: unknown): v is GrindSize =>
  typeof v === 'string' && (GRIND_SIZES as readonly string[]).includes(v)

const MAX = GRIND_SIZES.length - 1
const clampIdx = (i: number) => Math.min(MAX, Math.max(0, i))

/* Дробная «крупность» (0 = очень мелкий … 6 = очень крупный) → ближайший уровень
   и подсказка: nudge = ±1, если расчёт заметно (≥ 0.25 уровня) отклоняется от уровня */
export function describeCoarseness(x: number): { size: GrindSize; nudge: -1 | 0 | 1 } {
  const idx = clampIdx(Math.round(x))
  const diff = x - idx
  const nudge = Math.abs(diff) >= 0.25 && x > 0 && x < MAX ? (diff > 0 ? 1 : -1) : 0
  return { size: GRIND_SIZES[idx], nudge }
}

export const nudgeText = (nudge: -1 | 0 | 1) =>
  nudge > 0 ? 'чуть крупнее' : nudge < 0 ? 'чуть мельче' : ''
