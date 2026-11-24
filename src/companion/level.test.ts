import { describe, expect, it, beforeEach } from 'vitest'
import { loadSkillLevel, saveSkillLevel, showAdvanced, showHints, LEVEL_LABEL } from './level'

const store: Record<string, string> = {}
const ls = {
  getItem: (k: string) => (k in store ? store[k] : null),
  setItem: (k: string, v: string) => { store[k] = v },
  removeItem: (k: string) => { delete store[k] },
}
beforeEach(() => { for (const k in store) delete store[k]; (globalThis as any).localStorage = ls })

describe('level', () => {
  it('по умолчанию enthusiast', () => {
    expect(loadSkillLevel()).toBe('enthusiast')
  })
  it('сохраняет и читает', () => {
    saveSkillLevel('pro')
    expect(loadSkillLevel()).toBe('pro')
    saveSkillLevel('beginner')
    expect(loadSkillLevel()).toBe('beginner')
  })
  it('showAdvanced/showHints', () => {
    expect(showAdvanced('beginner')).toBe(false)
    expect(showAdvanced('pro')).toBe(true)
    expect(showHints('pro')).toBe(false)
    expect(showHints('beginner')).toBe(true)
  })
  it('LEVEL_LABEL полон', () => {
    expect(Object.keys(LEVEL_LABEL).length).toBe(3)
  })
})