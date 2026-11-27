import { afterEach, describe, expect, it } from 'vitest'
import { saveSyncConfig } from './sync/sync'
import { saveAIConfig } from './ai/client'
import { saveSkillLevel } from './companion/level'
import type { SyncConfig } from './sync/sync'
import type { AIConfig } from './ai/client'

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

describe('конфигурационные writers возвращают результат записи', () => {
  it('успех: все три возвращают true и пишут значение', () => {
    ;(globalThis as unknown as { localStorage: Storage }).localStorage = fakeStorage()
    const sync: SyncConfig = { url: 'https://x', anonKey: 'k', code: 'BM-1-2-3' }
    const ai: AIConfig = { provider: 'openai', baseUrl: 'https://api', apiKey: 'sk', model: 'gpt' }
    expect(saveSyncConfig(sync)).toBe(true)
    expect(saveAIConfig(ai)).toBe(true)
    expect(saveSkillLevel('pro')).toBe(true)
    expect(Object.keys(store).length).toBe(3)
  })

  it('сбой: бросающий setItem даёт false', () => {
    ;(globalThis as unknown as { localStorage: Storage }).localStorage = fakeStorage('brewmate.sync.v1')
    const sync: SyncConfig = { url: 'https://x', anonKey: 'k', code: 'BM-1-2-3' }
    expect(saveSyncConfig(sync)).toBe(false)
  })
})
