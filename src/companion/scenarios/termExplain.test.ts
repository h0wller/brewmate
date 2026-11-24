import { describe, expect, it } from 'vitest'
import { explainTerm } from './termExplain'

describe('termExplain', () => {
  it('объясняет известный термин', () => {
    const r = explainTerm('dose')
    expect(r).toContain('Доза')
    expect(r).toContain('граммах')
  })
  it('для неизвестного — подсказка', () => {
    expect(explainTerm('nope')).toContain('Термин не найден')
  })
})