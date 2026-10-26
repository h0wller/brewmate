import { describe, expect, it } from 'vitest'
import type { BrewLog } from '../types'
import { GRIND_SIZES } from '../grinders/size'
import { assessTrialOutcome, assessTrialRepeatability, diagnoseNextCup, findBestComparableBrew, makeTrialRecipe, recipeFromBestHistoricalBrew } from './dialIn'

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
    expect(trial.trial).toEqual({ sourceLogId: source.id, variable: 'grind', baselineTaste: 'sour' })
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
    expect(trial.trial).toEqual({ sourceLogId: source.id, variable: 'dose', baselineTaste: 'weak' })
    expect(trial.waterG).toBe(source.waterG)
    expect(trial.grind).toEqual(source.grind)
  })

  it('does not create a trial for balanced coffee', () => {
    expect(makeTrialRecipe(log({ taste: 'balanced' }))).toBeUndefined()
  })

  it('does not invent a finer target beyond the grind-size scale', () => {
    const source = log({ taste: 'sour', grind: { grinder: { id: 'test' }, setting: '1', size: GRIND_SIZES[0] } })
    const trial = makeTrialRecipe(source)!
    expect(trial.grind?.size).toBeUndefined()
    expect(trial.grind?.setting).toBeUndefined()
  })
})


describe('assessTrialOutcome', () => {
  it('marks a higher-rated balanced cup as promising but asks for replication', () => {
    const source = log({ taste: 'sour', rating: 3, finalG: 310 })
    const trial = log({ id: 'trial-1', trial: { sourceLogId: source.id, variable: 'grind', baselineTaste: 'sour' }, taste: 'balanced', rating: 4, durationS: 225, finalG: 300 })
    const result = assessTrialOutcome(source, trial)
    expect(result.verdict).toBe('promising')
    expect(result.summary).toContain('Повтори пробу')
    expect(result.evidence.some(x => x.includes('+1'))).toBe(true)
    expect(result.evidence.some(x => x.includes('Время:'))).toBe(true)
    expect(result.evidence.some(x => x.includes('Выход:'))).toBe(true)
  })

  it('flags lower rating as worse even when brew time is shorter', () => {
    const source = log({ taste: 'balanced', rating: 5, durationS: 240 })
    const trial = log({ id: 'trial-1', taste: 'sour', rating: 3, durationS: 180 })
    expect(assessTrialOutcome(source, trial).verdict).toBe('worse')
  })

  it('does not infer quality from time/yield alone', () => {
    const source = log({ rating: undefined, taste: undefined, durationS: 240, finalG: 300 })
    const trial = log({ id: 'trial-1', rating: undefined, taste: undefined, durationS: 200, finalG: 300 })
    const result = assessTrialOutcome(source, trial)
    expect(result.verdict).toBe('inconclusive')
    expect(result.summary).toContain('Недостаточно')
  })

  it('handles deleted source logs explicitly', () => {
    expect(assessTrialOutcome(undefined, log()).verdict).toBe('inconclusive')
  })
})


describe('findBestComparableBrew', () => {
  it('returns a high-rated balanced cup only for the same bean and method', () => {
    const current = log({ id: 'current', beanId: 'bean-1', taste: 'sour' })
    const unrelatedBean = log({ id: 'other-bean', beanId: 'bean-2', rating: 5, taste: 'balanced', startedAt: 10 })
    const otherMethod = log({ id: 'other-method', beanId: 'bean-1', method: 'v60', rating: 5, taste: 'balanced', startedAt: 20 })
    const reference = log({ id: 'reference', beanId: 'bean-1', rating: 4, taste: 'balanced', startedAt: 30 })
    const higher = log({ id: 'higher', beanId: 'bean-1', rating: 5, taste: 'balanced', startedAt: 40 })
    expect(findBestComparableBrew(current, [unrelatedBean, otherMethod, reference, higher])).toBe(higher)
  })

  it('does not infer a historical reference without a bean identity', () => {
    const current = log({ beanId: undefined, beanName: undefined })
    const candidate = log({ id: 'candidate', rating: 5, taste: 'balanced' })
    expect(findBestComparableBrew(current, [candidate])).toBeUndefined()
  })

  it('does not treat a high rating without balanced taste as a confirmed reference', () => {
    const current = log({ beanId: 'bean-1' })
    const candidate = log({ id: 'candidate', beanId: 'bean-1', rating: 5, taste: 'sour' })
    expect(findBestComparableBrew(current, [candidate])).toBeUndefined()
  })
})


