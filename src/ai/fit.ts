import type { BrewStep } from '../types'

/* Ответ модели → шаги, согласованные с водой рецепта: последний шаг равен всей воде,
   вес не убывает. Модель считает вес «от дозы», и при расхождении (другая доза, своя пропорция)
   таймер показал бы шаги на одну воду, а рецепт — на другую. */
export function fitStepsToWater(steps: BrewStep[], waterG: number): BrewStep[] {
  const last = steps.at(-1)?.pourTo
  if (!last || !(waterG > 0) || last === waterG) return steps
  const k = waterG / last
  let prev = 0
  return steps.map((s, i) => {
    const pourTo = i === steps.length - 1 ? Math.round(waterG) : Math.max(prev, Math.round(s.pourTo * k))
    prev = pourTo
    return { ...s, pourTo }
  })
}
