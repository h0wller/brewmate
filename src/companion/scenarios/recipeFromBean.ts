import type { BeanProfile } from '../../types'
import { recommend } from '../../beans/engine'
import type { MethodKey } from '../../beans/engine'
import { METHODS } from '../../beans/engine'

/* Детерминированный сценарий: рецепт по зерну (без LLM). */
export function recipeAdvice(bean: BeanProfile, method: MethodKey = 'v60', dose = 15): string {
  const rec = recommend(bean, method, 'balanced', dose)
  const water = Math.round(dose * rec.ratio)
  const lines = [
    `Метод: ${METHODS[method].label}.`,
    `Доза ${dose} г, вода ${water} г (пропорция 1:${rec.ratio}).`,
    `Температура ${rec.temp} °C.`,
    `Помол: уровень «${rec.size}»${rec.nudge === -1 ? ' (чуть мельче)' : rec.nudge === 1 ? ' (чуть крупнее)' : ''}.`,
    `Блюм: ${rec.bloom} с.`,
  ]
  if (rec.tips.length) lines.push('Советы: ' + rec.tips.join(' '))
  return lines.join('\n')
}