import { describe, expect, it } from 'vitest'
import { formatRoute, parseRoute, tabOf } from './route'
import type { Route } from './route'

const ALL: Route[] = [
  { name: 'brew' },
  { name: 'timer', id: 'abc123' },
  { name: 'edit' },
  { name: 'edit', id: 'abc123' },
  { name: 'settings' },
  { name: 'grinder' },
  { name: 'ai' },
  { name: 'beans' },
  { name: 'bean', id: 'b1' },
  { name: 'cupping' },
  { name: 'session', id: 's1' },
  { name: 'journal' },
  { name: 'entry', id: 'l1' },
]

describe('route', () => {
  it('format → parse возвращает тот же маршрут', () => {
    for (const r of ALL) expect(parseRoute(formatRoute(r))).toEqual(r)
  })

  it('пустой и неизвестный адрес ведут на список рецептов', () => {
    expect(parseRoute('')).toEqual({ name: 'brew' })
    expect(parseRoute('#')).toEqual({ name: 'brew' })
    expect(parseRoute('#/')).toEqual({ name: 'brew' })
    expect(parseRoute('#/что-то/левое')).toEqual({ name: 'brew' })
  })

  it('понимает адрес без слэша после #', () => {
    expect(parseRoute('#beans/x')).toEqual({ name: 'bean', id: 'x' })
  })

  it('id с неудобными символами кодируется и читается обратно', () => {
    const r: Route = { name: 'timer', id: 'а б/в?#' }
    expect(parseRoute(formatRoute(r))).toEqual(r)
  })

  it('битая percent-последовательность не роняет разбор', () => {
    expect(parseRoute('#/brew/%E0%A4%A')).toEqual({ name: 'timer', id: '%E0%A4%A' })
  })

  it('tabOf: вкладка по маршруту', () => {
    expect(tabOf({ name: 'timer', id: 'x' })).toBe('brew')
    expect(tabOf({ name: 'settings' })).toBe('brew')
    expect(tabOf({ name: 'grinder' })).toBe('brew')
    expect(tabOf({ name: 'bean', id: 'x' })).toBe('bean')
    expect(tabOf({ name: 'session', id: 'x' })).toBe('cup')
    expect(tabOf({ name: 'journal' })).toBe('log')
    expect(tabOf({ name: 'entry', id: 'x' })).toBe('log')
  })
})
