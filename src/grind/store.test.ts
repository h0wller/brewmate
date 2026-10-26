import { describe, expect, it } from 'vitest'
import { capChecks, curvePoints, sanitizeChecks, sanitizePhotoProfiles } from './store'
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

describe('лимит замеров', () => {
  it('остаются самые свежие по времени, независимо от порядка в списке', () => {
    const many = Array.from({ length: 230 }, (_, i) => c({ id: 'id' + i, at: 1000 - i }))   // от новых к старым
    const kept = capChecks(many)
    expect(kept).toHaveLength(200)
    expect(kept[0].at).toBe(801)          // самые старые 30 отброшены
    expect(kept.at(-1)!.at).toBe(1000)
  })
  it('старый замер без createdAt получает его из времени замера; logId сохраняется', () => {
    const [x] = sanitizeChecks([{ ...c({ id: 'q', at: 42 }), logId: 'log1' }])
    expect([x.createdAt, x.updatedAt, x.logId]).toEqual([42, 42, 'log1'])
  })
})

describe('профили помола по фото', () => {
  const profile = {
    grinderId: 'comandante-c40', size: 'medium_fine', setting: 18, measuredSetting: 20,
    d50: 620, updatedAt: 100, checkId: 'check-1',
  }
  it('сохраняет отдельную рекомендацию для конкретной кофемолки и размера', () => {
    expect(sanitizePhotoProfiles([profile])).toEqual([profile])
  })
  it('отбрасывает профиль с отсутствующей кофемолкой или некорректным D50', () => {
    expect(sanitizePhotoProfiles([{ ...profile, grinderId: '' }, { ...profile, d50: 0 }])).toEqual([])
  })
})
