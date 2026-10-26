import { describe, expect, it } from 'vitest'
import { reportStorageError, safeWrite, subscribeStorageError } from './storageError'
import type { StorageErrorInfo } from './storageError'

const full = { setItem() { throw new Error('QuotaExceededError') } }

describe('сбои записи в хранилище', () => {
  it('удачная запись возвращает true и никого не тревожит', () => {
    const got: StorageErrorInfo[] = []
    const off = subscribeStorageError(e => got.push(e))
    const mem: Record<string, string> = {}
    expect(safeWrite({ setItem: (k: string, v: string) => { mem[k] = v } }, 'k', { a: 1 })).toBe(true)
    expect(mem.k).toBe('{"a":1}')
    expect(got).toEqual([])
    off()
  })
  it('переполнение: false и подписчик получает ключ и причину', () => {
    const got: StorageErrorInfo[] = []
    const off = subscribeStorageError(e => got.push(e))
    expect(safeWrite(full, 'brewmate.logs.v1', [1])).toBe(false)
    expect(got).toEqual([{ key: 'brewmate.logs.v1', message: 'QuotaExceededError' }])
    off()
  })
  it('после отписки уведомлений нет', () => {
    const got: string[] = []
    const off = subscribeStorageError(e => got.push(e.key))
    off()
    reportStorageError('x', new Error('boom'))
    expect(got).toEqual([])
  })
  it('ошибка одного подписчика не мешает остальным', () => {
    const got: string[] = []
    const off1 = subscribeStorageError(() => { throw new Error('плохой подписчик') })
    const off2 = subscribeStorageError(e => got.push(e.key))
    reportStorageError('k2', new Error('x'))
    expect(got).toEqual(['k2'])
    off1(); off2()
  })
  it('несериализуемое значение (цикл) тоже считается сбоем, а не падением', () => {
    const a: Record<string, unknown> = {}; a.self = a
    expect(safeWrite({ setItem() {} }, 'k', a)).toBe(false)
  })
})
