import { describe, expect, it } from 'vitest'
import { buildPayload, emptyData, mergeData, sanitizeData } from './merge'
import type { GrindCheck, PhotoGrindProfile } from '../grind/store'
import type { DialInProfile } from '../beans/dialInProfile'
import type { Recipe } from '../types'

const recipe = (id: string, updatedAt?: number, title = id): Recipe => ({
  id, title, method: 'v60', doseG: 15, waterG: 250, tempC: 92, steps: [], createdAt: 1, updatedAt,
})

const data = (p: Partial<ReturnType<typeof emptyData>>) => ({ ...emptyData(), ...p })

describe('mergeData', () => {
  it('объединяет записи с разными id', () => {
    const m = mergeData(data({ recipes: [recipe('a')] }), data({ recipes: [recipe('b')] }))
    expect(m.recipes.map(r => r.id).sort()).toEqual(['a', 'b'])
  })

  it('побеждает более свежая правка — с любой стороны', () => {
    const newer = mergeData(
      data({ recipes: [recipe('a', 5, 'local')] }),
      data({ recipes: [recipe('a', 9, 'remote')] }),
    )
    expect(newer.recipes[0].title).toBe('remote')

    const older = mergeData(
      data({ recipes: [recipe('a', 9, 'local')] }),
      data({ recipes: [recipe('a', 5, 'remote')] }),
    )
    expect(older.recipes[0].title).toBe('local')
  })

  it('при равном updatedAt (и у старых записей без него) побеждает локальная', () => {
    const same = mergeData(
      data({ recipes: [recipe('a', 5, 'local')] }),
      data({ recipes: [recipe('a', 5, 'remote')] }),
    )
    expect(same.recipes[0].title).toBe('local')

    const legacy = mergeData(
      data({ recipes: [recipe('a', undefined, 'local')] }),
      data({ recipes: [recipe('a', undefined, 'remote')] }),
    )
    expect(legacy.recipes[0].title).toBe('local')
  })

  it('удалённое локально не воскресает с сервера', () => {
    const m = mergeData(
      data({ deleted: { a: 10 } }),
      data({ recipes: [recipe('a', 5)] }),
    )
    expect(m.recipes).toHaveLength(0)
    expect(m.deleted).toEqual({ a: 10 })
  })

  it('удаление на другом устройстве доезжает до локальных данных', () => {
    const m = mergeData(
      data({ recipes: [recipe('a', 5)] }),
      data({ deleted: { a: 10 } }),
    )
    expect(m.recipes).toHaveLength(0)
  })

  it('запись, изменённая после удаления, остаётся', () => {
    const m = mergeData(
      data({ deleted: { a: 10 } }),
      data({ recipes: [recipe('a', 20)] }),
    )
    expect(m.recipes).toHaveLength(1)
  })

  it('журнал завариваний сливается так же: свежая правка и удаления', () => {
    const log = (id: string, updatedAt: number, notes: string) => ({
      id, title: 'V60', method: 'v60', doseG: 15, waterG: 250, tempC: 93, steps: [],
      startedAt: 1, durationS: 150, createdAt: 1, updatedAt, notes,
    })
    const m = mergeData(
      data({ logs: [log('a', 5, 'локально'), log('b', 1, 'b')] }),
      data({ logs: [log('a', 9, 'сервер'), log('c', 1, 'c')], deleted: { b: 3 } }),
    )
    expect(m.logs.map(l => l.id).sort()).toEqual(['a', 'c'])
    expect(m.logs.find(l => l.id === 'a')?.notes).toBe('сервер')
  })

  it('метки удалений объединяются по максимуму', () => {
    const m = mergeData(data({ deleted: { a: 5 } }), data({ deleted: { a: 9, b: 1 } }))
    expect(m.deleted).toEqual({ a: 9, b: 1 })
  })
})

describe('sanitizeData', () => {
  it('мусор на входе даёт пустые данные', () => {
    expect(sanitizeData(null)).toEqual(emptyData())
    expect(sanitizeData('строка')).toEqual(emptyData())
    expect(sanitizeData(42)).toEqual(emptyData())
  })

  it('отбрасывает записи без id и нечисловые метки удалений', () => {
    const d = sanitizeData({
      recipes: [{ id: 'x' }, null, 5, { title: 'без id' }],
      deleted: { a: 1, b: 'не число' },
    })
    expect(d.recipes).toHaveLength(1)
    expect(d.deleted).toEqual({ a: 1 })
  })

  it('старый помол-строка с сервера приводится к объекту', () => {
    const d = sanitizeData({ recipes: [{ id: 'x', grind: 'Comandante 24 клика' }], logs: [{ id: 'l', grind: 'мелко' }] })
    expect(d.recipes[0].grind).toEqual({ setting: 'Comandante 24 клика' })
    expect(d.logs[0].grind).toEqual({ setting: 'мелко' })
  })

  it('принимает старый формат сервера без deleted и logs', () => {
    const d = sanitizeData({ recipes: [{ id: 'x' }], sessions: [], beans: [] })
    expect(d.deleted).toEqual({})
    expect(d.logs).toEqual([])
    expect(d.recipes).toHaveLength(1)
    expect(d.dialInProfiles).toEqual([])
    expect(d.photoProfiles).toEqual([])
  })
})

