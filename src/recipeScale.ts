/* Связь «кофе — вода — пропорция» в редакторе рецепта и пересчёт шагов.
   Чистые функции: редактор только вызывает их, поэтому поведение проверяется тестами. */

import type { BrewStep } from './types'

const round1 = (x: number) => Math.round(x * 10) / 10

/* Пропорция «вода на 1 г кофе» (16.7 = 1:16.7) */
export const ratioOf = (doseG: number, waterG: number): number | undefined =>
  doseG > 0 && waterG > 0 ? waterG / doseG : undefined

/* Шаги хранят суммарный вес воды к концу шага, поэтому при смене общей воды они масштабируются
   одним множителем (как велит CoffeeJSON § Scaling); длительности — это приём автора, их не трогаем.
   Шаг, который доводил до всей воды, и после пересчёта доводит ровно до новой. */
export function scaleSteps(steps: BrewStep[], fromWater: number, toWater: number): BrewStep[] {
  if (!(fromWater > 0) || !(toWater > 0) || fromWater === toWater) return steps
  const k = toWater / fromWater
  return steps.map(s => ({ ...s, pourTo: s.pourTo === fromWater ? toWater : Math.round(s.pourTo * k) }))
}

/* Снимок «вода и шаги до первой правки»: пересчёт всегда идёт от него, а не от предыдущего
   результата, иначе набор числа по цифрам копил бы ошибку округления. */
export interface Base { water: number; steps: BrewStep[] }

export interface Linked { doseG: number; waterG: number; steps: BrewStep[] }

/* Изменили кофе → вода по пропорции, шаги пересчитаны */
export function fromDose(base: Base, ratio: number, doseG: number): Linked {
  const waterG = Math.round(doseG * ratio)
  return { doseG, waterG, steps: scaleSteps(base.steps, base.water, waterG) }
}

/* Изменили воду → кофе по пропорции (с точностью до 0,1 г), шаги пересчитаны */
export function fromWater(base: Base, ratio: number, waterG: number): Linked {
  return { doseG: round1(waterG / ratio), waterG, steps: scaleSteps(base.steps, base.water, waterG) }
}
