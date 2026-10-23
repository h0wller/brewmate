import { describe, expect, it } from 'vitest'
import { emptyData, mergeData, sanitizeData } from './merge'
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

  it('принимает старый формат сервера без deleted и logs', () => {
    const d = sanitizeData({ recipes: [{ id: 'x' }], sessions: [], beans: [] })
    expect(d.deleted).toEqual({})
    expect(d.logs).toEqual([])
    expect(d.recipes).toHaveLength(1)
  })
})
