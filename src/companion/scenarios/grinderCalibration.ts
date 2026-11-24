import type { GrinderProfile } from '../../types'
import { smartSettingFor } from '../../grinders/profile'
import { SIZE_LABEL } from '../../grinders/size'
import type { GrindSize } from '../../grinders/size'

/* Детерминированный сценарий: калибровка кофемолки. Перевод кликов между
   разными кофемолками сознательно не поддерживается. */
export function grinderCalibrationAdvice(profile: GrinderProfile, size: GrindSize, coarseness: number): string {
  const lines = [
    `Уровень помола: ${SIZE_LABEL[size]} (крупность ${coarseness.toFixed(1)}).`,
  ]
  if (profile?.grinder) {
    const setting = smartSettingFor(profile, size, coarseness)
    if (setting !== undefined) {
      lines.push(`Ориентир для вашей кофемолки: ${setting} (≈, не точные клики).`)
    }
  } else {
    lines.push('Кофемолка не выбрана — выберите модель в настройках, чтобы получить ориентир.')
  }
  lines.push('Важно: перевод кликов между разными кофемолками не поддерживается. Калибруйте свою кофемолку отдельно.')
  lines.push('Итоговый помол всегда проверяйте по вкусу и времени пролива.')
  return lines.join('\n')
}