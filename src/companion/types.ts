import type { MethodKey, WaterKey } from '../beans/engine'

/** Last explicit brew choice made on the currently open bean card. */
export interface BeanRecipeSelection {
  beanId: string
  method: MethodKey | null
  dose: number | null
  water: WaterKey | null
}
