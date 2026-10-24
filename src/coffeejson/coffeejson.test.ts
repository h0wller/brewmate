import { describe, expect, it } from 'vitest'
import { CoffeeJSONError, parseCoffeeJSON, recipeToCoffeeJSON, toCoffeeJSON } from './coffeejson'
import type { Recipe } from '../types'

/* Фрагменты из набора проверочных документов CoffeeJSON (fixtures/valid, CC0) */
const BLOOM_STEP = {
  coffeejson: '1.0',
  recipes: [{
    title: 'Weekday V60', method: 'pour_over', brewer: { id: 'hario-v60' },
    coffee: { value: 15, unit: 'gram' }, water: { value: 250, unit: 'gram' }, ratio: 16.7,
    water_temp: { value: 93, unit: 'celsius' },
    steps: [
      { kind: 'bloom', at_s: 0, to_water: { value: 45, unit: 'gram' }, label: 'Bloom and swirl' },
      { at_s: 35, to_water: { value: 150, unit: 'gram' } },
      { at_s: 80, to_water: { value: 250, unit: 'gram' } },
    ],
    finish_s: 150,
  }],
}
const NON_METRIC = {
  coffeejson: '1.0',
  recipes: [{
    title: 'Scale-in-ounces brew',
    coffee: { value: 0.6, unit: 'ounce' }, water: { value: 10, unit: 'ounce' },
    water_temp: { value: 200, unit: 'fahrenheit' },
  }],
}
const RANGED = {
  coffeejson: '1.0',
  recipes: [
    {
      title: 'The Answer — espresso', method: 'espresso', basis: 'yield',
      coffee: { min: 18.5, max: 19, unit: 'gram' }, yield: { min: 32, max: 34, unit: 'gram' },
    },
    {
      title: 'French press, scaled to your press', method: 'french_press',
      coffee: { min: 25, max: 45, unit: 'gram' }, water: { min: 375, max: 675, unit: 'gram' }, ratio: 15,
    },
  ],
}

const mine: Recipe = {
  id: 'r1', title: 'Воскресная V60', method: 'v60', doseG: 15, waterG: 250, tempC: 93,
  grind: { grinder: { id: 'comandante-c40' }, setting: '22 клика', size: 'medium_fine' },
  steps: [
    { duration: 35, pourTo: 45, note: 'блюм' },
    { duration: 45, pourTo: 150 },
    { duration: 70, pourTo: 250, note: 'медленно по кругу' },
  ],
  createdAt: 1,
}

describe('экспорт', () => {
  it('рецепт → CoffeeJSON: единицы, метод, кумулятивные шаги', () => {
    const r = recipeToCoffeeJSON(mine) as Record<string, any>
    expect(r.method).toBe('pour_over')
    expect(r.brewer).toEqual({ id: 'hario-v60' })
    expect(r.coffee).toEqual({ value: 15, unit: 'gram' })
    expect(r.water).toEqual({ value: 250, unit: 'gram' })
    expect(r.ratio).toBe(16.7)
    expect(r.water_temp).toEqual({ value: 93, unit: 'celsius' })
    expect(r.grind).toEqual({ grinder: { id: 'comandante-c40' }, setting: '22 клика', size: 'medium_fine' })
    expect(r.steps.map((s: any) => [s.kind, s.at_s, s.to_water.value])).toEqual([
      ['bloom', 0, 45], ['pour', 35, 150], ['pour', 80, 250],
    ])
    expect(r.finish_s).toBe(150)
    expect(r.lang).toBe('ru')
  })
  it('документ: версия, генератор, рецепты', () => {
    const doc = JSON.parse(toCoffeeJSON([mine]))
    expect(doc.coffeejson).toBe('1.0')
    expect(doc.generator.name).toBe('BrewMate')
    expect(doc.recipes).toHaveLength(1)
  })
  it('своя кофемолка получает label (требование схемы), неизвестный метод — other', () => {
    const r = recipeToCoffeeJSON({ ...mine, method: 'chemex', grind: { grinder: { id: 'custom' } } }) as Record<string, any>
    expect(r.method).toBe('other')
    expect(r.grind.grinder.label).toBe('Своя кофемолка')
  })
})

