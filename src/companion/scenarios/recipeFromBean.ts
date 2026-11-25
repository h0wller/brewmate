import type { BeanProfile } from '../../types'
import { recommend } from '../../beans/engine'
import type { MethodKey, WaterKey } from '../../beans/engine'
import { METHODS, WATER_PROFILES } from '../../beans/engine'
import type { SkillLevel } from '../level'

/* Детерминированный сценарий: рецепт по зерну (без LLM). */
export function recipeAdvice(
  bean: BeanProfile,
  method: MethodKey = 'v60',
  dose = 15,
  waterProfile: WaterKey = 'balanced',
  level: SkillLevel = 'enthusiast',
): string {
  const rec = recommend(bean, method, waterProfile, dose)
  const water = Math.round(dose * rec.ratio)
  const lines = [
    `Метод: ${METHODS[method].label}.`,
    `Доза ${dose} г, вода ${water} г (пропорция 1:${rec.ratio}).`,
    `Профиль воды: ${WATER_PROFILES[waterProfile].label.replace(/^\\S+\\s/, '')}.`,
    `Температура ${rec.temp} °C.`,
    `Помол: ${rec.size}${rec.nudge === -1 ? ' (чуть мельче)' : rec.nudge === 1 ? ' (чуть крупнее)' : ''}.`,
    `Блюм: ${rec.bloom} с.`,
  ]
  if (level === 'beginner') {
    lines.push('Начни с этих параметров и меняй за раз только один показатель.')
  } else if (level === 'pro') {
    lines.push(`Ориентир общей шкалы крупности: ${rec.coarseness.toFixed(1)} из 6 — это не клики конкретной кофемолки.`)
    lines.push('Меняй один параметр за итерацию и фиксируй время/вкус, чтобы оценивать причинную связь.')
  } else {
    lines.push('Используй это как стартовую точку и корректируй по вкусу и времени пролива.')
  }
  if (rec.tips.length) lines.push('Советы: ' + rec.tips.join(' '))
  return lines.join('\\n')
}
