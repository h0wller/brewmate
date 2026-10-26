import type { BeanProfile, BrewStep, GrinderProfile, Recipe } from '../types'
import { METHODS, recommend, recipeFromBean } from '../beans/engine'
import type { MethodKey, RoastLevel, WaterKey } from '../beans/engine'
import { grindFor } from '../grinders/profile'
import { uid } from '../storage'

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
  process: base.process || (typeof b?.process === 'string' ? b.process : undefined),
  roastLevel: base.roastLevel ?? (['light', 'medium', 'dark'].includes(b?.roastLevel) ? b.roastLevel as RoastLevel : undefined),
  roastDate: base.roastDate || (typeof b?.roastDate === 'string' ? b.roastDate : undefined),
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
  /* AI распознаёт пачку, но расчёт рецепта остаётся у локального движка:
     метод/устройство, обжарка, дата, обработка, вода и доза дают одинаковый результат
     в AI- и обычном сценариях. Не доверяем модели произвольные ratio/temp/grindSize. */
  const recipe = recipeFromBean(bean, method, rec, grindFor(profile, rec.size, rec.coarseness), doseG)
  return {
    bean,
    recipe: {
      ...recipe,
      id: uid(),
      title: typeof r.title === 'string' && r.title.trim()
        ? r.title
        : `${bean.name || 'Зерно'} · AI · ${METHODS[method].label}`,
      createdAt: Date.now(),
    },
  }
}
