import { describe, expect, it } from 'vitest'
import { flowSignal, plannedSeconds } from './flow'

const steps = [{ duration: 45, pourTo: 50 }, { duration: 45, pourTo: 150 }, { duration: 60, pourTo: 250 }]   // план 150 с
const log = (over: Partial<Parameters<typeof flowSignal>[0]> = {}) => ({ method: 'v60', steps, durationS: 150, ...over })

describe('время против плана', () => {
  it('план — сумма длительностей шагов; мусор не считается', () => {
    expect(plannedSeconds(steps)).toBe(150)
    expect(plannedSeconds([{ duration: NaN, pourTo: 1 }, { duration: -5, pourTo: 1 }, { duration: 30, pourTo: 1 }])).toBe(30)
  })
  it('в пределах допуска сигнала нет', () => {
    expect(flowSignal(log())).toBeUndefined()
    expect(flowSignal(log({ durationS: 190 }))).toBeUndefined()
    expect(flowSignal(log({ durationS: 120 }))).toBeUndefined()
  })
  it('сильно дольше — медленно, сильно быстрее — быстро', () => {
    expect(flowSignal(log({ durationS: 200 }))).toBe('slow')
    expect(flowSignal(log({ durationS: 100 }))).toBe('fast')
  })
  it('Moccamaster распознаётся как перколяционный метод', () => {
    expect(flowSignal(log({ method: 'moccamaster', durationS: 200 }))).toBe('slow')
    expect(flowSignal(log({ method: 'moccamaster', durationS: 100 }))).toBe('fast')
  })

  it('погружные методы и короткие планы не дают сигнала', () => {
    expect(flowSignal(log({ method: 'french', durationS: 400 }))).toBeUndefined()
    expect(flowSignal(log({ steps: [{ duration: 30, pourTo: 50 }], durationS: 90 }))).toBeUndefined()
    expect(flowSignal(log({ durationS: 0 }))).toBeUndefined()
  })
})
