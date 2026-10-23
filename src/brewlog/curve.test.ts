import { describe, expect, it } from 'vitest'
import {
  chartBounds, chartPath, downsample, finalWeight, flowRateAt, planPoints, recordSample, stepStats, weightAt,
} from './curve'
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

const ramp = (rate: number, from = 0, to = 10): WeightSample[] =>
  Array.from({ length: to - from + 1 }, (_, i) => ({ t: from + i, g: rate * (from + i) }))

describe('weightAt', () => {
  const s: WeightSample[] = [{ t: 0, g: 0 }, { t: 10, g: 100 }]
  it('интерполирует между отсчётами', () => {
    expect(weightAt(s, 5)).toBe(50)
    expect(weightAt(s, 2.5)).toBe(25)
  })
  it('за краями берёт крайние значения; без данных — undefined', () => {
    expect(weightAt(s, -3)).toBe(0)
    expect(weightAt(s, 99)).toBe(100)
    expect(weightAt([], 5)).toBeUndefined()
  })
})

describe('flowRateAt', () => {
  it('равномерный налив 5 г/с даёт 5', () => {
    expect(flowRateAt(ramp(5), 10)).toBeCloseTo(5)
  })
  it('вес стоит на месте — скорость 0', () => {
    expect(flowRateAt(ramp(0), 10)).toBeCloseTo(0)
  })
  it('учитывает только окно: после остановки налива скорость падает до 0', () => {
    const s = [...ramp(5, 0, 5), ...Array.from({ length: 6 }, (_, i) => ({ t: 6 + i, g: 25 }))]
    expect(flowRateAt(s, 11, 3)).toBeCloseTo(0)
  })
  it('мало данных — null', () => {
    expect(flowRateAt([], 10)).toBeNull()
    expect(flowRateAt([{ t: 9, g: 1 }], 10)).toBeNull()
    expect(flowRateAt([{ t: 9.6, g: 1 }, { t: 10, g: 2 }], 10)).toBeNull() // меньше 1 с
  })
  it('шум в пределах окна не даёт скачков (МНК, а не две точки)', () => {
    const noisy = ramp(4).map((p, i) => ({ ...p, g: p.g + (i % 2 ? 0.4 : -0.4) }))
    const f = flowRateAt(noisy, 10, 4)
    expect(f !== null && Math.abs(f - 4) < 0.5).toBe(true)
  })
})

describe('stepStats', () => {
  const steps = [
    { duration: 10, pourTo: 50, note: 'блюм' },
    { duration: 20, pourTo: 50, note: 'пауза' },
    { duration: 20, pourTo: 250, note: 'основной' },
  ]
  it('план: сколько воды и с какой скоростью на каждом шаге', () => {
    const st = stepStats([], steps)
    expect(st.map(x => x.planG)).toEqual([50, 0, 200])
    expect(st.map(x => x.planRate)).toEqual([5, 0, 10])
    expect(st.map(x => x.actualG)).toEqual([null, null, null])
  })
  it('факт по кривой: налили 50 за блюм, пауза, затем 190 вместо 200', () => {
    const curve: WeightSample[] = [
      { t: 0, g: 0 }, { t: 10, g: 50 }, { t: 30, g: 50 }, { t: 50, g: 240 },
    ]
    const st = stepStats(curve, steps)
    expect(st[0].actualG).toBe(50)
    expect(st[1].actualG).toBe(0)
    expect(st[2].actualG).toBe(190)
    expect(st[2].actualRate).toBeCloseTo(9.5)
  })
})
