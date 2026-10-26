import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { METHODS, daysSince, levelFromAgtron, recipeFromBean, recommend } from './engine'
import type { MethodKey } from './engine'
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

  it('Moccamaster имеет отдельный базовый профиль', () => {
    const r = recommend(bean(), 'moccamaster')
    expect([r.size, r.temp, r.ratio]).toEqual(['medium', 94, 16])
  })

  it('honey обработка даёт отдельную осторожную подсказку', () => {
    const r = recommend(bean({ process: 'honey' }), 'v60')
    expect(r.tips.some(t => t.includes('Honey'))).toBe(true)
  })

  it('другой метод берёт свой базовый уровень', () => {
    const r = recommend(bean({ roastLevel: 'dark' }), 'french')
    expect([r.size, r.nudge, r.temp, r.ratio]).toEqual(['coarse', 1, 92, 15])
  })

  it('анаэробная ферментация: помол крупнее и прохладнее', () => {
    const r = recommend(bean({ process: 'anaerobic' }), 'v60')
    expect(r.temp).toBe(91)
    expect(r.nudge).toBe(1)
    expect(r.tips.some(t => t.includes('Анаэробная'))).toBe(true)
  })

  it('мягкая вода: тоньше помол, горячее, плотнее пропорция', () => {
    const r = recommend(bean(), 'v60', 'soft')
    expect(r.temp).toBe(94)
    expect(r.ratio).toBe(15.5)
    expect(r.tips.some(t => t.includes('Мягкая вода'))).toBe(true)
  })

  it('жёсткая вода: прохладнее и помол крупнее', () => {
    const r = recommend(bean(), 'v60', 'hard')
    expect(r.temp).toBe(91)
    expect(r.tips.some(t => t.includes('Жёсткая вода'))).toBe(true)
  })

  it('крупная доза (>= 40 г): помол чуть крупнее', () => {
    const r = recommend(bean(), 'drip', 'balanced', 60)
    expect(r.tips.some(t => t.includes('Большая порция (60 г)'))).toBe(true)
  })

  it('крупность не выходит за шкалу', () => {
    const r = recommend(bean({ roastLevel: 'dark', process: 'natural', roastDate: '2026-10-21' }), 'french')
    expect(r.coarseness <= 6 && r.coarseness >= 0).toBe(true)
  })
})

describe('recipeFromBean', () => {
  const methods = Object.keys(METHODS) as MethodKey[]

  it('для любого метода и дозы шаги имеют длительность, вес не убывает и заканчивается общей водой', () => {
    for (const method of methods) for (const dose of [10, 15, 60]) {
      const rec = recommend(bean(), method, 'balanced', dose)
      const r = recipeFromBean(bean(), method, rec, { size: rec.size }, dose)
      expect(r.waterG).toBe(Math.round(dose * rec.ratio))
      let prev = 0
      for (const st of r.steps) {
        if (!(st.duration > 0)) throw new Error(`${method}: шаг «${st.note}» без длительности`)
        if (st.pourTo < prev) throw new Error(`${method}: вес убывает`)
        prev = st.pourTo
      }
      expect(r.steps.at(-1)?.pourTo).toBe(r.waterG)
    }
  })

  it('Moccamaster: промывка фильтра, предсмачивание и машинный цикл без двойного учёта воды', () => {
    const rec = recommend(bean(), 'moccamaster')
    const r = recipeFromBean(bean(), 'moccamaster', rec, { size: rec.size }, 15)
    expect(r.steps).toHaveLength(3)
    expect(r.steps[0].pourTo).toBe(0)
    expect(r.steps[1].pourTo).toBe(38)
    expect(r.steps[1].note).toContain('Предсмачивание')
    expect(r.steps[2].pourTo).toBe(r.waterG)
    expect(r.steps[2].note).toContain('Moccamaster')
    expect(r.steps[2].note).toContain('202')
  })

  it('каппинг: настаивание 4 минуты, а не блюм в 0 секунд', () => {
    const rec = recommend(bean(), 'cupping')
    const r = recipeFromBean(bean(), 'cupping', rec, { size: rec.size })
    expect(r.steps[0].duration).toBe(240)
  })
})
