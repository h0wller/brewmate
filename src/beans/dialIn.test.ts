import { describe, expect, it } from 'vitest'
import type { BrewLog } from '../types'
import { GRIND_SIZES } from '../grinders/size'
import { assessTrialOutcome, assessTrialRepeatability, assessTrialEvidenceConfidence, diagnoseNextCup, findBestComparableBrew, makeTrialRecipe, recipeFromBestHistoricalBrew, summarizeBeanHistory, planNextExperiment } from './dialIn'

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
    expect(trial.beanId).toBe(source.beanId)
    expect(trial.beanRoastDate).toBe(source.beanRoastDate)
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
  it('renders sensory enums using Russian labels', () => {
    const source = log({ taste: 'sour', rating: 3 })
    const trial = log({ id: 'trial-ru', taste: 'balanced', rating: 4 })
    expect(assessTrialOutcome(source, trial).evidence).toContain('Вкус: Кисло → Баланс')
  })

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

  it('refuses to compare cups from different brewers, beans, roast dates, or grinder models', () => {
    const source = log({ beanId: 'bean-a', beanRoastDate: '2026-10-01', rating: 3, taste: 'sour' })
    expect(assessTrialOutcome(source, log({ method: 'v60', beanId: 'bean-a', beanRoastDate: '2026-10-01', rating: 4, taste: 'balanced' })).verdict).toBe('inconclusive')
    expect(assessTrialOutcome(source, log({ beanId: 'bean-b', beanRoastDate: '2026-10-01', rating: 4, taste: 'balanced' })).verdict).toBe('inconclusive')
    expect(assessTrialOutcome(source, log({ beanId: 'bean-a', beanRoastDate: '2026-09-01', rating: 4, taste: 'balanced' })).verdict).toBe('inconclusive')
    expect(assessTrialOutcome(source, log({ beanId: 'bean-a', beanRoastDate: '2026-10-01', grind: { grinder: { id: 'other-grinder' }, size: 'medium_coarse' }, rating: 4, taste: 'balanced' })).verdict).toBe('inconclusive')
  })

  it('handles deleted source logs explicitly', () => {
    expect(assessTrialOutcome(undefined, log()).verdict).toBe('inconclusive')
  })
})


