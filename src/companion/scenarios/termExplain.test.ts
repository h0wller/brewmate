import { describe, expect, it } from 'vitest'
import { explainTerm, listTerms } from './termExplain'

describe('termExplain', () => {
  it('объясняет известный термин', () => {
    const r = explainTerm('dose')
    expect(r).toContain('Доза')
    expect(r).toContain('граммах')
  })
  it('для неизвестного — подсказка', () => {
    expect(explainTerm('nope')).toContain('Термин не найден')
  })
  it('lists and explains the extended glossary offline', () => {
    expect(listTerms()).toContain('sca')
    expect(listTerms()).toContain('cva')
    expect(listTerms()).toContain('coe')
    expect(explainTerm('cva')).toContain('Coffee Value Assessment')
    expect(explainTerm('coe')).toContain('Cup of Excellence')
  })
})