describe('импорт', () => {
  it('шаги: длительность — до следующего at_s, у последнего — до finish_s', () => {
    const { recipes, skipped, notes } = parseCoffeeJSON(JSON.stringify(BLOOM_STEP))
    expect(skipped).toEqual([])
    expect(notes).toEqual([])
    const r = recipes[0]
    expect(r.method).toBe('v60')
    expect([r.doseG, r.waterG, r.tempC]).toEqual([15, 250, 93])
    expect(r.steps).toEqual([
      { duration: 35, pourTo: 45 },
      { duration: 45, pourTo: 150 },
      { duration: 70, pourTo: 250 },
    ])
  })
  it('унции и °F переводятся; без шагов получается один шаг на всю воду', () => {
    const r = parseCoffeeJSON(JSON.stringify(NON_METRIC)).recipes[0]
    expect(r.doseG).toBeCloseTo(17, 0)
    expect(r.waterG).toBeCloseTo(283.5, 1)
    expect(r.tempC).toBe(93)
    expect(r.steps).toEqual([{ duration: 180, pourTo: r.waterG }])
  })
  it('диапазоны — серединой с пометкой; рецепт по выходу пропускается с причиной', () => {
    const { recipes, skipped, notes } = parseCoffeeJSON(JSON.stringify(RANGED))
    expect(recipes).toHaveLength(1)
    expect([recipes[0].doseG, recipes[0].waterG]).toEqual([35, 525])
    expect(recipes[0].method).toBe('french')
    expect(skipped).toHaveLength(1)
    expect(skipped[0].title).toBe('The Answer — espresso')
    expect(skipped[0].reason).toContain('выход')
    expect(notes.some(n => n.includes('середина'))).toBe(true)
  })
  it('вода выводится из пропорции, если её нет', () => {
    const doc = { coffeejson: '1.1', recipes: [{ title: 'x', coffee: { value: 20, unit: 'gram' }, ratio: 15 }] }
    expect(parseCoffeeJSON(JSON.stringify(doc)).recipes[0].waterG).toBe(300)
  })
  it('помол: кофемолка с brand/model, уровень по шкале, мусорный уровень отбрасывается', () => {
    const doc = {
      coffeejson: '1.0',
      recipes: [{
        title: 'g', coffee: { value: 15, unit: 'gram' }, water: { value: 250, unit: 'gram' },
        grind: { grinder: { id: 'custom', brand: 'Timemore', model: 'C2' }, setting: '18', size: 'enormous', microns_approx: 700 },
      }],
    }
    expect(parseCoffeeJSON(JSON.stringify(doc)).recipes[0].grind).toEqual({
      grinder: { id: 'custom', label: 'Timemore C2' }, setting: '18',
    })
  })
  it('неизвестный метод сохраняется как есть; новые id не совпадают с чужими', () => {
    const doc = { coffeejson: '1.0', recipes: [{ id: 'same', title: 't', method: 'cezve', coffee: { value: 8, unit: 'gram' }, water: { value: 80, unit: 'gram' } }] }
    const r = parseCoffeeJSON(JSON.stringify(doc)).recipes[0]
    expect(r.method).toBe('cezve')
    expect(r.id).not.toBe('same')
  })
  it('шаги без времени или веса не попадают в таймер, о них сообщается', () => {
    const doc = {
      coffeejson: '1.0',
      recipes: [{
        title: 't', coffee: { value: 15, unit: 'gram' }, water: { value: 250, unit: 'gram' },
        steps: [{ kind: 'prep', instruction: 'rinse' }, { at_s: 0, to_water: { value: 250, unit: 'gram' } }],
        finish_s: 100,
      }],
    }
    const { recipes, notes } = parseCoffeeJSON(JSON.stringify(doc))
    expect(recipes[0].steps).toEqual([{ duration: 100, pourTo: 250 }])
    expect(notes.some(n => n.includes('пропущено 1'))).toBe(true)
  })
})

describe('круг: экспорт → импорт', () => {
  it('рецепт возвращается теми же числами, шагами и помолом', () => {
    const back = parseCoffeeJSON(toCoffeeJSON([mine])).recipes[0]
    expect(back.title).toBe(mine.title)
    expect(back.method).toBe('v60')
    expect([back.doseG, back.waterG, back.tempC]).toEqual([15, 250, 93])
    expect(back.steps.map(s => [s.duration, s.pourTo])).toEqual(mine.steps.map(s => [s.duration, s.pourTo]))
    expect(back.steps[0].note).toBe('блюм')
    expect(back.grind).toEqual(mine.grind)
  })
})

describe('ошибки разбора', () => {
  const kind = (text: string) => {
    try { parseCoffeeJSON(text) } catch (e) { return (e as CoffeeJSONError).kind }
    return 'нет ошибки'
  }
  it('называются словарём спецификации', () => {
    expect(kind('{не json')).toBe('not_json')
    expect(kind('{"recipes":[]}')).toBe('not_a_document')
    expect(kind('[1,2]')).toBe('not_a_document')
    expect(kind('{"coffeejson":"2.0","recipes":[{}]}')).toBe('unsupported_version')
    expect(kind('{"coffeejson":"1.0"}')).toBe('empty_document')
    expect(kind('{"coffeejson":"1.0","beans":[{"name":"x"}]}')).toBe('empty_document')
  })
})
