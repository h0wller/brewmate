import type { BrewLog, BrewStep, Recipe } from '../types'
import { GRIND_SIZES } from '../grinders/size'
import type { GrindSize } from '../grinders/size'
import { uid } from '../storage'

export interface DialInAdvice {
  title: string
  reason: string
  action: string
  confidence: 'starting-point' | 'no-change'
  sourceUrl: string
}

export interface TrialAssessment {
  verdict: 'promising' | 'worse' | 'mixed' | 'inconclusive'
  summary: string
  evidence: string[]
}

const COMPASS_URL = 'https://www.baristahustle.com/coffee-compass/'

/**
 * Compare an experimental brew with its source. Never call a single cup proof:
 * rating/taste are sensory evidence, while time/yield are context, not quality scores.
 */
export function assessTrialOutcome(source: BrewLog | undefined, trial: BrewLog): TrialAssessment {
  if (!source) return {
    verdict: 'inconclusive',
    summary: 'Исходная чашка не найдена: сравнение невозможно.',
    evidence: [],
  }

  const evidence: string[] = []
  const ratingDelta = source.rating !== undefined && trial.rating !== undefined
    ? trial.rating - source.rating
    : undefined
  if (ratingDelta !== undefined) {
    evidence.push(`Оценка: ${source.rating}/5 → ${trial.rating}/5 (${ratingDelta > 0 ? '+' : ''}${ratingDelta})`)
  }
  if (source.taste && trial.taste) {
    evidence.push(`Вкус: ${source.taste} → ${trial.taste}`)
  }
  if (source.durationS > 0 && trial.durationS > 0) {
    const delta = trial.durationS - source.durationS
    evidence.push(`Время: ${source.durationS} → ${trial.durationS} с (${delta > 0 ? '+' : ''}${delta} с)`)
  }
  if (source.finalG !== undefined && trial.finalG !== undefined) {
    evidence.push(`Выход: ${source.finalG.toFixed(1)} → ${trial.finalG.toFixed(1)} г`)
  }

  const tasteImproved = Boolean(source.taste && trial.taste &&
    source.taste !== 'balanced' && trial.taste === 'balanced')
  const ratingImproved = ratingDelta !== undefined && ratingDelta > 0
  const ratingWorse = ratingDelta !== undefined && ratingDelta < 0
  const tasteWorse = Boolean(source.taste && trial.taste &&
    source.taste === 'balanced' && trial.taste !== 'balanced')

  if (ratingImproved && !tasteWorse || tasteImproved && !ratingWorse) return {
    verdict: 'promising',
    summary: 'Есть положительный сигнал. Повтори пробу с тем же зерном и методом, прежде чем считать настройку подтверждённой.',
    evidence,
  }
  if (ratingWorse || tasteWorse) return {
    verdict: 'worse',
    summary: 'Результат выглядит хуже исходного. Рассмотри возврат к исходной настройке; одна чашка всё ещё не доказывает причинность.',
    evidence,
  }
  if (ratingDelta !== undefined && ratingDelta === 0 && source.taste && trial.taste && source.taste === trial.taste) return {
    verdict: 'mixed',
    summary: 'Заметного улучшения по записанным сенсорным данным нет. Не меняй дополнительные параметры одновременно.',
    evidence,
  }
  return {
    verdict: 'inconclusive',
    summary: 'Недостаточно сопоставимых сенсорных данных. Отметь вкус и оценку обеих чашек; время и выход сами по себе не говорят, какая чашка вкуснее.',
    evidence,
  }
}

/** Conservative next-cup advice based on logged sensory outcome. */
export function diagnoseNextCup(log: BrewLog): DialInAdvice {
  if (log.taste === 'sour') return {
    title: 'Проверить экстракцию',
    reason: 'Кислота сама по себе не доказывает недоэкстракцию, но это разумная первая гипотеза при отсутствии других данных.',
    action: 'На следующей чашке сделай помол на один небольшой шаг мельче. Не меняй одновременно температуру, дозу и пропорцию.',
    confidence: 'starting-point',
    sourceUrl: COMPASS_URL,
  }
  if (log.taste === 'bitter') return {
    title: 'Проверить чрезмерную экстракцию',
    reason: 'Горечь может быть связана с экстракцией, но также с обжаркой и самим зерном; меняем только один параметр, чтобы проверить гипотезу.',
    action: 'На следующей чашке сделай помол на один небольшой шаг крупнее. Не задавай универсальное число кликов: используй шкалу выбранной кофемолки.',
    confidence: 'starting-point',
    sourceUrl: COMPASS_URL,
  }
  if (log.taste === 'weak') return {
    title: 'Проверить крепость напитка',
    reason: 'Водянистость чаще требует проверить концентрацию, а не автоматически менять помол: слабая чашка не равна недоэкстрагированной.',
    action: `Оставь воду, помол и температуру без изменений, увеличь дозу кофе примерно на 5% (с ${log.doseG} до ${Math.round(log.doseG * 1.05 * 10) / 10} г).`,
    confidence: 'starting-point',
    sourceUrl: COMPASS_URL,
  }
  return {
    title: 'Не менять рецепт',
    reason: 'Для сбалансированной чашки нет сенсорного основания менять настройки.',
    action: 'Сохрани текущий рецепт как контрольный. Меняй параметры только при наличии конкретной цели.',
    confidence: 'no-change',
    sourceUrl: COMPASS_URL,
  }
}

