import { describe, expect, it } from 'vitest'
import { grinderCalibrationAdvice } from './grinderCalibration'
import type { GrinderProfile, Recipe } from '../../types'

const profile: GrinderProfile = {
  grinder: { id: 'comandante-c40', label: 'Comandante C40' },
  calibration: { medium_coarse: '26 кликов' },
}

const recipe = (grind?: Recipe['grind']): Recipe => ({
  id: 'r-1',
  title: 'Эфиопия · Moccamaster',
  method: 'moccamaster',
  doseG: 18,
  waterG: 300,
  tempC: 94,
  grind,
  steps: [],
  createdAt: 1,
})

describe('grinderCalibrationAdvice', () => {
  it('does not invent a medium/3.0 default without a selected recipe', () => {
    const answer = grinderCalibrationAdvice(profile)

    expect(answer).toContain('Откройте рецепт')
    expect(answer).not.toContain('средний')
    expect(answer).not.toContain('3.0')
  })

  it('uses the active recipe grind and its saved setting for the same grinder', () => {
    const answer = grinderCalibrationAdvice(profile, recipe({
      grinder: { id: 'comandante-c40', label: 'Comandante C40' },
      size: 'medium_coarse',
      setting: '24 клика',
    }))

    expect(answer).toContain('Эфиопия · Moccamaster')
    expect(answer).toContain('средне-крупный')
    expect(answer).toContain('24 клика')
    expect(answer).not.toContain('средний (крупность 3.0)')
  })

  it('does not reuse a setting calibrated for a different grinder', () => {
    const answer = grinderCalibrationAdvice(profile, recipe({
      grinder: { id: 'timemore-c3', label: 'Timemore C3' },
      size: 'medium_coarse',
      setting: '18 кликов',
    }))

    expect(answer).toContain('Timemore C3')
    expect(answer).not.toContain('Ориентир для Comandante C40: 18 кликов')
    expect(answer).toContain('не переносим')
  })

  it('explains when the current recipe has no grind size', () => {
    const answer = grinderCalibrationAdvice(profile, recipe({ setting: '24 clicks' }))

    expect(answer).toContain('не задан')
    expect(answer).not.toContain('средний')
  })
})