describe('planNextExperiment', () => {
  it('repeats a balanced experimental recipe unchanged before suggesting another adjustment', () => {
    const source = log({ id: 'source', taste: 'sour', beanId: 'bean-1' })
    const successful = log({
      id: 'trial-1', taste: 'balanced', rating: 4, beanId: 'bean-1',
      trial: { sourceLogId: 'source', variable: 'grind', baselineTaste: 'sour' },
      grind: { grinder: { id: 'comandante-c40' }, setting: 'unset', size: 'medium' },
    })
    const plan = planNextExperiment(successful, [source, successful])
    expect(plan.kind).toBe('repeat')
    expect(plan.recipe?.doseG).toBe(successful.doseG)
    expect(plan.recipe?.waterG).toBe(successful.waterG)
    expect(plan.recipe?.tempC).toBe(successful.tempC)
    expect(plan.recipe?.grind?.size).toBe(successful.grind?.size)
    expect(plan.recipe?.trial?.sourceLogId).toBe('source')
  })

  it('changes only one variable when the taste is not balanced', () => {
    const source = log({ id: 'source', taste: 'sour', beanId: 'bean-1' })
    const plan = planNextExperiment(source, [source])
    expect(plan.kind).toBe('adjust')
    expect(plan.recipe?.grind?.size).toBe('medium')
    expect(plan.recipe?.doseG).toBe(source.doseG)
    expect(plan.recipe?.waterG).toBe(source.waterG)
    expect(plan.recipe?.tempC).toBe(source.tempC)
  })

  it('does not present an already-tested adjustment as new', () => {
    const source = log({ id: 'source', taste: 'sour', beanId: 'bean-1' })
    const attempted = log({
      id: 'trial-1', taste: 'sour', beanId: 'bean-1',
      trial: { sourceLogId: 'source', variable: 'grind', baselineTaste: 'sour' },
      grind: { grinder: { id: 'comandante-c40' }, setting: undefined, size: 'medium' },
    })
    const plan = planNextExperiment(source, [source, attempted])
    expect(plan.kind).toBe('repeat')
    expect(plan.title).toContain('Повторить')
    expect(plan.recipe?.grind?.size).toBe(source.grind?.size)
  })

  it('does not invent an experiment before sensory feedback is recorded', () => {
    const plan = planNextExperiment(log({ taste: undefined }), [])
    expect(plan.kind).toBe('stop')
    expect(plan.recipe).toBeUndefined()
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

  it('filters journal comparisons by exact grinder and roast-date snapshot when supplied', () => {
    const current = log({ id: 'current', beanId: 'bean-1', beanRoastDate: '2026-10-01' })
    const match = log({ id: 'match', beanId: 'bean-1', beanRoastDate: '2026-10-01', rating: 5, taste: 'balanced' })
    const otherGrinder = log({ id: 'other-grinder', beanId: 'bean-1', beanRoastDate: '2026-10-01', grind: { grinder: { id: 'other' }, size: 'medium_coarse' }, rating: 5, taste: 'balanced', startedAt: 20 })
    const otherRoast = log({ id: 'other-roast', beanId: 'bean-1', beanRoastDate: '2026-09-01', rating: 5, taste: 'balanced', startedAt: 30 })
    expect(findBestComparableBrew(current, [otherGrinder, otherRoast, match], {
      grinderId: 'comandante-c40', roastDate: '2026-10-01',
    })).toBe(match)
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
  const trial = (id: string, rating: number | undefined, taste: BrewLog['taste'], sourceLogId = source.id): BrewLog => log({
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

  it('does not combine different experimental settings into one repeatability claim', () => {
    const target = trial('target', 4, 'balanced')
    target.grind = { ...target.grind!, setting: '30 clicks' }
    const matching = { ...target, id: 'matching' }
    const otherSetting = { ...trial('other-setting', 5, 'balanced'), grind: { ...target.grind!, setting: '28 clicks' } }
    const result = assessTrialRepeatability(source, [matching, otherSetting, { ...matching, id: 'matching-2' }, { ...matching, id: 'matching-3' }], target)
    expect(result.status).toBe('confirmed')
    expect(result.trials).toBe(3)
    expect(result.positive).toBe(3)
  })

  it('does not mix different recipe signatures when assessing a series without an explicit target', () => {
    const a = trial('a', 4, 'balanced')
    const b = { ...trial('b', 4, 'balanced'), doseG: 21 }
    const c = { ...trial('c', 5, 'balanced'), grind: { ...trial('c', 5, 'balanced').grind!, size: 'medium_fine' as const } }
    const result = assessTrialRepeatability(source, [a, b, c])
    expect(result.trials).toBe(1)
    expect(result.status).toBe('insufficient')
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

  it('requires both a taste label and a valid 1–5 rating for every counted trial', () => {
    const noTaste = trial('no-taste', 4, undefined)
    const noRating = trial('no-rating', undefined, 'balanced')
    const invalidRating = trial('invalid-rating', 6, 'balanced')
    expect(assessTrialRepeatability(source, [noTaste, noRating, invalidRating]).trials).toBe(0)
  })

  it('does not count records without sensory notes or ratings', () => {
    const unscored = trial('unscored', undefined, undefined)
    unscored.rating = undefined
    const result = assessTrialRepeatability(source, [unscored])
    expect(result.trials).toBe(0)
  })
})



describe('assessTrialEvidenceConfidence', () => {
  const source = log({ id: 'source', beanId: 'bean-1', beanRoastDate: '2026-10-01', taste: 'sour', rating: 3 })
  const trial = (id: string, rating: number, taste: BrewLog['taste'] = 'balanced') => log({
    id, beanId: 'bean-1', beanRoastDate: '2026-10-01', taste, rating,
    trial: { sourceLogId: 'source', variable: 'grind', baselineTaste: 'sour' },
  })

  it('keeps a single successful cup at hypothesis level', () => {
    const one = trial('one', 4)
    const result = assessTrialEvidenceConfidence(source, [one], one)
    expect(result.status).toBe('hypothesis')
    expect(result.ratedTrials).toBe(1)
  })

  it('marks two similar balanced cups as preliminary, not repeatable', () => {
    const a = trial('a', 4), b = trial('b', 5)
    const result = assessTrialEvidenceConfidence(source, [a, b], a)
    expect(result.status).toBe('preliminary')
    expect(result.meanRating).toBe(4.5)
  })

  it('requires three balanced cups with a narrow rating range for repeatable evidence', () => {
    const a = trial('a', 4), b = trial('b', 5), c = trial('c', 4)
    expect(assessTrialEvidenceConfidence(source, [a, b, c], a).status).toBe('repeatable')
    const inconsistent = trial('d', 2)
    expect(assessTrialEvidenceConfidence(source, [a, b, inconsistent], a).status).toBe('hypothesis')
  })

  it('does not mix different recipe signatures or roast snapshots', () => {
    const a = trial('a', 4), b = trial('b', 4)
    const differentRecipe = trial('c', 5)
    differentRecipe.doseG = 21
    const otherRoast = trial('d', 5)
    otherRoast.beanRoastDate = '2026-09-01'
    const result = assessTrialEvidenceConfidence(source, [a, b, differentRecipe, otherRoast], a)
    expect(result.ratedTrials).toBe(2)
    expect(result.status).toBe('preliminary')
  })
})

describe('summarizeBeanHistory', () => {
  const bean = { id: 'bean-1', roastDate: '2026-10-01' }
  const sameSetup = (p: Partial<BrewLog> = {}) => log({
    id: 'history',
    beanId: bean.id,
    beanRoastDate: bean.roastDate,
    method: 'moccamaster',
    grind: { grinder: { id: 'comandante-c40' }, size: 'medium_coarse', setting: '28 clicks' },
    doseG: 20,
    waterG: 334,
    tempC: 93,
    rating: 4,
    taste: 'balanced',
    ...p,
  })

  it('summarizes only matching bean, method, grinder and roast-date snapshot', () => {
    const result = summarizeBeanHistory(bean, 'moccamaster', 'comandante-c40', [
      sameSetup({ id: 'a', rating: 4, waterG: 320, tempC: 92 }),
      sameSetup({ id: 'b', rating: 5, waterG: 340, tempC: 94 }),
      sameSetup({ id: 'other-bean', beanId: 'bean-2' }),
      sameSetup({ id: 'other-roast', beanRoastDate: '2026-09-01' }),
      sameSetup({ id: 'other-grinder', grind: { grinder: { id: '1zpresso-k-ultra' }, size: 'medium_coarse' } }),
      sameSetup({ id: 'other-method', method: 'v60' }),
    ])
    expect(result.brews).toBe(2)
    expect(result.ratedBrews).toBe(2)
    expect(result.balancedBrews).toBe(2)
    expect(result.meanRating).toBe(4.5)
    expect(result.meanRatio).toBe(16.5)
    expect(result.medianTempC).toBe(93)
    expect(result.tempRange).toEqual([92, 94])
    expect(result.ratioRange).toEqual([16, 17])
    expect(result.confidence).toBe('early-signal')
  })

  it('marks at least three consistently balanced high-rated cups as a repeatable signal', () => {
    const result = summarizeBeanHistory(bean, 'moccamaster', 'comandante-c40', [
      sameSetup({ id: 'a', rating: 4, taste: 'balanced' }),
      sameSetup({ id: 'b', rating: 5, taste: 'balanced' }),
      sameSetup({ id: 'c', rating: 4, taste: 'balanced' }),
    ])
    expect(result.confidence).toBe('repeatable')
    expect(result.confidenceNote).toContain('не доказывает причинность')
  })

  it('does not call three poorly rated or unbalanced cups a positive signal', () => {
    const result = summarizeBeanHistory(bean, 'moccamaster', 'comandante-c40', [
      sameSetup({ id: 'a', rating: 4, taste: 'sour' }),
      sameSetup({ id: 'b', rating: 2, taste: 'balanced' }),
      sameSetup({ id: 'c', rating: 3, taste: 'bitter' }),
    ])
    expect(result.confidence).toBe('early-signal')
  })

  it('does not silently mix legacy records without roast-date snapshots', () => {
    const legacy = sameSetup({ beanRoastDate: undefined })
    expect(summarizeBeanHistory(bean, 'moccamaster', 'comandante-c40', [legacy]).brews).toBe(0)
  })

  it('does not convert grinder settings into a shared click scale', () => {
    const result = summarizeBeanHistory(bean, 'moccamaster', undefined, [
      sameSetup({ grind: { size: 'medium_coarse', setting: '28 clicks' } }),
      sameSetup(),
    ])
    expect(result.brews).toBe(1)
    expect(result.grindSizes).toEqual(['medium_coarse'])
  })
})

describe('historical recipe context guards', () => {
  it('does not reuse a cup from another roast date or grinder', () => {
    const reference = log({
      id: 'reference',
      beanId: 'bean-1',
      beanRoastDate: '2026-10-01',
      grind: { grinder: { id: 'comandante-c40' }, setting: '28 clicks', size: 'medium_coarse' },
      rating: 5,
      taste: 'balanced',
    })
    expect(recipeFromBestHistoricalBrew({ id: 'bean-1', name: 'Эфиопия' }, 'moccamaster', 20, [reference], {
      grinderId: '1zpresso-k-ultra', roastDate: '2026-10-01',
    })).toBeUndefined()
    expect(recipeFromBestHistoricalBrew({ id: 'bean-1', name: 'Эфиопия' }, 'moccamaster', 20, [reference], {
      grinderId: 'comandante-c40', roastDate: '2026-09-01',
    })).toBeUndefined()
    expect(recipeFromBestHistoricalBrew({ id: 'bean-1', name: 'Эфиопия' }, 'moccamaster', 20, [reference], {
      grinderId: undefined, roastDate: '2026-10-01',
    })).toBeUndefined()
    expect(recipeFromBestHistoricalBrew({ id: 'bean-1', name: 'Эфиопия' }, 'moccamaster', 20, [reference], {
      grinderId: 'comandante-c40', roastDate: undefined,
    })).toBeUndefined()
  })
})
