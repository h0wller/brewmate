import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BrewLog } from '../types'
import { assessTrialRepeatability, planNextExperiment } from './dialIn'
import { findDialInProfile, loadDialInProfiles, profileFromConfirmedLog, saveDialInProfile } from './dialInProfile'

const makeLog = (id: string, patch: Partial<BrewLog> = {}): BrewLog => ({
  id, title: 'Эфиопия · Moccamaster', method: 'moccamaster',
  beanId: 'bean-1', beanName: 'Эфиопия', beanRoastDate: '2026-10-01',
  doseG: 20, waterG: 320, tempC: 93,
  grind: { grinder: { id: 'comandante-c40' }, size: 'medium', setting: '28 кликов' },
  steps: [{ duration: 240, pourTo: 320 }], startedAt: 1, durationS: 240, createdAt: 1,
  rating: 3, taste: 'sour',
  ...patch,
})

afterEach(() => vi.unstubAllGlobals())

describe('dial-in workflow integration', () => {
  const source = makeLog('source')
  const trial = (id: string, patch: Partial<BrewLog> = {}) => makeLog(id, {
    rating: 4, taste: 'balanced',
    trial: { sourceLogId: source.id, variable: 'grind', baselineTaste: 'sour' },
    ...patch,
  })

  it('plans one controlled variable, repeats it three times, then saves and offers the exact profile', () => {
    const plan = planNextExperiment(source, [source])
    expect(plan.kind).toBe('adjust')
    expect(plan.recipe?.trial?.variable).toBe('grind')
    expect(plan.recipe?.doseG).toBe(source.doseG)
    expect(plan.recipe?.waterG).toBe(source.waterG)
    expect(plan.recipe?.tempC).toBe(source.tempC)
    expect(plan.recipe?.grind?.size).not.toBe(source.grind?.size)
    expect(plan.recipe?.grind?.setting).toBeUndefined()
    const cups = ['t1', 't2', 't3'].map(id => trial(id, {
      doseG: plan.recipe!.doseG, waterG: plan.recipe!.waterG, tempC: plan.recipe!.tempC,
      grind: plan.recipe!.grind, steps: plan.recipe!.steps,
    }))
    const assessment = assessTrialRepeatability(source, cups, cups[2])
    expect(assessment.status).toBe('confirmed')
    expect(assessment.trials).toBe(3)
    const profile = profileFromConfirmedLog(cups[2], assessment, 100)
    expect(profile).toBeDefined()
    const memory: Record<string, string> = {}
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => memory[key] ?? null,
      setItem: (key: string, value: string) => { memory[key] = value },
    })
    saveDialInProfile(profile!)
    const saved = loadDialInProfiles()
    expect(findDialInProfile(saved, 'comandante-c40', 'moccamaster', {
      matchBean: true, beanId: 'bean-1', matchRoastDate: true, roastDate: '2026-10-01',
    })).toEqual(profile)
  })

  it('does not offer the saved profile for another grinder, bean, or roast date', () => {
    const profile = profileFromConfirmedLog(trial('t3'), { status: 'confirmed', positive: 3, trials: 3 }, 100)!
    const saved = [profile]
    expect(findDialInProfile(saved, 'other-grinder', 'moccamaster', { matchBean: true, beanId: 'bean-1', matchRoastDate: true, roastDate: '2026-10-01' })).toBeUndefined()
    expect(findDialInProfile(saved, 'comandante-c40', 'moccamaster', { matchBean: true, beanId: 'bean-2', matchRoastDate: true, roastDate: '2026-10-01' })).toBeUndefined()
    expect(findDialInProfile(saved, 'comandante-c40', 'moccamaster', { matchBean: true, beanId: 'bean-1', matchRoastDate: true, roastDate: '2026-10-02' })).toBeUndefined()
  })

  it('does not confirm cups missing taste or rating', () => {
    const missingTaste = trial('no-taste', { taste: undefined })
    const missingRating = trial('no-rating', { rating: undefined })
    expect(assessTrialRepeatability(source, [missingTaste, missingRating, trial('valid')]).status).toBe('insufficient')
    expect(assessTrialRepeatability(source, [missingTaste, missingRating, trial('valid')]).trials).toBe(1)
  })

  it('does not combine three different recipes into a repeatable series', () => {
    const a = trial('a')
    const b = trial('b', { doseG: 21 })
    const c = trial('c', { grind: { grinder: { id: 'comandante-c40' }, size: 'medium_coarse', setting: '28 clicks' } })
    const assessment = assessTrialRepeatability(source, [a, b, c], a)
    expect(assessment.status).toBe('insufficient')
    expect(assessment.trials).toBe(1)
  })
})
