import { describe, expect, it } from 'vitest'
import { formatGrind, grinderLabel, migrateGrind, normalizeGrind } from './grind'
import { emptyProfile, grindFor, sanitizeProfile, settingFor } from './profile'

describe('normalizeGrind', () => {
  it('старая строка становится настройкой как есть', () => {
    expect(normalizeGrind('Comandante 24 клика')).toEqual({ setting: 'Comandante 24 клика' })
  })
  it('пустое и мусор — undefined', () => {
    expect(normalizeGrind('  ')).toBeUndefined()
    expect(normalizeGrind(null)).toBeUndefined()
    expect(normalizeGrind(42)).toBeUndefined()
    expect(normalizeGrind({})).toBeUndefined()
  })
  it('объект: оставляет только известные поля и проверяет размер по шкале', () => {
    expect(normalizeGrind({
      grinder: { id: 'comandante-c40', label: 'C40' }, setting: '22 клика', size: 'medium_fine', лишнее: 1,
    })).toEqual({ grinder: { id: 'comandante-c40', label: 'C40' }, setting: '22 клика', size: 'medium_fine' })
    expect(normalizeGrind({ size: 'очень крупный', setting: 'x' })).toEqual({ setting: 'x' })
  })
})

describe('migrateGrind', () => {
  it('не трогает запись без помола и приводит строку к объекту', () => {
    const noGrind = { id: 'a' }
    expect(migrateGrind(noGrind)).toBe(noGrind)
    expect(migrateGrind({ id: 'b', grind: 'мелко' })).toEqual({ id: 'b', grind: { setting: 'мелко' } })
  })
})

describe('formatGrind / grinderLabel', () => {
  const g = { grinder: { id: 'comandante-c40' }, setting: '22 клика', size: 'medium_fine' as const }
  it('настройка и уровень; кофемолка — по флагу', () => {
    expect(formatGrind(g)).toBe('22 клика · средне-мелкий')
    expect(formatGrind(g, { withGrinder: true })).toBe('Comandante C40 · 22 клика · средне-мелкий')
    expect(formatGrind(undefined)).toBe('')
  })
  it('неизвестная кофемолка показывает свой label, а без него — id', () => {
    expect(grinderLabel({ grinder: { id: 'custom', label: 'Моя самоделка' } })).toBe('Моя самоделка')
    expect(grinderLabel({ grinder: { id: 'custom' } })).toBe('custom')
    expect(grinderLabel({})).toBeUndefined()
  })
})

describe('профиль «моя кофемолка»', () => {
  it('sanitizeProfile отбрасывает мусор и обрезает значения', () => {
    const p = sanitizeProfile({
      grinder: { id: 'timemore-c3' },
      calibration: { medium_fine: ' 18 ', coarse: '', fake: '1', fine: 5 },
    })
    expect(p).toEqual({ grinder: { id: 'timemore-c3' }, calibration: { medium_fine: '18' } })
    expect(sanitizeProfile('мусор')).toEqual(emptyProfile())
  })

  it('settingFor и grindFor подставляют калибровку пользователя', () => {
    const p = sanitizeProfile({ grinder: { id: 'timemore-c3' }, calibration: { medium_fine: '18' } })
    expect(settingFor(p, 'medium_fine')).toBe('18')
    expect(settingFor(p, 'coarse')).toBeUndefined()
    expect(grindFor(p, 'medium_fine')).toEqual({ size: 'medium_fine', grinder: { id: 'timemore-c3' }, setting: '18' })
    expect(grindFor(emptyProfile(), 'coarse')).toEqual({ size: 'coarse' })
  })
})