describe('замеры помола в слиянии', () => {
  const chk = (id: string, at: number, extra: Partial<GrindCheck> = {}): GrindCheck => ({
    id, at, setting: 20, size: 'medium', d10: 400, d50: 600, d90: 900, n: 300, createdAt: at, updatedAt: at, ...extra,
  })
  it('замеры с двух устройств объединяются, дубли по id не множатся', () => {
    const m = mergeData(
      data({ grindChecks: [chk('a', 1), chk('b', 2)] }),
      data({ grindChecks: [chk('b', 2), chk('c', 3)] }),
    )
    expect(m.grindChecks.map(c => c.id)).toEqual(['a', 'b', 'c'])   // от старых к новым
  })
  it('удалённый замер не возвращается с сервера', () => {
    const m = mergeData(
      data({ grindChecks: [], deleted: { a: 10 } }),
      data({ grindChecks: [chk('a', 1)] }),
    )
    expect(m.grindChecks).toEqual([])
  })
  it('старая копия без замеров читается: пусто, остальное цело', () => {
    const d = sanitizeData({ recipes: [recipe('a')] })
    expect(d.grindChecks).toEqual([])
    expect(d.recipes).toHaveLength(1)
  })
  it('замеры из файла проверяются: битые отброшены, createdAt восстанавливается из времени замера', () => {
    const d = sanitizeData({ grindChecks: [{ ...chk('a', 7), createdAt: undefined, updatedAt: undefined }, { id: 'x' }, 5] })
    expect(d.grindChecks).toHaveLength(1)
    expect(d.grindChecks[0].id).toBe('a')
    expect([d.grindChecks[0].createdAt, d.grindChecks[0].updatedAt]).toEqual([7, 7])
  })
})

describe('профили кофемолки в синхронизации', () => {
  const dialIn = (id: string, savedAt: number, extra: Partial<DialInProfile> = {}): DialInProfile => ({
    id, grinderId: 'c40', method: 'moccamaster', beanId: 'ethiopia', roastDate: '2026-10-01',
    sourceLogId: id, doseG: 20, waterG: 320, tempC: 93, steps: [{ duration: 240, pourTo: 320 }],
    positiveTrials: 3, totalTrials: 3, savedAt, ...extra,
  })
  const photo = (setting: number, updatedAt: number, extra: Partial<PhotoGrindProfile> = {}): PhotoGrindProfile => ({
    grinderId: 'c40', size: 'medium', setting, measuredSetting: setting, d50: 800, updatedAt, checkId: String(updatedAt), ...extra,
  })

  it('dial-in объединяется по естественному ключу, более свежий savedAt побеждает', () => {
    const merged = mergeData(
      data({ dialInProfiles: [dialIn('local-old', 10)] }),
      data({ dialInProfiles: [dialIn('remote-new', 20)] }),
    )
    expect(merged.dialInProfiles).toHaveLength(1)
    expect(merged.dialInProfiles[0].id).toBe('remote-new')
  })

  it('учитывает tombstone для dial-in профиля', () => {
    const merged = mergeData(
      data({ dialInProfiles: [dialIn('removed', 10)], deleted: { removed: 15 } }),
      data({ dialInProfiles: [dialIn('removed', 10)] }),
    )
    expect(merged.dialInProfiles).toEqual([])
  })

  it('удаление свежего dial-in не возвращает старую версию того же естественного ключа', () => {
    const merged = mergeData(
      data({ dialInProfiles: [dialIn('old-id', 10)] }),
      data({ dialInProfiles: [dialIn('new-id', 20)], deleted: { 'new-id': 25 } }),
    )
    expect(merged.dialInProfiles).toEqual([])
  })

  it('photo-профиль объединяется по grinderId + size, побеждает updatedAt', () => {
    const merged = mergeData(
      data({ photoProfiles: [photo(12, 10), photo(15, 12, { size: 'coarse' })] }),
      data({ photoProfiles: [photo(18, 20), photo(11, 5, { size: 'coarse' })] }),
    )
    expect(merged.photoProfiles).toHaveLength(2)
    expect(merged.photoProfiles.find(p => p.size === 'medium')?.setting).toBe(18)
    expect(merged.photoProfiles.find(p => p.size === 'coarse')?.setting).toBe(15)
  })

  it('старый сервер без новых полей сохраняет остальное и даёт пустые профили', () => {
    const local = sanitizeData({ recipes: [recipe('legacy')] })
    const merged = mergeData(local, sanitizeData({ recipes: [], sessions: [], beans: [] }))
    expect(merged.recipes.map(r => r.id)).toEqual(['legacy'])
    expect(merged.dialInProfiles).toEqual([])
    expect(merged.photoProfiles).toEqual([])
  })
})

describe('buildPayload', () => {
  it('сохраняет поля, которых эта версия не знает', () => {
    const p = buildPayload({ recipes: [], futureThing: { x: 1 } }, data({ recipes: [recipe('a')] }))
    expect(p.futureThing).toEqual({ x: 1 })
    expect((p.recipes as unknown[]).length).toBe(1)
  })
  it('слитые данные главнее серверных, мусорный ответ сервера не ломает', () => {
    expect(buildPayload(null, data({})).deleted).toEqual({})
    expect(buildPayload([1, 2], data({})).recipes).toEqual([])
    expect(buildPayload('x', data({ recipes: [recipe('z')] })).recipes).toHaveLength(1)
  })
})
