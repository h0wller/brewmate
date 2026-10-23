import { describe, expect, it } from 'vitest'
import { chartBounds, chartPath, downsample, finalWeight, planPoints, recordSample } from './curve'
import type { WeightSample } from '../types'

describe('recordSample', () => {
  it('пропускает отсчёты чаще, чем раз в 0.5 с, и округляет до десятых', () => {
    const s: WeightSample[] = []
    recordSample(s, 0, 0)
    recordSample(s, 0.2, 1)      // слишком рано
    recordSample(s, 0.61, 12.34)
    recordSample(s, 1.0, 20)     // 0.39 с после предыдущей — пропуск
    expect(s).toEqual([{ t: 0, g: 0 }, { t: 0.6, g: 12.3 }])
  })
})

describe('downsample', () => {
  const line = (n: number): WeightSample[] => Array.from({ length: n }, (_, i) => ({ t: i, g: i * 2 }))

  it('короткую кривую возвращает как есть (копией)', () => {
    const src = line(10)
    const out = downsample(src, 240)
    expect(out).toEqual(src)
    expect(out).not.toBe(src)
  })

  it('длинную прореживает до maxPoints, сохраняя первую и последнюю точки', () => {
    const out = downsample(line(1000), 100)
    expect(out).toHaveLength(100)
    expect(out[0]).toEqual({ t: 0, g: 0 })
    expect(out.at(-1)).toEqual({ t: 999, g: 1998 })
  })

  it('время в результате не убывает', () => {
    const out = downsample(line(777), 50)
    for (let i = 1; i < out.length; i++) expect(out[i].t >= out[i - 1].t).toBe(true)
  })
})

describe('finalWeight', () => {
  it('последнее показание, а без весов — undefined', () => {
    expect(finalWeight([{ t: 0, g: 0 }, { t: 5, g: 250.4 }])).toBe(250.4)
    expect(finalWeight([])).toBeUndefined()
  })
})

describe('planPoints', () => {
  it('ломаная по концам шагов, начиная с нуля', () => {
    expect(planPoints([
      { duration: 45, pourTo: 45 },
      { duration: 30, pourTo: 150 },
    ])).toEqual([{ t: 0, g: 0 }, { t: 45, g: 45 }, { t: 75, g: 150 }])
  })
  it('без шагов — одна точка в нуле', () => {
    expect(planPoints([])).toEqual([{ t: 0, g: 0 }])
  })
})

describe('chartPath', () => {
  it('углы графика: (0,0) → левый нижний, (tMax,gMax) → правый верхний', () => {
    const d = chartPath([{ t: 0, g: 0 }, { t: 100, g: 200 }], 100, 200, 300, 100, 10)
    expect(d).toBe('M10.0 90.0 L290.0 10.0')
  })
  it('вес ниже нуля и время за границей прижимаются к краям', () => {
    const d = chartPath([{ t: -5, g: -3 }, { t: 500, g: 999 }], 100, 200, 300, 100, 10)
    expect(d).toBe('M10.0 90.0 L290.0 10.0')
  })
  it('пустые данные или нулевые оси — пустой путь', () => {
    expect(chartPath([], 100, 100, 300, 100)).toBe('')
    expect(chartPath([{ t: 0, g: 0 }], 0, 100, 300, 100)).toBe('')
    expect(chartPath([{ t: 0, g: 0 }], 100, 0, 300, 100)).toBe('')
  })
})

describe('chartBounds', () => {
  it('берёт максимум из факта, плана и длительности', () => {
    const b = chartBounds(
      [{ t: 0, g: 0 }, { t: 160, g: 240 }],
      [{ t: 0, g: 0 }, { t: 150, g: 250 }],
      155,
    )
    expect(b.tMax).toBe(160)
    expect(b.gMax).toBeCloseTo(262.5)
  })
  it('пустые данные не ломают границы', () => {
    expect(chartBounds([], [], 0)).toEqual({ tMax: 0, gMax: 0 })
  })
})
