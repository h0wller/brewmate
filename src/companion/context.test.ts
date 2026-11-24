import { describe, expect, it } from 'vitest'
import { buildContext } from './context'
import type { BeanProfile, BrewLog, Recipe } from '../types'

const recipe = (p: Partial<Recipe> = {}): Recipe => ({
  id: 'r1', title: 'V60', method: 'v60', doseG: 15, waterG: 250, tempC: 92, steps: [], createdAt: 1, ...p,
} as Recipe)
const bean = (p: Partial<BeanProfile> = {}): BeanProfile => ({ id: 'b1', name: 'Эфиопия', createdAt: 1, ...p } as BeanProfile)
const log = (p: Partial<BrewLog> = {}): BrewLog => ({ id: 'l1', rating: 4, createdAt: 1, ...p } as BrewLog)

describe('buildContext', () => {
  it('пустой для brew/settings', () => {
    expect(buildContext({ name: 'brew' }, [], [], [])).toBe('')
    expect(buildContext({ name: 'settings' }, [], [], [])).toBe('')
  })
  it('рецепт по id', () => {
    const r = recipe()
    expect(buildContext({ name: 'timer', id: 'r1' }, [r], [], [])).toContain('V60')
    expect(buildContext({ name: 'timer', id: 'nope' }, [r], [], [])).toBe('')
  })
  it('edit с id и без id', () => {
    const r = recipe()
    expect(buildContext({ name: 'edit', id: 'r1' }, [r], [], [])).toContain('250 г воды')
    expect(buildContext({ name: 'edit' }, [r], [], [])).toBe('')
  })
  it('зерно', () => {
    const b = bean({ origin: 'Эфиопия', process: 'washed', roastLevel: 'light' as any })
    expect(buildContext({ name: 'bean', id: 'b1' }, [], [b], [])).toContain('Эфиопия')
  })
  it('запись журнала', () => {
    const l = log({ notes: 'кисло' })
    expect(buildContext({ name: 'entry', id: 'l1' }, [], [], [l])).toContain('оценка 4')
  })
  it('entry без записи', () => {
    expect(buildContext({ name: 'entry', id: 'nope' }, [], [], [])).toBe('')
  })
})