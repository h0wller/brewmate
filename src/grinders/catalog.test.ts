import { describe, expect, it } from 'vitest'
import { CATALOG, CATALOG_SOURCE, findGrinder, isRegistryGrinder, searchGrinders } from './catalog'

describe('каталог кофемолок (CoffeeJSON, CC0)', () => {
  it('источник и лицензия указаны', () => {
    expect(CATALOG_SOURCE.license).toBe('CC0-1.0')
    expect(CATALOG_SOURCE.commit.length > 6).toBe(true)
  })

  it('id уникальны и в формате kebab-case, у всех есть название', () => {
    const ids = CATALOG.map(g => g.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const g of CATALOG) {
      expect(/^[a-z0-9]+(-[a-z0-9]+)*$/.test(g.id)).toBe(true)
      expect(g.label.length > 0).toBe(true)
    }
  })

  it('псевдонимы не совпадают с id других записей', () => {
    const ids = new Set(CATALOG.map(g => g.id))
    for (const g of CATALOG) for (const a of g.aliases ?? []) expect(ids.has(a)).toBe(false)
  })

  it('реестр CoffeeJSON и ручные добавки различаются', () => {
    expect(isRegistryGrinder('comandante-c40')).toBe(true)
    expect(isRegistryGrinder('comandante-c60')).toBe(false)
    expect(findGrinder('comandante-c40-mk4')?.id).toBe('comandante-c40')
  })

  it('в каталоге есть известные модели', () => {
    expect(findGrinder('comandante-c40')?.label).toBe('Comandante C40')
    expect(findGrinder('timemore-c3')?.label).toBe('Timemore C3')
  })
})

describe('searchGrinders', () => {
  it('ищет по части названия без учёта регистра и знаков', () => {
    expect(searchGrinders('comandante').map(g => g.id)).toContain('comandante-c40')
    expect(searchGrinders('TIMEMORE c3').map(g => g.id)).toContain('timemore-c3')
  })
  it('ищет по псевдониму и id', () => {
    expect(searchGrinders('lagom-mini').map(g => g.id)).toContain('option-o-lagom-mini')
    expect(findGrinder('timemore-c2')?.id).toBe('timemore-chestnut-c2')
  })
  it('пустой запрос — начало каталога, ограниченное limit; ненайденное — пусто', () => {
    expect(searchGrinders('', 5)).toHaveLength(5)
    expect(searchGrinders('такой кофемолки нет')).toEqual([])
  })
})
