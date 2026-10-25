import { CATALOG as REGISTRY } from './catalog.generated'
import type { CatalogGrinder } from './catalog.generated'
import { EXTRA_ALIASES, EXTRA_GRINDERS } from './catalog.extra'

export { CATALOG_SOURCE } from './catalog.generated'
export type { CatalogGrinder } from './catalog.generated'

/* Реестр CoffeeJSON (CC0) + модели и псевдонимы, добавленные вручную (catalog.extra.ts) */
export const CATALOG: CatalogGrinder[] = [
  ...REGISTRY.map(g => EXTRA_ALIASES[g.id]
    ? { ...g, aliases: [...(g.aliases ?? []), ...EXTRA_ALIASES[g.id]] }
    : g),
  ...EXTRA_GRINDERS,
]

/* Модель из реестра CoffeeJSON: её id понимают другие приложения формата */
export const isRegistryGrinder = (id: string | undefined): boolean =>
  Boolean(id) && REGISTRY.some(g => g.id === id)

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9а-яё]+/g, ' ').trim()

/* Поиск по названию, id и псевдонимам; пустой запрос — весь каталог */
export function searchGrinders(query: string, limit = 12): CatalogGrinder[] {
  const q = norm(query)
  if (!q) return CATALOG.slice(0, limit)
  const words = q.split(' ')
  return CATALOG
    .filter(g => {
      const hay = norm([g.label, g.id, ...(g.aliases ?? [])].join(' '))
      return words.every(w => hay.includes(w))
    })
    .slice(0, limit)
}

export const findGrinder = (id: string | undefined): CatalogGrinder | undefined =>
  id ? CATALOG.find(g => g.id === id || g.aliases?.includes(id)) : undefined
