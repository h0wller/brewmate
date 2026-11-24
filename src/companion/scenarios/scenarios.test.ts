import { describe, expect, it } from 'vitest'
import { recipeAdvice } from './recipeFromBean'
import { extractionAdvice } from './extractionAdvice'
import type { BeanProfile, BrewLog } from '../../types'

describe('recipeFromBean scenario', () => {
  const bean: BeanProfile = { id: 'b', name: 'Эфиопия', roastLevel: 'light', process: 'washed', createdAt: 1 } as any
  it('возвращает рекомендацию', () => {
    const r = recipeAdvice(bean, 'v60', 15)
    expect(r).toContain('Доза 15 г')
    expect(r).toContain('Температура')
    expect(r).toContain('Помол')
  })
})

describe('extractionAdvice', () => {
  it('низкая оценка', () => {
    const log: BrewLog = { id: 'l', rating: 2, createdAt: 1 } as any
    expect(extractionAdvice(log)).toContain('недостаточная')
  })
  it('хорошая оценка', () => {
    const log: BrewLog = { id: 'l', rating: 5, createdAt: 1 } as any
    expect(extractionAdvice(log)).toContain('Хороший результат')
  })
  it('учитывает заметки', () => {
    const log: BrewLog = { id: 'l', rating: 3, notes: 'кисло', createdAt: 1 } as any
    expect(extractionAdvice(log)).toContain('кисло')
  })
})