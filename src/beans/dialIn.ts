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

const COMPASS_URL = 'https://www.baristahustle.com/coffee-compass/'

/**
 * Conservative next-cup advice based on the logged sensory outcome.
 * Changes one variable only; does not invent a numeric grinder setting.
 */
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
    trial: log.taste ? {
      sourceLogId: log.id,
      variable: log.taste === 'weak' ? 'dose' : 'grind',
      baselineTaste: log.taste,
    } : undefined,
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
