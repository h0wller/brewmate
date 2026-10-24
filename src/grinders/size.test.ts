import { describe, expect, it } from 'vitest'
import { GRIND_SIZES, SIZE_LABEL, describeCoarseness, isGrindSize, nudgeText } from './size'

describe('шкала крупности', () => {
  it('семь уровней CoffeeJSON по порядку и у каждого есть подпись', () => {
    expect([...GRIND_SIZES]).toEqual([
      'extra_fine', 'fine', 'medium_fine', 'medium', 'medium_coarse', 'coarse', 'extra_coarse',
    ])
    for (const s of GRIND_SIZES) expect(SIZE_LABEL[s].length > 0).toBe(true)
  })

  it('isGrindSize принимает только значения шкалы', () => {
    expect(isGrindSize('medium')).toBe(true)
    expect(isGrindSize('Medium')).toBe(false)
    expect(isGrindSize(3)).toBe(false)
    expect(isGrindSize(undefined)).toBe(false)
  })
})

describe('describeCoarseness', () => {
  it('целое значение — уровень без подсказки', () => {
    expect(describeCoarseness(3)).toEqual({ size: 'medium', nudge: 0 })
  })
  it('небольшое отклонение (< 0.25) не даёт подсказки', () => {
    expect(describeCoarseness(3.2)).toEqual({ size: 'medium', nudge: 0 })
  })
  it('заметное отклонение — «чуть крупнее» / «чуть мельче»', () => {
    expect(describeCoarseness(3.3)).toEqual({ size: 'medium', nudge: 1 })
    expect(describeCoarseness(2.7)).toEqual({ size: 'medium', nudge: -1 })
  })
  it('на краях шкалы подсказки в сторону «за край» нет', () => {
    expect(describeCoarseness(0)).toEqual({ size: 'extra_fine', nudge: 0 })
    expect(describeCoarseness(-1)).toEqual({ size: 'extra_fine', nudge: 0 })
    expect(describeCoarseness(6)).toEqual({ size: 'extra_coarse', nudge: 0 })
    expect(describeCoarseness(9)).toEqual({ size: 'extra_coarse', nudge: 0 })
  })
  it('nudgeText', () => {
    expect(nudgeText(1)).toBe('чуть крупнее')
    expect(nudgeText(-1)).toBe('чуть мельче')
    expect(nudgeText(0)).toBe('')
  })
})
