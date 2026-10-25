import type { BeanProfile, BrewStep, GrinderProfile, Recipe } from '../types'
import { METHODS, recommend } from '../beans/engine'
import type { MethodKey, RoastLevel, WaterKey } from '../beans/engine'
import { GRIND_SIZES, isGrindSize } from '../grinders/size'
import { grindFor } from '../grinders/profile'
import { uid } from '../storage'
import { fitStepsToWater } from './fit'

/* Шаги из ответа модели: мусор отбрасываем, пустое заменяем двумя простыми шагами */
export const sanitizeSteps = (raw: unknown): BrewStep[] => {
  const arr = Array.isArray(raw) ? raw : []
  const steps = arr
    .map((s: any) => ({ duration: +s?.duration || 0, pourTo: +s?.pourTo || 0, note: String(s?.note ?? '') }))
    .filter((s: BrewStep) => s.duration > 0 && s.pourTo > 0)
  return steps.length
    ? steps
    : [{ duration: 45, pourTo: 45, note: 'блюм' }, { duration: 60, pourTo: 240, note: 'долить' }]
}

/* Зерно из ответа модели поверх того, что уже введено руками */
export const pickBean = (b: any, base: BeanProfile): BeanProfile => ({
  ...base,
  name: typeof b?.name === 'string' && b.name ? b.name : base.name,
  origin: typeof b?.origin === 'string' ? b.origin : base.origin,
  process: typeof b?.process === 'string' ? b.process : base.process,
  roastLevel: ['light', 'medium', 'dark'].includes(b?.roastLevel) ? b.roastLevel as RoastLevel : base.roastLevel,
  roastDate: typeof b?.roastDate === 'string' ? b.roastDate : base.roastDate,
  notes: typeof b?.notes === 'string' && b.notes ? b.notes : base.notes,
})

/* Ответ модели → распознанное зерно и готовый рецепт под выбранные метод, дозу и воду */
export function buildAIResult(
  out: any,
  ctx: { bean: BeanProfile; method: MethodKey; doseG: number; water: WaterKey; profile: GrinderProfile },
): { bean: BeanProfile; recipe: Recipe } {
  const { method, doseG, water, profile } = ctx
  const bean = pickBean(out?.bean, ctx.bean)
  const r = out?.recipe ?? {}
  const rec = recommend(bean, method, water, doseG)
  const size = isGrindSize(r.grindSize) ? r.grindSize : rec.size
  /* клики считаем по уровню модели; сдвиг движка относится к его уровню, поэтому к чужому уровню не добавляем */
  const coarseness = isGrindSize(r.grindSize) && r.grindSize !== rec.size
    ? GRIND_SIZES.indexOf(r.grindSize)
    : rec.coarseness
  const dose = +r.doseG > 0 ? +r.doseG : doseG
  const ratio = +r.ratio > 0 ? +r.ratio : rec.ratio
  const waterG = Math.round(dose * ratio)
  return {
    bean,
    recipe: {
      id: uid(),
      title: r.title || `${bean.name || 'Зерно'} · AI · ${METHODS[method].label}`,
      method,
      doseG: dose,
      waterG,
      tempC: Math.max(85, Math.min(98, +r.tempC || rec.temp)),
      grind: grindFor(profile, size, coarseness),
      steps: fitStepsToWater(sanitizeSteps(r.steps), waterG),
      createdAt: Date.now(),
    },
  }
}
