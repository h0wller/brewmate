import { describe, expect, it } from 'vitest'
import { grinderCalibrationAdvice } from './grinderCalibration'
import { waterAdvice } from './waterSettings'
import type { GrinderProfile } from '../../types'

describe('grinderCalibration', () => {
  it('без кофемолки — подсказка выбрать', () => {
    const profile: GrinderProfile = { } as any
    const r = grinderCalibrationAdvice(profile, 'medium', 3)
    expect(r).toContain('Кофемолка не выбрана')
    expect(r).toContain('перевод кликов')
  })
})

describe('waterSettings', () => {
  it('soft/hard/balanced', () => {
    expect(waterAdvice('soft')).toContain('кислотность')
    expect(waterAdvice('hard')).toContain('горечь')
    expect(waterAdvice('balanced')).toContain('универсальный')
  })
})