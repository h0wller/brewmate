import { describe, expect, it } from 'vitest'
import { findTerm, searchTerms, TERMS } from './glossary'

describe('glossary', () => {
  it('уникальные id', () => {
    const ids = TERMS.map(t => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
  it('findTerm находит существующий и undefined для чужого', () => {
    expect(findTerm('dose')?.title).toBe('Доза')
    expect(findTerm('nope')).toBeUndefined()
  })
  it('searchTerms без запроса возвращает всё', () => {
    expect(searchTerms('').length).toBe(TERMS.length)
  })
  it('searchTerms фильтрует по подстроке', () => {
    const r = searchTerms('помол')
    expect(r.length).toBeGreaterThan(0)
    expect(r.every(t => (t.title + t.short).toLowerCase().includes('помол'))).toBe(true)
  })
})