import { describe, expect, it } from 'vitest'
import { activeCalibrationFactor, capChecks, curvePoints, sanitizeChecks, sanitizePhotoProfiles } from './store'
import type { GrindCheck } from './store'
import { SIEVE_REFERENCES } from './target'

const c = (p: Partial<GrindCheck>): GrindCheck => ({
  id: 'a', at: 1, setting: 20, size: 'medium', d10: 400, d50: 600, d90: 900, n: 300, ...p,
})

describe('эталонные ситовые фракции', () => {
  it('использует среднегеометрический D50 и точные границы фракций', () => {
    expect(SIEVE_REFERENCES['under-600']).toEqual({ label: '< 600 мкм (проход 600)', minUm: 250, maxUm: 600, d50Um: 450 })
    expect(SIEVE_REFERENCES['600-900']).toEqual({ label: '600–900 мкм (между 600 и 900)', minUm: 600, maxUm: 900, d50Um: 735 })
    expect(SIEVE_REFERENCES['900-1400']).toEqual({ label: '900–1400 мкм (между 900 и 1400)', minUm: 900, maxUm: 1400, d50Um: 1122 })
    expect(SIEVE_REFERENCES['over-1400']).toEqual({ label: '> 1400 мкм (остаток на 1400)', minUm: 1400, maxUm: 2000, d50Um: 1620 })
  })
})

describe('замеры помола', () => {
  it('мусор из хранилища отбрасывается', () => {
    expect(sanitizeChecks(null)).toEqual([])
    expect(sanitizeChecks([null, 1, { id: 'x' }, c({ d50: -1 }), c({ size: 'huge' as never }), c({ d50: NaN })])).toEqual([])
    expect(sanitizeChecks([c({}), { ...c({ id: 'b' }), taste: 'weird' }]).map(x => x.taste)).toEqual([undefined, undefined])
  })
  it('сохраняет только известные источники замера и не ломает старые записи', () => {
    expect(sanitizeChecks([c({ source: 'sieve' }), c({ id: 'photo', source: 'photo' }), c({ id: 'bad', source: 'other' as never })]).map(x => x.source)).toEqual(['sieve', 'photo', undefined])
  })
  it('сохраняет валидные ситовые поля и принимает оптический референс без настройки', () => {
    const [saved] = sanitizeChecks([c({ id: 'sieve', source: 'sieve', setting: undefined, sieveBracket: '600-900', rawD50: 810, calibrationFactor: 0.91 })])
    expect(saved).toMatchObject({ source: 'sieve', sieveBracket: '600-900', rawD50: 810, calibrationFactor: 0.91 })
    expect(saved.setting).toBeUndefined()
    const [invalid] = sanitizeChecks([c({ sieveBracket: 'not-a-bracket' as never, rawD50: -1, calibrationFactor: 2 })])
    expect(invalid.sieveBracket).toBeUndefined()
    expect(invalid.rawD50).toBeUndefined()
    expect(invalid.calibrationFactor).toBeUndefined()
  })

  it('activeCalibrationFactor использует медиану ситовых референсов, игнорируя обычные фото', () => {
    const checks = [
      c({ id: 's1', source: 'sieve', grinderId: 'g', calibrationFactor: 0.8 }),
      c({ id: 's2', source: 'sieve', grinderId: 'g', calibrationFactor: 1.0 }),
      c({ id: 's3', source: 'sieve', grinderId: 'g', calibrationFactor: 1.2 }),
      c({ id: 'photo', source: 'photo', grinderId: 'g', calibrationFactor: 0.6 }),
      c({ id: 'other', source: 'sieve', grinderId: 'other', calibrationFactor: 1.4 }),
    ]
    expect(activeCalibrationFactor(checks, 'g')).toBe(1)
    expect(activeCalibrationFactor(checks, 'missing')).toBe(1.1)
    expect(activeCalibrationFactor([c({ source: 'photo', calibrationFactor: 0.7 })], 'g')).toBe(1)
    expect(activeCalibrationFactor([], 'g')).toBe(1)
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
