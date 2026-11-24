import type { BeanProfile, BrewLog, Recipe } from '../types'
import type { Route } from '../route'

/* Сборка короткой строки контекста для компаньона по текущему маршруту.
   Детерминированная, без сети — работает офлайн. */
export function buildContext(
  route: Route,
  recipes: Recipe[],
  beans: BeanProfile[],
  logs: BrewLog[],
): string {
  if (route.name === 'timer' || route.name === 'edit') {
    const r = route.id ? recipes.find(x => x.id === route.id) : undefined
    if (!r) return ''
    return `Рецепт: ${r.title}, ${r.doseG} г кофе, ${r.waterG} г воды, ${r.tempC} °C${r.grind ? ', помол ' + r.grind : ''}`
  }
  if (route.name === 'bean') {
    const b = route.id ? beans.find(x => x.id === route.id) : undefined
    if (!b) return ''
    const parts = [b.name || 'без названия']
    if (b.origin) parts.push(b.origin)
    if (b.process) parts.push(b.process)
    if (b.roastLevel) parts.push(b.roastLevel)
    return `Зерно: ${parts.join(', ')}`
  }
  if (route.name === 'entry') {
    const l = route.id ? logs.find(x => x.id === route.id) : undefined
    if (!l) return ''
    return `Запись в журнале: оценка ${l.rating ?? '—'}${l.notes ? ', ' + l.notes.slice(0, 80) : ''}`
  }
  return ''
}