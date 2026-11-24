import { findTerm } from '../glossary'

/* Объяснение термина из глоссария. Офлайн, без сети. */
export function explainTerm(termId: string): string {
  const t = findTerm(termId)
  if (!t) return 'Термин не найден. Попробуйте: доза, вода, пропорция, температура, помол, блум, TDS, экстракция.'
  return `${t.title}: ${t.short}${t.detail ? ' ' + t.detail : ''}`
}

export function listTerms(): string[] {
  return findTerm('dose') ? ['dose', 'water', 'ratio', 'temp', 'grind', 'bloom', 'pour', 'tds', 'extraction', 'roast'] : []
}