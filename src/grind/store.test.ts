import { describe, expect, it } from 'vitest'
import { curvePoints, sanitizeChecks } from './store'
import type { GrindCheck } from './store'

const c = (p: Partial<GrindCheck>): GrindCheck => ({
  id: 'a', at: 1, setting: 20, size: 'medium', d10: 400, d50: 600, d90: 900, n: 300, ...p,
})

describe('замеры помола', () => {
  it('мусор из хранилища отбрасывается', () => {
    expect(sanitizeChecks(null)).toEqual([])
    expect(sanitizeChecks([null, 1, { id: 'x' }, c({ d50: -1 }), c({ size: 'huge' as never }), c({ d50: NaN })])).toEqual([])
    expect(sanitizeChecks([c({}), { ...c({ id: 'b' }), taste: 'weird' }]).map(x => x.taste)).toEqual([undefined, undefined])
  })
  it('точки кривой: только своя кофемолка, по настройке — самый свежий замер', () => {
    const list = [
      c({ id: '1', setting: 20, d50: 500, at: 1, grinderId: 'g' }),
      c({ id: '2', setting: 20, d50: 520, at: 5, grinderId: 'g' }),
      c({ id: '3', setting: 30, d50: 760, at: 2, grinderId: 'g' }),
      c({ id: '4', setting: 25, d50: 999, at: 3, grinderId: 'other' }),
    ]
    const pts = curvePoints(list, 'g').sort((a, b) => a.setting - b.setting)
    expect(pts).toEqual([{ setting: 20, d50: 520 }, { setting: 30, d50: 760 }])
  })
})