function adjacentSize(size: GrindSize | undefined, direction: -1 | 1): GrindSize | undefined {
  if (!size) return undefined
  const index = GRIND_SIZES.indexOf(size)
  if (index < 0) return undefined
  const next = index + direction
  if (next < 0 || next >= GRIND_SIZES.length) return undefined
  return GRIND_SIZES[next]
}

/** Creates a separate, explicitly experimental recipe; the source log is never mutated. */
export function makeTrialRecipe(log: BrewLog): Recipe | undefined {
  if (!log.taste || log.taste === 'balanced') return undefined
  const now = Date.now()
  const base: Recipe = {
    id: uid(),
    title: `Проба · ${log.title}`,
    method: log.method,
    doseG: log.doseG,
    waterG: log.waterG,
    tempC: log.tempC,
    grind: log.grind ? { ...log.grind } : undefined,
    steps: log.steps.map((s: BrewStep) => ({ ...s })),
    createdAt: now,
    updatedAt: now,
    trial: {
      sourceLogId: log.id,
      variable: log.taste === 'weak' ? 'dose' : 'grind',
      baselineTaste: log.taste,
    },
  }

  if (log.taste === 'sour' || log.taste === 'bitter') {
    const direction = log.taste === 'sour' ? -1 : 1
    const size = adjacentSize(log.grind?.size, direction)
    if (log.grind && size) {
      // A dial setting for the previous particle-size target is not valid for the new target.
      base.grind = { ...log.grind, size, setting: undefined }
    } else {
      // Without a known size, keep the record honest and ask for a small manual adjustment.
      base.grind = log.grind ? { grinder: log.grind.grinder } : undefined
    }
  } else if (log.taste === 'weak') {
    base.doseG = Math.round(log.doseG * 1.05 * 10) / 10
  }
  return base
}

/**
 * Finds a prior high-rated balanced cup for the same bean and brewing method.
 * Requires a stable bean identifier/name match; never compares unrelated coffees.
 */
export function findBestComparableBrew(current: BrewLog, history: BrewLog[]): BrewLog | undefined {
  const hasBeanIdentity = Boolean(current.beanId || current.beanName)
  if (!hasBeanIdentity) return undefined
  return history
    .filter(candidate => {
      if (candidate.id === current.id || candidate.method !== current.method) return false
      const sameBean = current.beanId
        ? candidate.beanId === current.beanId
        : !candidate.beanId && candidate.beanName === current.beanName
      return sameBean && candidate.rating !== undefined && candidate.rating >= 4 && candidate.taste === 'balanced'
    })
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || b.startedAt - a.startedAt)[0]
}


/**
 * Build an explicitly user-selected recipe from the best logged balanced cup
 * for the same bean name and method. Historical values are preserved proportionally;
 * this is a starting point, not an automatic override of the local recommendation.
 */
export function recipeFromBestHistoricalBrew(
  bean: { id: string; name: string },
  method: string,
  doseG: number,
  history: BrewLog[],
  context: { grinderId?: string; roastDate?: string } = {},
): Recipe | undefined {
  const name = bean.name.trim().toLocaleLowerCase()
  if (!name || !Number.isFinite(doseG) || doseG <= 0) return undefined
  const reference = history
    .filter(log =>
      log.method === method &&
      (context.grinderId === undefined || log.grind?.grinder?.id === context.grinderId) &&
      (context.roastDate === undefined || log.beanRoastDate === context.roastDate) &&
      log.rating !== undefined && log.rating >= 4 &&
      log.taste === 'balanced' &&
      (log.beanId === bean.id || (!log.beanId && log.beanName?.trim().toLocaleLowerCase() === name)),
    )
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || b.startedAt - a.startedAt)[0]
  if (!reference) return undefined

  const scale = doseG / reference.doseG
  const waterG = Math.round(reference.waterG * scale)
  const now = Date.now()
  return {
    id: uid(),
    title: `${bean.name} · проверенный ориентир · ${reference.rating}/5`,
    reference: { sourceLogId: reference.id, sourceRating: reference.rating! },
    method: reference.method,
    beanId: bean.id,
    beanRoastDate: context.roastDate,
    doseG,
    waterG,
    tempC: reference.tempC,
    grind: reference.grind ? { ...reference.grind } : undefined,
    steps: reference.steps.map(step => ({
      ...step,
      pourTo: Math.round(step.pourTo * scale),
    })),
    createdAt: now,
    updatedAt: now,
  }
}


