import { describe, expect, it } from 'vitest'
import { opinionAgrees, parseGrindOpinion } from './grind'
import { buildGrindPrompt } from './prompt'

describe('второе мнение по помолу', () => {
  it('разбирает нормальный ответ', () => {
    const o = parseGrindOpinion({ verdict: 'finer', comment: ' Помол крупноват. ', issues: ['clumps', 'fines'] })
    expect(o).toEqual({ verdict: 'finer', comment: 'Помол крупноват.', issues: ['fines', 'clumps'] })
  })
  it('мусор от модели не ломает: неизвестный вердикт → unsure, чужие пункты и не-строки отбрасываются', () => {
    expect(parseGrindOpinion(null)).toEqual({ verdict: 'unsure', comment: '', issues: [] })
    expect(parseGrindOpinion({ verdict: 'сделай мельче', comment: 5, issues: 'fines' }))
      .toEqual({ verdict: 'unsure', comment: '', issues: [] })
    expect(parseGrindOpinion({ verdict: 'ok', issues: ['fines', 'evil', 7] }).issues).toEqual(['fines'])
  })
  it('длинный комментарий режется', () => {
    expect(parseGrindOpinion({ verdict: 'ok', comment: 'я'.repeat(2000) }).comment.length).toBe(400)
  })
  it('согласие с измерением', () => {
    expect(opinionAgrees({ verdict: 'unsure', comment: '', issues: [] }, 'ok')).toBeNull()
    expect(opinionAgrees({ verdict: 'finer', comment: '', issues: [] }, 'finer')).toBe(true)
    expect(opinionAgrees({ verdict: 'coarser', comment: '', issues: [] }, 'finer')).toBe(false)
  })
  it('в запрос попадают измеренные числа и цель уровня, а не текст пользователя', () => {
    const p = buildGrindPrompt({ size: 'medium_fine', d10: 400, d50: 620, d90: 900, n: 321, taste: 'sour' })
    expect(p).toContain('620 мкм')
    expect(p).toContain('500–750')
    expect(p).toContain('средне-мелкий')
    expect(p).toContain('кисло')
    expect(p).toContain('321')
  })
})
