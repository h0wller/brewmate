import { describe, expect, it } from 'vitest'
import {
  allPresetSettings,
  coarsenessFromSetting,
  convertGrindSetting,
  formatCoffeeOS,
  getGrinderScale,
  GRINDER_PRESETS,
  parseDialValue,
  presetSettingByCoarseness,
  presetSettingForSize,
} from './presets'
import { factoryCalibration, smartSettingFor, withGrinder, withRedClix, hasCalibration } from './profile'
import { CATALOG } from './catalog'
import type { GrinderProfile } from '../types'

describe('presetSettingByCoarseness', () => {
  it('Comandante C40 точные клики и интерполяция', () => {
    // scale points: [7, 12, 24, 27, 30, 33, 38]
    expect(presetSettingByCoarseness('comandante-c40', 0)).toBe('7 кл.')
    expect(presetSettingByCoarseness('comandante-c40', 2)).toBe('24 кл.')
    expect(presetSettingByCoarseness('comandante-c40', 3)).toBe('27 кл.')
    // 2.5 -> 24 + 0.5 * (27 - 24) = 25.5 -> round 26
    expect(presetSettingByCoarseness('comandante-c40', 2.5)).toBe('26 кл.')
  })

  it('Red Clix удваивает клики Comandante', () => {
    expect(presetSettingByCoarseness('comandante-c40', 2, true)).toBe('48 кл.')
    expect(presetSettingByCoarseness('comandante-c40', 3, true)).toBe('54 кл.')
  })

  it('поддерживает шкалы с десятичными делениями (Fellow Ode Gen 2, Mahlkönig EK43)', () => {
    // fellow-ode-gen-2: [1.0, 2.0, 4.8, 6.0, 7.2, 9.0, 10.5]
    expect(presetSettingByCoarseness('fellow-ode-gen-2', 2)).toBe('4.8 дел.')
    expect(presetSettingByCoarseness('fellow-ode-gen-2', 3)).toBe('6 дел.')
  })

  it('нотация CoffeeOS добавляется для многооборотных моделей', () => {
    // timemore-c3: points: [7, 9, 15, 18, 21, 24, 28], dial: [12, 12] (12 кл/об, 12 цифр -> 1 кл/цифра)
    // 18 clicks -> 1 оборот, 6 кликов -> "18 кл. (1-6)"
    expect(presetSettingByCoarseness('timemore-c3', 3)).toBe('18 кл. (1-6)')
  })

  it('неизвестная модель возвращает undefined', () => {
    expect(presetSettingByCoarseness('unknown-grinder', 2)).toBeUndefined()
    expect(presetSettingByCoarseness(undefined, 2)).toBeUndefined()
  })
})

describe('getGrinderScale & aliases', () => {
  it('находит модель по псевдониму', () => {
    expect(getGrinderScale('timemore-c2')?.dialRange).toBe('0–36 кл.')
    expect(getGrinderScale('comandante-c40-mk4')?.unit).toBe('кл.')
  })
})

describe('presetSettingForSize & allPresetSettings', () => {
  it('находит базовый уровень крупности и заполняет пресеты', () => {
    expect(presetSettingForSize('comandante-c40', 'medium_fine')).toBe('24 кл.')
    const all = allPresetSettings('comandante-c40')
    expect(all.medium_fine).toBe('24 кл.')
    expect(all.fine).toBe('12 кл.')
  })
})

describe('coarsenessFromSetting', () => {
  it('определяет дробный coarseness по числу или строке', () => {
    expect(coarsenessFromSetting('comandante-c40', '24')).toBe(2)
    expect(coarsenessFromSetting('comandante-c40', 24)).toBe(2)
    expect(coarsenessFromSetting('comandante-c40', '48', true)).toBe(2)
  })
})

describe('formatCoffeeOS', () => {
  it('форматирует Оборот-Цифра-Клик для 1Zpresso (40 кл/об, 10 цифр)', () => {
    expect(formatCoffeeOS(145, [40, 10])).toBe('3-6-1')
  })
})

describe('convertGrindSetting', () => {
  it('конвертирует 24 клика Comandante C40 в Fellow Ode Gen 2', () => {
    // 24 кл. на C40 — это точно coarseness = 2 (medium_fine)
    // на Fellow Ode Gen 2 это 4.8 дел.
    const res = convertGrindSetting('comandante-c40', '24 кл.', 'fellow-ode-gen-2')
    expect(res).toBeDefined()
    expect(res?.targetSetting).toBe('4.8 дел.')
    expect(res?.size).toBe('medium_fine')
  })

  it('конвертирует обратно из Fellow Ode в Comandante C40', () => {
    const res = convertGrindSetting('fellow-ode-gen-2', '4.8', 'comandante-c40')
    expect(res?.targetSetting).toBe('24 кл.')
  })

  it('учитывает Red Clix при конвертации', () => {
    // 48 кл. на C40 с Red Clix — это то же самое, что 24 кл. без него
    const res = convertGrindSetting('comandante-c40', '48', 'fellow-ode-gen-2', true, false)
    expect(res?.targetSetting).toBe('4.8 дел.')
  })
})

