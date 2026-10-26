import { describe, expect, it } from 'vitest'
import { buildAIResult, sanitizeSteps } from './recipe'
import type { BeanProfile, GrinderProfile } from '../types'

const bean: BeanProfile = { id: 'b', name: '', createdAt: 0 }
const profile: GrinderProfile = { grinder: { id: 'comandante-c40' }, calibration: {} }
const ctx = { bean, method: 'v60' as const, doseG: 15, water: 'balanced' as const, profile }

const OUT = {
  bean: { name: 'Эфиопия', origin: 'Yirgacheffe', process: 'washed', roastLevel: 'light', roastDate: null, notes: 'вишня' },
  recipe: {
    title: 'V60 Эфиопия', tempC: 94, ratio: 16, grindSize: 'medium_fine',
    steps: [{ duration: 40, pourTo: 45, note: 'блюм' }, { duration: 60, pourTo: 240, note: 'долить' }],
  },
}

describe('buildAIResult', () => {
  it('зерно и рецепт собираются из ответа под выбранные метод и дозу', () => {
    const { bean: b, recipe } = buildAIResult(OUT, ctx)
    expect(b.name).toBe('Эфиопия')
    expect(b.roastLevel).toBe('light')
    expect(recipe.method).toBe('v60')
    expect(recipe.doseG).toBe(15)
    expect(recipe.waterG).toBe(240)
    expect(recipe.tempC).toBe(95)
    expect(recipe.steps.at(-1)?.pourTo).toBe(240)
    expect(recipe.grind?.size).toBe('medium_fine')
  })

  it('ручные обработка, обжарка и дата имеют приоритет над догадками AI', () => {
    const existing = { ...bean, process: 'washed', roastLevel: 'medium' as const, roastDate: '2026-10-01' }
    const { bean: b, recipe } = buildAIResult({ bean: { process: 'natural', roastLevel: 'dark', roastDate: '2026-09-01' } }, { ...ctx, bean: existing })
    expect([b.process, b.roastLevel, b.roastDate]).toEqual(['washed', 'medium', '2026-10-01'])
    expect(recipe.tempC).toBe(93)
  })

  it('доза 60 г: шаги подгоняются под воду, а не остаются на 15 г', () => {
    const { recipe } = buildAIResult(OUT, { ...ctx, doseG: 60 })
    expect(recipe.waterG).toBe(960)
    expect(recipe.steps.at(-1)?.pourTo).toBe(960)
  })

  it('мусор в ответе не ломает рецепт: берём локальный профиль метода', () => {
    const { recipe } = buildAIResult({ bean: 5, recipe: { grindSize: 'огромный', tempC: 'горячая', steps: 'нет' } }, ctx)
    expect(recipe.waterG).toBeGreaterThan(0)
    expect(recipe.tempC).toBeGreaterThanOrEqual(85)
    expect(recipe.tempC).toBeLessThanOrEqual(98)
    expect(recipe.steps.length).toBe(3)
    expect(recipe.steps.at(-1)?.pourTo).toBe(recipe.waterG)
  })

  it('AI не перезаписывает локальную температуру и пропорцию произвольными числами', () => {
    const expected = buildAIResult({ recipe: { tempC: 120, ratio: 14, grindSize: 'coarse' } }, ctx).recipe
    expect(expected.tempC).toBe(93)
    expect(expected.waterG).toBe(240)
    expect(expected.grind?.size).toBe('medium_fine')
  })

  it('Moccamaster: AI и локальный режим дают одинаковый расчёт и предсмачивание', () => {
    const { recipe } = buildAIResult(OUT, { ...ctx, method: 'moccamaster' })
    expect(recipe.method).toBe('moccamaster')
    expect(recipe.tempC).toBe(96)
    expect(recipe.waterG).toBe(240)
    expect(recipe.steps).toHaveLength(3)
    expect(recipe.steps[1].pourTo).toBe(38)
    expect(recipe.steps[1].note).toContain('Предсмачивание')
    expect(recipe.steps[2].note).toContain('Moccamaster')
  })
})

describe('sanitizeSteps', () => {
  it('отбрасывает шаги без длительности или веса', () => {
    expect(sanitizeSteps([{ duration: 0, pourTo: 50 }, { duration: 30, pourTo: 0 }, { duration: 30, pourTo: 100 }]))
      .toEqual([{ duration: 30, pourTo: 100, note: '' }])
  })
})
