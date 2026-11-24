import { describe, expect, it } from 'vitest'
import { recipeAdvice } from './recipeFromBean'
import type { BeanProfile } from '../../types'

const bean: BeanProfile = {
  id: 'bean-1',
  name: 'Эфиопия Иргачефф',
  origin: 'Yirgacheffe',
  process: 'washed',
  roastLevel: 'light',
  createdAt: 1,
}

describe('recipeAdvice', () => {
  it('uses the selected method, dose and water profile', () => {
    const answer = recipeAdvice(bean, 'french', 30, 'soft', 'beginner')

    expect(answer).toContain('Френч-пресс')
    expect(answer).toContain('Доза 30 г')
    expect(answer).toContain('Мягкая')
    expect(answer).toContain('Начни с этих параметров')
  })

  it('adds the coarse grind scale for professionals without pretending it is grinder clicks', () => {
    const answer = recipeAdvice(bean, 'moccamaster', 18, 'balanced', 'pro')

    expect(answer).toContain('Moccamaster')
    expect(answer).toContain('шкалы крупности')
    expect(answer).toContain('не клики')
  })
})
