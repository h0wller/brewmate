import type { Grind } from '../types'
import { SIZE_LABEL, isGrindSize } from './size'
import { findGrinder } from './catalog'

const str = (v: unknown, max = 200): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined

/* Приводит что угодно к Grind. Старые рецепты хранили помол строкой
   («Comandante 24 клика») — она становится настройкой как есть. */
export function normalizeGrind(v: unknown): Grind | undefined {
  if (typeof v === 'string') {
    const setting = str(v)
    return setting ? { setting } : undefined
  }
  if (!v || typeof v !== 'object') return undefined
  const o = v as Record<string, unknown>
  const g: Grind = {}
  const gr = o.grinder
  if (gr && typeof gr === 'object') {
    const id = str((gr as Record<string, unknown>).id, 80)
    if (id) g.grinder = { id, label: str((gr as Record<string, unknown>).label, 120) }
  }
  const setting = str(o.setting)
  if (setting) g.setting = setting
  if (isGrindSize(o.size)) g.size = o.size
  return g.grinder || g.setting || g.size ? g : undefined
}

/* Привести поле grind у записи (рецепт, запись журнала) к актуальному виду */
/* принимает любой объект: у записи без поля grind возвращает её же */
export const migrateGrind = <T extends object>(x: T): T =>
  (x as { grind?: unknown }).grind === undefined
    ? x
    : { ...x, grind: normalizeGrind((x as { grind?: unknown }).grind) }

export const grinderLabel = (g: Grind | undefined): string | undefined =>
  g?.grinder ? (findGrinder(g.grinder.id)?.label ?? g.grinder.label ?? g.grinder.id) : undefined

/* Короткая строка для списков: «22 клика · средне-мелкий» (кофемолку — по флагу) */
export function formatGrind(g: Grind | undefined, opts: { withGrinder?: boolean } = {}): string {
  if (!g) return ''
  return [
    opts.withGrinder ? grinderLabel(g) : undefined,
    g.setting,
    g.size ? SIZE_LABEL[g.size] : undefined,
  ].filter(Boolean).join(' · ')
}
