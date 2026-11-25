import { describe, expect, it } from 'vitest'
import { grinderCalibrationAdvice } from './grinderCalibration'
import { waterAdvice } from './waterSettings'
import type { GrinderProfile, Recipe } from '../../types'

describe('grinderCalibration', () => {
  it('без рецепта просит открыть рецепт и не придумывает помол', () => {
    const profile: GrinderProfile = { calibration: {} }
    const r = grinderCalibrationAdvice(profile)
    expect(r).toContain('Откройте сохранённый рецепт')
    expect(r).not.toContain('средний (крупность 3.0)')
  })

  it('показывает сохранённую настройку из текущего рецепта', () => {
    const profile: GrinderProfile = { calibration: {} }
    const recipe: Recipe = {
      id: 'r1', title: 'V60', method: 'v60', doseG: 15, waterG: 250, tempC: 92,
      grind: { size: 'medium_fine', setting: '22 клика' }, steps: [], createdAt: 1,
    }
    expect(grinderCalibrationAdvice(profile, recipe)).toContain('22 клика')
  })
})

describe('waterSettings', () => {
  it('soft/hard/balanced', () => {
    expect(waterAdvice('soft')).toContain('кислотность')
    expect(waterAdvice('hard')).toContain('горечь')
    expect(waterAdvice('balanced')).toContain('универсальный')
  })
})