describe('smartSettingFor', () => {
  it('приоритет у ручной калибровки пользователя над пресетом', () => {
    const profile: GrinderProfile = {
      grinder: { id: 'comandante-c40' },
      calibration: { medium_fine: '22 клика' },
    }
    expect(smartSettingFor(profile, 'medium_fine', 2.0)).toBe('22 клика')
    // для уровня без ручной калибровки используется пресет
    expect(smartSettingFor(profile, 'medium', 3.0)).toBe('≈ 27 кл.')
  })
})

describe('конвертер: числовой результат и разбор ввода', () => {
  it('возвращает число, а не только строку (кнопка «поменять» раньше склеивала цифры из «46 кл. (1-5-1)»)', () => {
    const res = convertGrindSetting('comandante-c40', '24', 'timemore-c3-esp')
    expect(res?.targetSetting.includes('(')).toBe(true)
    expect(typeof res?.targetValue).toBe('number')
    expect(res?.targetValue).toBe(46)
  })

  it('значение «поменять» возвращается обратно без потерь', () => {
    const a = convertGrindSetting('comandante-c40', '24', 'timemore-c3-esp')
    const b = convertGrindSetting('timemore-c3-esp', String(a?.targetValue), 'comandante-c40')
    expect(b?.targetSetting).toBe('24 кл.')
  })

  it('Red Clix учитывается в числовом результате', () => {
    expect(convertGrindSetting('fellow-ode-gen-2', '4.8', 'comandante-c40', false, true)?.targetValue).toBe(48)
  })

  it('«1.5» на кликовой шкале — дробь, а не оборот.цифра; «1-4-5» и «1.4.5» — формат CoffeeOS', () => {
    const scale = getGrinderScale('1zpresso-zp6')
    expect(parseDialValue('1.5', scale)).toBe(1.5)
    expect(parseDialValue('22.5', scale)).toBe(22.5)
    // zp6: 90 кл/об, 9 цифр → 10 кл. на цифру
    expect(parseDialValue('1-4-5', scale)).toBe(135)
    expect(parseDialValue('1.4.5', scale)).toBe(135)
    expect(parseDialValue('55 кл. (0-5-5)', scale)).toBe(55)
    expect(parseDialValue('≈ 24 кл.', scale)).toBe(24)
    expect(parseDialValue('≈ 1-4-5', scale)).toBe(135)
  })
})

describe('таблица пресетов: внутренняя согласованность', () => {
  const entries = Object.entries(GRINDER_PRESETS)
  const catalogIds = new Set(CATALOG.map(g => g.id))

  it('каждая модель есть в каталоге', () => {
    for (const [id] of entries) expect(catalogIds.has(id)).toBe(true)
  })

  it('точки не убывают по мере роста крупности', () => {
    for (const [id, s] of entries) {
      for (let i = 1; i < s.points.length; i++) {
        if (s.points[i] < s.points[i - 1]) throw new Error(`${id}: точка ${i} меньше предыдущей`)
      }
    }
  })

  it('точки не выходят за шкалу, указанную в dialRange (для однооборотных шкал вида «0–N»)', () => {
    for (const [id, s] of entries) {
      if (s.coffeeOsDial) continue // клики идут по нескольким оборотам — диапазон в тексте означает один оборот
      const m = s.dialRange?.match(/^\d+(?:\.\d+)?\s*[–-]\s*(\d+(?:\.\d+)?)/)
      if (!m) continue
      if (s.points[6] > Number(m[1])) throw new Error(`${id}: ${s.points[6]} > ${m[1]} (${s.dialRange})`)
    }
  })
})

describe('профиль: смена кофемолки и Red Clix', () => {
  it('смена модели сбрасывает настройки прежней кофемолки и Red Clix', () => {
    const p: GrinderProfile = {
      grinder: { id: 'comandante-c40' }, redClix: true, calibration: { medium_fine: '48 кл.' },
    }
    const next = withGrinder(p, 'timemore-c3', 'Timemore C3')
    expect(next.calibration).toEqual({})
    expect(next.redClix).toBeUndefined()
    expect(next.grinder?.id).toBe('timemore-c3')
  })

  it('повторный выбор той же модели ничего не сбрасывает', () => {
    const p: GrinderProfile = { grinder: { id: 'comandante-c40' }, calibration: { medium_fine: '22 кл.' } }
    expect(withGrinder(p, 'comandante-c40', 'Comandante C40').calibration).toEqual({ medium_fine: '22 кл.' })
    expect(hasCalibration(p)).toBe(true)
  })

  it('включение Red Clix пересчитывает заводскую шкалу, но не трогает свои значения', () => {
    const factory: GrinderProfile = { grinder: { id: 'comandante-c40' }, calibration: factoryCalibration('comandante-c40') }
    const red = withRedClix(factory, true)
    expect(red.calibration.medium_fine).toBe('≈ 48 кл.')
    expect(withRedClix(red, false).calibration.medium_fine).toBe('≈ 24 кл.')

    const own: GrinderProfile = { grinder: { id: 'comandante-c40' }, calibration: { medium_fine: '22 кл.' } }
    expect(withRedClix(own, true).calibration).toEqual({ medium_fine: '22 кл.' })
    expect(withRedClix(own, true).redClix).toBe(true)
  })
})
