import type { BrewLog } from '../../types'

/* Детерминированный совет по экстракции по записи журнала. */
export function extractionAdvice(log: BrewLog): string {
  const rating = log.rating ?? 0
  const lines: string[] = []
  if (rating <= 2) {
    lines.push('Оценка низкая — скорее всего недостаточная экстракция (кисло/водянисто) или перееэкстракция (горько).')
    lines.push('Попробуй: температуру +2°C, помол на шаг мельче, время +15 с.')
  } else if (rating === 3) {
    lines.push('Средний результат. Можно чуть увеличить температуру или уменьшить помол на полшага.')
  } else {
    lines.push('Хороший результат. Запомни пропорцию и помол как базу для этого зерна.')
  }
  if (log.notes) lines.push(`Заметка: «${log.notes.slice(0, 120)}»`)
  return lines.join('\n')
}