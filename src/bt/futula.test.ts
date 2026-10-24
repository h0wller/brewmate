import { describe, expect, it } from 'vitest'
import { fdCmd, parseFutula, unitCmd } from './futula'

/* Пакет весов: ca 02 06 WW WW NEG 00 00 U1 U2 CK, CK = XOR первых 10 байт */
const packet = (tenthsG: number, { neg = 0, unit = 0x04, state = 0x00 } = {}) => {
  const b = [0xca, 0x02, 0x06, tenthsG & 0xff, (tenthsG >> 8) & 0xff, neg, 0, 0, unit, state]
  return new Uint8Array([...b, b.reduce((a, x) => a ^ x, 0)])
}

describe('parseFutula', () => {
  it('разбирает вес, стабильность и единицы', () => {
    expect(parseFutula(packet(1234))).toEqual({ rawG: 123.4, stable: true, unit: 'г' })
  })

  it('отрицательный вес', () => {
    expect(parseFutula(packet(50, { neg: 1 }))?.rawG).toBe(-5)
  })

  it('нестабильное показание (байт 9 = 01)', () => {
    expect(parseFutula(packet(100, { state: 0x01 }))?.stable).toBe(false)
  })

  it('единицы: мл, oz, lb и неизвестный код', () => {
    expect(parseFutula(packet(100, { unit: 0x07 }))?.unit).toBe('мл')
    expect(parseFutula(packet(100, { unit: 0x06 }))?.unit).toBe('oz')
    expect(parseFutula(packet(100, { unit: 0x08 }))?.unit).toBe('lb')
    expect(parseFutula(packet(100, { unit: 0x09 }))?.unit).toBe('0x9')
  })

  it('отбрасывает пакет с неверной чексуммой, длиной или заголовком', () => {
    const bad = packet(100)
    bad[10] ^= 0xff
    expect(parseFutula(bad)).toBeNull()
    expect(parseFutula(packet(100).slice(0, 10))).toBeNull()
    const header = packet(100)
    header[0] = 0xcb
    expect(parseFutula(header)).toBeNull()
  })
})

describe('команды весов', () => {
  it('unitCmd: образец из родного приложения fd 00 07 … fa', () => {
    const c = unitCmd(0x07)
    expect(c).toHaveLength(11)
    expect(c.slice(0, 3)).toEqual([0xfd, 0x00, 0x07])
    expect(c[10]).toBe(0xfa)
  })

  it('чексумма — XOR всех предыдущих байтов', () => {
    expect(unitCmd(0x04)[10]).toBe(0xf9)
    expect(fdCmd(0x32)[10]).toBe(0xcf)
  })
})
