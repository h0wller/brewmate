import { GRIND_SIZES } from '../grinders/size.js'
import type { GrindSize } from '../grinders/size.js'

/* Ориентиры D50 (по объёму) для уровней крупности, мкм. Это правила большого пальца, а не
   измерения: источник не установлен, значения пересекаются намеренно. Применяются, пока у пользователя
   нет своих замеров удачных заварок; он может их уточнить (см. advise.ts: вкус сдвигает цель). */
export const TARGET_UM: Record<GrindSize, [number, number]> = {
  extra_fine: [150, 300],
  fine: [250, 450],
  medium_fine: [500, 750],
  medium: [700, 950],
  medium_coarse: [850, 1150],
  coarse: [1000, 1400],
  extra_coarse: [1300, 1800],
}

/* Середина диапазона в логарифмическом масштабе: размеры растут «в разы», а не «на сколько-то» */
export const midUm = (size: GrindSize): number => {
  const [lo, hi] = TARGET_UM[size]
  return Math.sqrt(lo * hi)
}

/* Размер, мкм → непрерывная крупность 0..6 (как coarseness в движке и пресетах) */
export function coarsenessFromUm(um: number): number {
  const mids = GRIND_SIZES.map(midUm)
  if (um <= mids[0]) return 0
  if (um >= mids[mids.length - 1]) return mids.length - 1
  for (let i = 0; i < mids.length - 1; i++) {
    if (um <= mids[i + 1]) {
      return i + (Math.log(um) - Math.log(mids[i])) / (Math.log(mids[i + 1]) - Math.log(mids[i]))
    }
  }
  return mids.length - 1
}
