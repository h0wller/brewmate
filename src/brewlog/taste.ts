import type { BrewTaste } from '../types'
import type { Taste } from '../grind/advise'

export const BREW_TASTES: BrewTaste[] = ['sour', 'bitter', 'weak', 'balanced']

export const TASTE_LABEL: Record<BrewTaste, string> = {
  sour: 'Кисло',
  bitter: 'Горько',
  weak: 'Водянисто',
  balanced: 'Баланс',
}

export const isBrewTaste = (v: unknown): v is BrewTaste =>
  typeof v === 'string' && (BREW_TASTES as string[]).includes(v)

/* Что вкус значит для совета по помолу. «Водянисто» не связываем с помолом: так бывает и из-за дозы или воды. */
export function tasteForGrind(t: unknown): Taste | undefined {
  if (t === 'sour') return 'sour'
  if (t === 'bitter') return 'bitter'
  if (t === 'balanced') return 'ok'
  return undefined
}
