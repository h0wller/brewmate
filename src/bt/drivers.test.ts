import { describe, expect, it } from 'vitest'
import { DRIVERS, futulaDriver, pickDriver } from './drivers'

const packet = (tenthsG: number) => {
  const b = [0xca, 0x02, 0x06, tenthsG & 0xff, (tenthsG >> 8) & 0xff, 0, 0, 0, 0x04, 0x00]
  return new Uint8Array([...b, b.reduce((a, x) => a ^ x, 0)])
}

describe('драйвер FUTULA', () => {
  it('разбирает пакет только из характеристики fff4', () => {
    expect(futulaDriver.parse('fff4', packet(250))).toEqual({ rawG: 25, stable: true, unit: 'г' })
    expect(futulaDriver.parse('fff1', packet(250))).toBeNull()
  })

  it('команды: handshake, tare, единицы', () => {
    expect(futulaDriver.handshake?.()).toEqual([0x06, 0x0f, 0x00, 0x00])
    expect(futulaDriver.tare?.()[1]).toBe(0x32)
    expect(futulaDriver.setUnit?.('g')[2]).toBe(0x04)
    expect(futulaDriver.setUnit?.('ml')[2]).toBe(0x07)
  })
})

describe('pickDriver', () => {
  it('для неизвестного устройства берёт первый драйвер реестра', () => {
    expect(pickDriver('Какие-то весы')).toBe(DRIVERS[0])
    expect(pickDriver('')).toBe(DRIVERS[0])
  })
})