export interface RepeatabilityAssessment {
  status: 'confirmed' | 'promising' | 'inconsistent' | 'insufficient'
  trials: number
  positive: number
  worse: number
  unchanged: number
  summary: string
}

/**
 * Assess repeatability across independent recorded trials of the same hypothesis.
 * A single cup cannot confirm a setting; require at least three sensory-rated trials,
 * and a two-thirds positive share, before calling the result repeatable.
 */
export function assessTrialRepeatability(source: BrewLog, history: BrewLog[]): RepeatabilityAssessment {
  const trials = history.filter(log =>
    log.trial?.sourceLogId === source.id &&
    log.method === source.method &&
    log.id !== source.id &&
    (log.beanId ? log.beanId === source.beanId : log.beanName === source.beanName) &&
    (log.taste !== undefined || log.rating !== undefined),
  )

  let positive = 0
  let worse = 0
  let unchanged = 0
  for (const trial of trials) {
    const ratingDelta = source.rating !== undefined && trial.rating !== undefined
      ? trial.rating - source.rating
      : undefined
    const tasteImproved = Boolean(source.taste && trial.taste &&
      source.taste !== 'balanced' && trial.taste === 'balanced')
    const tasteWorse = Boolean(source.taste === 'balanced' && trial.taste && trial.taste !== 'balanced')
    if ((ratingDelta !== undefined && ratingDelta > 0 && !tasteWorse) ||
      (tasteImproved && !(ratingDelta !== undefined && ratingDelta < 0))) positive++
    else if ((ratingDelta !== undefined && ratingDelta < 0) || tasteWorse) worse++
    else unchanged++
  }

  if (trials.length < 3) return {
    status: 'insufficient', trials: trials.length, positive, worse, unchanged,
    summary: `Для оценки повторяемости нужно минимум 3 записанные пробы с сенсорной оценкой. Сейчас доступно: ${trials.length}.`,
  }

  const positiveShare = positive / trials.length
  if (positiveShare >= 2 / 3 && worse === 0) return {
    status: 'confirmed', trials: trials.length, positive, worse, unchanged,
    summary: 'Результат повторяется в большинстве записанных проб без отмеченного ухудшения. Это подтверждает практическую воспроизводимость в этих условиях, но не универсальность настройки.',
  }
  if (positiveShare >= 2 / 3) return {
    status: 'promising', trials: trials.length, positive, worse, unchanged,
    summary: 'Большинство проб положительные, но есть и ухудшение. Результат перспективный, однако настройку пока рано считать устойчивой.',
  }
  if (worse > positive) return {
    status: 'inconsistent', trials: trials.length, positive, worse, unchanged,
    summary: 'Результаты не подтверждают устойчивое улучшение. Проверь повторяемость дозы, воды, зерна и техники перед дальнейшими изменениями.',
  }
  return {
    status: 'inconsistent', trials: trials.length, positive, worse, unchanged,
    summary: 'Результаты смешанные: пока недостаточно оснований считать настройку воспроизводимо лучшей.',
  }
}


export interface BeanHistoryEvidence {
  brews: number
  ratedBrews: number
  balancedBrews: number
  meanRating?: number
  meanRatio?: number
  medianTempC?: number
  grindSizes: string[]
  roastDate?: string
}

/**
 * Summarize only comparable brews: exact bean identity, method, grinder model and
 * roast-date snapshot. Missing historical snapshots are not silently treated as matches.
 */
export function summarizeBeanHistory(
  bean: { id: string; roastDate?: string },
  method: string,
  grinderId: string | undefined,
  history: BrewLog[],
): BeanHistoryEvidence {
  const comparable = history.filter(log =>
    log.beanId === bean.id &&
    log.method === method &&
    (log.grind?.grinder?.id ?? undefined) === grinderId &&
    (bean.roastDate ? log.beanRoastDate === bean.roastDate : !log.beanRoastDate),
  )
  const rated = comparable.filter(log => log.rating !== undefined && Number.isFinite(log.rating))
  const temps = comparable.map(log => log.tempC).filter(Number.isFinite).sort((a, b) => a - b)
  const ratios = comparable.filter(log => log.doseG > 0 && log.waterG > 0).map(log => log.waterG / log.doseG)
  const sizes = [...new Set(comparable.map(log => log.grind?.size).filter((v): v is GrindSize => Boolean(v)))]
  return {
    brews: comparable.length,
    ratedBrews: rated.length,
    balancedBrews: comparable.filter(log => log.taste === 'balanced').length,
    meanRating: rated.length ? Math.round((rated.reduce((sum, log) => sum + (log.rating ?? 0), 0) / rated.length) * 10) / 10 : undefined,
    meanRatio: ratios.length ? Math.round((ratios.reduce((sum, value) => sum + value, 0) / ratios.length) * 10) / 10 : undefined,
    medianTempC: temps.length ? temps[Math.floor((temps.length - 1) / 2)] : undefined,
    grindSizes: sizes,
    roastDate: bean.roastDate,
  }
}
