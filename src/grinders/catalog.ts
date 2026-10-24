import { CATALOG } from './catalog.generated'
import type { CatalogGrinder } from './catalog.generated'

export { CATALOG, CATALOG_SOURCE } from './catalog.generated'
export type { CatalogGrinder } from './catalog.generated'

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
