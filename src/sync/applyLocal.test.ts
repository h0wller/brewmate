import { afterEach, describe, expect, it } from 'vitest'
import { applyLocalData } from './applyLocal'
import { emptyData } from './merge'
import { DIAL_IN_PROFILES_KEY } from '../beans/dialInProfile'

const store: Record<string, string> = {}

function fakeStorage(failOn?: string) {
  return {
    setItem(k: string, v: string) {
      if (k === failOn) throw new Error('QuotaExceededError')
      store[k] = v
    },
  } as unknown as Storage
}

afterEach(() => {
  for (const k of Object.keys(store)) delete store[k]
  delete (globalThis as unknown as { localStorage?: Storage }).localStorage
})

describe('локальная запись импортированных данных', () => {
  it('все ключи записаны — ошибок нет', () => {
    ;(globalThis as unknown as { localStorage: Storage }).localStorage = fakeStorage()
    expect(applyLocalData(emptyData())).toEqual([])
    expect(Object.keys(store)).toContain('brewmate.recipes.v1')
    expect(Object.keys(store)).toContain(DIAL_IN_PROFILES_KEY)
  })

  it('сбой одного ключа: остальные записаны, упавший назван', () => {
    ;(globalThis as unknown as { localStorage: Storage }).localStorage = fakeStorage(DIAL_IN_PROFILES_KEY)
    expect(applyLocalData(emptyData())).toEqual(['dial-in профили'])
    expect(Object.keys(store)).toContain('brewmate.recipes.v1')
    expect(Object.keys(store)).not.toContain(DIAL_IN_PROFILES_KEY)
  })
})
