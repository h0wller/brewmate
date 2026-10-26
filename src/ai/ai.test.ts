import { describe, expect, it } from 'vitest'
import { AIError, buildPackagePrompt, parseProxyResponse } from './client'
import { fitStepsToWater } from './fit'
import { fitSize } from './image'

const kindOf = (status: number, body: unknown) => {
  try { parseProxyResponse(status, body) } catch (e) { return e instanceof AIError ? e.kind : 'не AIError' }
  return 'нет ошибки'
}
const messageOf = (status: number, body: unknown) => {
  try { parseProxyResponse(status, body) } catch (e) { return (e as Error).message }
  return ''
}

describe('parseProxyResponse', () => {
  it('200 с result возвращает результат', () => {
    expect(parseProxyResponse(200, { result: { bean: { name: 'x' } } })).toEqual({ bean: { name: 'x' } })
  })
  it('200 без result — ошибка, а не молчаливое «пусто»', () => {
    expect(kindOf(200, {})).toBe('bad')
    expect(kindOf(200, { result: 'строка' })).toBe('bad')
  })
  it('лимит на человека и общий лимит различаются и подсказывают про свой ключ', () => {
    const resetAt = '2026-10-25T00:00:00.000Z'
    expect(kindOf(429, { error: 'limit', scope: 'user', resetAt })).toBe('limit_user')
    expect(kindOf(429, { error: 'limit', scope: 'global', resetAt })).toBe('limit_global')
    expect(messageOf(429, { error: 'limit', scope: 'user', resetAt })).toContain('свой ключ')
  })
  it('503: перегрузка и «не настроено» — разные ошибки', () => {
    expect(kindOf(503, { error: 'busy' })).toBe('busy')
    expect(kindOf(503, { error: 'not_configured' })).toBe('unavailable')
  })
  it('404/405 (нет серверной функции, например в vite dev) — понятное сообщение', () => {
    expect(kindOf(404, null)).toBe('unavailable')
    expect(messageOf(405, null)).toContain('vercel dev')
  })
  it('прочее: 413, 400 с пояснением, 500', () => {
    expect(kindOf(413, {})).toBe('bad')
    expect(messageOf(400, { message: 'нужна картинка' })).toContain('нужна картинка')
    expect(kindOf(500, null)).toBe('busy')
  })
})

describe('fitSize', () => {
  it('уменьшает по длинной стороне с сохранением пропорций', () => {
    expect(fitSize(4000, 3000)).toEqual({ w: 1024, h: 768 })
    expect(fitSize(3000, 4000)).toEqual({ w: 768, h: 1024 })
  })
  it('маленькие картинки не увеличивает', () => {
    expect(fitSize(500, 300)).toEqual({ w: 500, h: 300 })
  })
  it('не даёт нулевой стороны', () => {
    expect(fitSize(10000, 1)).toEqual({ w: 1024, h: 1 })
  })
})

describe('fitStepsToWater', () => {
  const steps = [
    { duration: 45, pourTo: 45, note: 'блюм' },
    { duration: 30, pourTo: 150, note: '' },
    { duration: 30, pourTo: 240, note: '' },
  ]
  it('доза 60 г вместо 15: шаги подтягиваются под всю воду, порядок сохраняется', () => {
    const out = fitStepsToWater(steps, 960)
    expect(out.map(s => s.pourTo)).toEqual([180, 600, 960])
    expect(out.map(s => s.duration)).toEqual([45, 30, 30])
  })
  it('если уже совпало или вода некорректна — без изменений', () => {
    expect(fitStepsToWater(steps, 240)).toBe(steps)
    expect(fitStepsToWater(steps, 0)).toBe(steps)
    expect(fitStepsToWater([], 240)).toEqual([])
  })
})

describe('промпт: доза и вода', () => {
  it('подставляет дозу, воду, устройство и данные карточки зерна', () => {
    const p = buildPackagePrompt('V60', { doseG: 60, water: 'hard' })
    expect(p.includes('доза 60 г')).toBe(true)
    expect(p.includes('жёсткая')).toBe(true)
    const devicePrompt = buildPackagePrompt('Moccamaster', { doseG: 30, bean: { process: 'honey', roastLevel: 'light', roastDate: '2026-10-01' } })
    expect(devicePrompt).toContain('Moccamaster')
    expect(devicePrompt).toContain('машинный цикл')
    expect(devicePrompt).toContain('обработка: honey')
    expect(devicePrompt).toContain('обжарка: light')
    expect(devicePrompt).toContain('2026-10-01')
    expect(buildPackagePrompt('V60').includes('доза 15 г')).toBe(true)
  })
})
