import { describe, expect, it } from 'vitest'
import { fmtNum, inRange, parseNum } from './numField'

describe('parseNum', () => {
  it('пустое поле — null, а не 1 или 0 (раньше в поле дозы всегда оставалась цифра)', () => {
    expect(parseNum('')).toBeNull()
    expect(parseNum('  ')).toBeNull()
    expect(parseNum('.')).toBeNull()
    expect(parseNum('-')).toBeNull()
  })
  it('числа, запятая как точка, промежуточный ввод', () => {
    expect(parseNum('18')).toBe(18)
    expect(parseNum('16,5')).toBe(16.5)
    expect(parseNum('15.')).toBe(15)
    expect(parseNum('.5')).toBe(0.5)
  })
  it('мусор — null', () => {
    expect(parseNum('1e5')).toBeNull()
    expect(parseNum('abc')).toBeNull()
    expect(parseNum('1.2.3')).toBeNull()
  })
})

describe('fmtNum и inRange', () => {
  it('ноль и отсутствие значения показываются пустым полем', () => {
    expect(fmtNum(0)).toBe('')
    expect(fmtNum(null)).toBe('')
    expect(fmtNum(undefined)).toBe('')
    expect(fmtNum(240)).toBe('240')
    expect(fmtNum(16.5)).toBe('16.5')
  })
  it('границы включительно', () => {
    expect(inRange(1, 1, 500)).toBe(true)
    expect(inRange(500, 1, 500)).toBe(true)
    expect(inRange(0, 1, 500)).toBe(false)
    expect(inRange(null, 1, 500)).toBe(false)
  })
})
