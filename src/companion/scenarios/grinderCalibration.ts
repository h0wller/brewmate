import type { GrinderProfile } from '../../types'
import { smartSettingFor } from '../../grinders/profile'
import { SIZE_LABEL } from '../../grinders/size'
import type { GrindSize } from '../../grinders/size'
import type { Recipe } from '../../types'

/* Детерминированный сценарий: калибровка кофемолки. Перевод кликов между
   разными кофемолками сознательно не поддерживается. */
export function grinderCalibrationAdvice(profile: GrinderProfile, recipe?: Recipe): string {
  if (!recipe) return 'Откройте сохранённый рецепт или таймер, чтобы подсказать настройку именно для его помола. Не буду подставлять условное «средний / 3.0».'

  const grind = recipe.grind
  if (!grind?.size) return `В рецепте «${recipe.title}» уровень помола не задан. Выберите его в редакторе рецепта — тогда можно подобрать ориентир для кофемолки.`

  const size: GrindSize = grind.size
  const coarseness = ['extra_fine', 'fine', 'medium_fine', 'medium', 'medium_coarse', 'coarse', 'extra_coarse'].indexOf(size)
  const lines = [
    `Рецепт: ${recipe.title}.`,
    `Уровень помола: ${SIZE_LABEL[size]} (крупность ${coarseness.toFixed(1)} по общей шкале 0–6, не клики).`,
  ]
  const recipeGrinderId = grind.grinder?.id
  const activeGrinderId = profile.grinder?.id
  const sameGrinder = !recipeGrinderId || recipeGrinderId === activeGrinderId

  if (grind.setting && sameGrinder) {
    lines.push(`В рецепте сохранена настройка: ${grind.setting}.`)
  } else if (grind.setting && recipeGrinderId && activeGrinderId && recipeGrinderId !== activeGrinderId) {
    const activeGrinder = profile.grinder
    if (activeGrinder) {
      lines.push(`В рецепте сохранена настройка для ${grind.grinder?.label ?? recipeGrinderId}: ${grind.setting}. Её не переносим на ${activeGrinder.label ?? activeGrinder.id}.`)
      const calibrated = smartSettingFor(profile, size, coarseness)
      if (calibrated) lines.push(`Ориентир по калибровке ${activeGrinder.label ?? activeGrinder.id}: ${calibrated} (проверьте по вкусу и протоку).`)
    }
  } else if (profile.grinder) {
    const setting = smartSettingFor(profile, size, coarseness)
    if (setting) lines.push(`Ориентир для ${profile.grinder.label ?? profile.grinder.id}: ${setting}.`)
    else lines.push('Для этой кофемолки нет калибровки на выбранный уровень помола.')
  } else {
    if (grind.setting) lines.push(`В рецепте сохранена настройка ${grind.setting} для ${grind.grinder?.label ?? grind.grinder?.id ?? 'неуказанной кофемолки'}.`)
    lines.push('Кофемолка не выбрана — укажите её в настройках, чтобы получить калиброванный ориентир.')
  }

  lines.push('Не переносите количество кликов между разными кофемолками. Итоговый помол проверяйте по вкусу и времени пролива.')
  return lines.join('\\n')
}
