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
  const next = Math.max(0, Math.min(GRIND_SIZES.length - 1, index + direction))
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
