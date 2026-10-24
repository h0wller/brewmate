import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { daysSince, levelFromAgtron, recommend } from './engine'
import type { BeanProfile } from '../types'

const bean = (p: Partial<BeanProfile> = {}): BeanProfile => ({ id: 'b', name: 'test', createdAt: 0, ...p })

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-22T12:00:00Z'))
})
afterEach(() => { vi.useRealTimers() })

describe('levelFromAgtron', () => {
  it('границы 70 и 55', () => {
    expect(levelFromAgtron(70)).toBe('light')
    expect(levelFromAgtron(69)).toBe('medium')
    expect(levelFromAgtron(55)).toBe('medium')
    expect(levelFromAgtron(54)).toBe('dark')
  })
})

describe('daysSince', () => {
  it('считает полные дни', () => {
    expect(daysSince('2026-10-19')).toBe(3)
  })
  it('пусто, мусор и будущая дата дают null/null/0', () => {
    expect(daysSince(undefined)).toBeNull()
    expect(daysSince('не дата')).toBeNull()
    expect(daysSince('2026-12-01')).toBe(0)
  })
})

describe('recommend', () => {
  it('средняя обжарка без дат — базовые значения V60 (средне-мелкий, без поправок)', () => {
    expect(recommend(bean(), 'v60')).toEqual({
      coarseness: 2, size: 'medium_fine', nudge: 0, temp: 93, ratio: 16, bloom: 45, tips: [],
    })
  })

  it('тёмная: крупнее и холоднее', () => {
    const r = recommend(bean({ roastLevel: 'dark' }), 'v60')
    expect([r.size, r.nudge, r.temp]).toEqual(['medium_fine', 1, 90])
    expect(r.tips).toHaveLength(1)
  })

  it('светлая: мельче и горячее', () => {
    const r = recommend(bean({ roastLevel: 'light' }), 'v60')
    expect([r.size, r.nudge, r.temp]).toEqual(['medium_fine', -1, 95])
  })

  it('натуральная обработка: чуть крупнее и прохладнее', () => {
    const r = recommend(bean({ process: 'natural' }), 'v60')
    expect([r.size, r.nudge, r.temp]).toEqual(['medium_fine', 1, 92])
  })

  it('поправки складываются: тёмная натуральная дотягивает до следующего уровня', () => {
    const r = recommend(bean({ roastLevel: 'dark', process: 'natural' }), 'v60')
    expect(r.size).toBe('medium')
    expect(r.nudge).toBe(-1)
  })

  it('свежее зерно (3 дня): дольше блюм, чуть крупнее', () => {
    const r = recommend(bean({ roastDate: '2026-10-19' }), 'v60')
    expect(r.bloom).toBe(60)
    expect(r.nudge).toBe(1)
  })

  it('старое зерно (51 день): мельче помол', () => {
    const r = recommend(bean({ roastDate: '2026-09-01' }), 'v60')
    expect(r.nudge).toBe(-1)
    expect(r.tips.some(t => t.includes('51'))).toBe(true)
  })

  it('другой метод берёт свой базовый уровень', () => {
    const r = recommend(bean({ roastLevel: 'dark' }), 'french')
    expect([r.size, r.nudge, r.temp, r.ratio]).toEqual(['coarse', 1, 92, 15])
  })

  it('крупность не выходит за шкалу', () => {
    const r = recommend(bean({ roastLevel: 'dark', process: 'natural', roastDate: '2026-10-21' }), 'french')
    expect(r.coarseness <= 6 && r.coarseness >= 0).toBe(true)
  })
})