describe('recipeFromBestHistoricalBrew', () => {
  it('offers an explicit same-bean same-method balanced reference scaled to the selected dose', () => {
    const reference = log({
      id: 'reference',
      beanId: 'bean-1',
      method: 'moccamaster',
      doseG: 20,
      waterG: 334,
      tempC: 93,
      rating: 5,
      taste: 'balanced',
      steps: [
        { duration: 35, pourTo: 50, note: 'предсмачивание' },
        { duration: 240, pourTo: 334, note: 'цикл' },
      ],
    })
    const recipe = recipeFromBestHistoricalBrew({ id: 'bean-1', name: 'Эфиопия' }, 'moccamaster', 30, [reference])!
    expect(recipe.method).toBe('moccamaster')
    expect(recipe.reference).toEqual({ sourceLogId: reference.id, sourceRating: 5 })
    expect(recipe.doseG).toBe(30)
    expect(recipe.waterG).toBe(501)
    expect(recipe.tempC).toBe(93)
    expect(recipe.steps.map(s => s.pourTo)).toEqual([75, 501])
    expect(recipe.title).toContain('5/5')
  })

  it('does not reuse unrelated beans, methods, or cups without balanced sensory notes', () => {
    const base = log({ beanId: 'bean-1', rating: 5, taste: 'balanced' })
    const wrongBean = { ...base, id: 'wrong-bean', beanId: 'bean-2' }
    const wrongMethod = { ...base, id: 'wrong-method', method: 'v60' }
    const notBalanced = { ...base, id: 'not-balanced', taste: 'sour' as const }
    expect(recipeFromBestHistoricalBrew({ id: 'bean-1', name: 'Эфиопия' }, 'moccamaster', 20, [wrongBean, wrongMethod, notBalanced])).toBeUndefined()
  })

  it('does not reuse a recipe without a meaningful bean name or positive dose', () => {
    const reference = log({ beanId: 'bean-1', rating: 5, taste: 'balanced' })
    expect(recipeFromBestHistoricalBrew({ id: 'bean-1', name: ' ' }, 'moccamaster', 20, [reference])).toBeUndefined()
    expect(recipeFromBestHistoricalBrew({ id: 'bean-1', name: 'Эфиопия' }, 'moccamaster', 0, [reference])).toBeUndefined()
  })
})


describe('assessTrialRepeatability', () => {
  const source = log({ id: 'source', beanId: 'bean-1', beanName: 'Ethiopia', rating: 3, taste: 'sour' })
  const trial = (id: string, rating: number, taste: BrewLog['taste'], sourceLogId = source.id): BrewLog => log({
    id,
    beanId: 'bean-1',
    beanName: 'Ethiopia',
    trial: { sourceLogId, variable: 'grind', baselineTaste: 'sour' },
    rating,
    taste,
  })

  it('requires at least three sensory-rated trials before confirming repeatability', () => {
    const result = assessTrialRepeatability(source, [
      trial('t1', 4, 'balanced'),
      trial('t2', 4, 'balanced'),
    ])
    expect(result.status).toBe('insufficient')
    expect(result.trials).toBe(2)
  })

  it('confirms repeated positive sensory results without recorded deterioration', () => {
    const result = assessTrialRepeatability(source, [
      trial('t1', 4, 'balanced'),
      trial('t2', 4, 'balanced'),
      trial('t3', 5, 'balanced'),
    ])
    expect(result.status).toBe('confirmed')
    expect(result.positive).toBe(3)
    expect(result.summary).toContain('не универсальность')
  })

  it('keeps a mostly positive series provisional if any trial is worse', () => {
    const result = assessTrialRepeatability(source, [
      trial('t1', 4, 'balanced'),
      trial('t2', 4, 'balanced'),
      trial('t3', 2, 'sour'),
    ])
    expect(result.status).toBe('promising')
    expect(result.worse).toBe(1)
  })

  it('ignores trials from another source, bean, or brewing method', () => {
    const wrongSource = trial('wrong-source', 5, 'balanced', 'different-source')
    const wrongBean = { ...trial('wrong-bean', 5, 'balanced'), beanId: 'bean-2' }
    const wrongMethod = { ...trial('wrong-method', 5, 'balanced'), method: 'v60' }
    const result = assessTrialRepeatability(source, [wrongSource, wrongBean, wrongMethod])
    expect(result.status).toBe('insufficient')
    expect(result.trials).toBe(0)
  })

  it('does not count records without sensory notes or ratings', () => {
    const unscored = trial('unscored', undefined as unknown as number, undefined)
    unscored.rating = undefined
    const result = assessTrialRepeatability(source, [unscored])
    expect(result.trials).toBe(0)
  })
})
