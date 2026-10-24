import { describe, expect, it } from 'vitest'
import { scaleStepsWater } from './beans/engine'
import type { BrewStep } from './types'

describe('scaleStepsWater', () => {
  const steps15g: BrewStep[] = [
    { duration: 45, pourTo: 45, note: 'блюм' },
    { duration: 30, pourTo: 150, note: 'первое вливание' },
    { duration: 30, pourTo: 250, note: 'второе вливание' },
  ]

  it('масштабирует шаги пропорционально при увеличении объёма воды до 1000 г', () => {
    const scaled = scaleStepsWater(steps15g, 250, 1000)
    expect(scaled).toEqual([
      { duration: 45, pourTo: 180, note: 'блюм' },
      { duration: 30, pourTo: 600, note: 'первое вливание' },
      { duration: 30, pourTo: 1000, note: 'второе вливание' },
    ])
  })

  it('фиксирует последний шаг ровно на newWater', () => {
    const steps: BrewStep[] = [
      { duration: 30, pourTo: 60 },
      { duration: 60, pourTo: 248 }, // чуть неровная сумма
    ]
    const scaled = scaleStepsWater(steps, 250, 500)
    expect(scaled.at(-1)?.pourTo).toBe(500)
  })

  it('обрабатывает пустой список или некорректную воду', () => {
    expect(scaleStepsWater([], 250, 500)).toEqual([])
    expect(scaleStepsWater(steps15g, 250, 0)).toEqual(steps15g)
  })
})
