import { findTerm, TERMS } from '../glossary'

/* Объяснение термина из глоссария. Офлайн, без сети. */
export function explainTerm(termId: string): string {
  const t = findTerm(termId)
  if (!t) return 'Термин не найден. Попробуйте: доза, вода, пропорция, температура, помол, блум, TDS, экстракция, SCA, CVA, CoE.'
  return `${t.title}: ${t.short}${t.detail ? ' ' + t.detail : ''}`
}

export function listTerms(): string[] {
  return TERMS.map(term => term.id)
}