import { describe, expect, it } from 'vitest'
import { fromDose, fromWater, ratioOf, scaleSteps } from './recipeScale'
import type { BrewStep } from './types'

const STEPS: BrewStep[] = [
  { duration: 40, pourTo: 45, note: 'блюм' },
  { duration: 30, pourTo: 120 },
  { duration: 25, pourTo: 180 },
  { duration: 25, pourTo: 240 },
]

describe('ratioOf', () => {
  it('вода на грамм кофе; для нуля и отрицательных — ничего', () => {
    expect(ratioOf(15, 240)).toBe(16)
    expect(ratioOf(0, 240)).toBeUndefined()
    expect(ratioOf(15, -1)).toBeUndefined()
  })
})

describe('scaleSteps', () => {
  it('множитель один на все шаги, последний шаг остаётся равен всей воде', () => {
    const out = scaleSteps(STEPS, 240, 300)
    expect(out.map(s => s.pourTo)).toEqual([56, 150, 225, 300])
    expect(out[0].note).toBe('блюм')
    expect(out.map(s => s.duration)).toEqual([40, 30, 25, 25])
  })
  it('рост и убыль не ломают порядок возрастания', () => {
    for (const to of [100, 137, 333, 1000]) {
      const p = scaleSteps(STEPS, 240, to).map(s => s.pourTo)
      expect([...p].sort((a, b) => a - b)).toEqual(p)
    }
  })
  it('без изменений или с мусором возвращает те же шаги', () => {
    expect(scaleSteps(STEPS, 240, 240)).toBe(STEPS)
    expect(scaleSteps(STEPS, 0, 300)).toBe(STEPS)
    expect(scaleSteps(STEPS, 240, NaN)).toBe(STEPS)
  })
})

describe('связка кофе ↔ вода', () => {
  const base = { water: 240, steps: STEPS }
  it('кофе меняется → вода по пропорции и шаги подтянулись', () => {
    const r = fromDose(base, 16, 18)
    expect(r.waterG).toBe(288)
    expect(r.steps.at(-1)?.pourTo).toBe(288)
  })
  it('вода меняется → кофе по пропорции с точностью до 0,1 г', () => {
    const r = fromWater(base, 16, 250)
    expect(r.doseG).toBe(15.6)
    expect(r.steps.at(-1)?.pourTo).toBe(250)
  })
  it('набор числа по цифрам не копит ошибку: пересчёт всегда от снимка', () => {
    const typed = ['1', '18'].map(v => fromDose(base, 16, +v)).at(-1)
    expect(typed).toEqual(fromDose(base, 16, 18))
  })
  it('вернули исходное значение → шаги вернулись в исходные', () => {
    expect(fromDose(base, 16, 15).steps).toEqual(STEPS)
  })
})
