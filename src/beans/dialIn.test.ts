import { describe, expect, it } from 'vitest'
import type { BrewLog } from '../types'
import { diagnoseNextCup, makeTrialRecipe } from './dialIn'

const log = (p: Partial<BrewLog> = {}): BrewLog => ({
  id: 'log-1',
  title: 'Ethiopia · Moccamaster',
  method: 'moccamaster',
  doseG: 20,
  waterG: 334,
  tempC: 94,
  grind: { grinder: { id: 'comandante-c40' }, setting: '28 clicks', size: 'medium_coarse' },
  steps: [{ duration: 240, pourTo: 334, note: 'machine cycle' }],
  startedAt: 1,
  durationS: 240,
  createdAt: 1,
  ...p,
})

describe('diagnoseNextCup', () => {
  it('recommends a single finer step for sour coffee without inventing clicks', () => {
    const result = diagnoseNextCup(log({ taste: 'sour' }))
    expect(result.action).toContain('мельче')
    expect(result.action).not.toContain('27 кликов')
    expect(result.confidence).toBe('starting-point')
  })

  it('separates weak strength from extraction and changes dose only', () => {
    const result = diagnoseNextCup(log({ taste: 'weak' }))
    expect(result.action).toContain('21 г')
    expect(result.action).toContain('воду')
    expect(result.action).toContain('помол')
  })

  it('does not recommend changing a balanced brew', () => {
    expect(diagnoseNextCup(log({ taste: 'balanced' })).confidence).toBe('no-change')
  })
})

describe('makeTrialRecipe', () => {
  it('creates a separate sour trial with a coarser/finer target and no stale dial setting', () => {
    const source = log({ taste: 'sour' })
    const trial = makeTrialRecipe(source)!
    expect(trial.id).not.toBe(source.id)
    expect(trial.grind?.size).toBe('medium')
    expect(trial.grind?.setting).toBeUndefined()
    expect(source.grind?.setting).toBe('28 clicks')
    expect(trial.waterG).toBe(source.waterG)
    expect(trial.tempC).toBe(source.tempC)
  })

  it('raises dose only for weak coffee and preserves water and grind', () => {
    const source = log({ taste: 'weak' })
    const trial = makeTrialRecipe(source)!
    expect(trial.doseG).toBe(21)
    expect(trial.waterG).toBe(source.waterG)
    expect(trial.grind).toEqual(source.grind)
  })

  it('does not create a trial for balanced coffee', () => {
    expect(makeTrialRecipe(log({ taste: 'balanced' }))).toBeUndefined()
  })
})
