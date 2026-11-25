import { describe, expect, it } from 'vitest'
import { explainTerm, listTerms } from './scenarios/termExplain'

describe('termExplain', () => {
  it('lists every glossary term, including the new coffee assessment terms', () => {
    const ids = listTerms()
    expect(ids).toContain('sca')
    expect(ids).toContain('cva')
    expect(ids).toContain('coe')
  })

  it('explains new glossary terms offline', () => {
    expect(explainTerm('cva')).toContain('Coffee Value Assessment')
    expect(explainTerm('coe')).toContain('Cup of Excellence')
  })
})
