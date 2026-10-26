import { describe, expect, it } from 'vitest'
import { settingAfterSizeChange } from './setting'

describe('настройка при смене целевого размера помола', () => {
  it('сохраняет введённую пользователем фактическую настройку', () => {
    expect(settingAfterSizeChange(18, 'user', 24)).toEqual({ setting: 18, source: 'user' })
  })

  it('сохраняет настройку из записи журнала', () => {
    expect(settingAfterSizeChange(18, 'log', 24)).toEqual({ setting: 18, source: 'log' })
  })

  it('заменяет калибровку настройкой для нового размера', () => {
    expect(settingAfterSizeChange(18, 'calibration', 24)).toEqual({ setting: 24, source: 'calibration' })
  })

  it('сбрасывает калибровку старого размера, если для нового её нет', () => {
    expect(settingAfterSizeChange(18, 'calibration', null)).toEqual({ setting: null, source: 'none' })
  })

  it('не сохраняет старую настройку после перехода в состояние без калибровки', () => {
    expect(settingAfterSizeChange(null, 'none', null)).toEqual({ setting: null, source: 'none' })
  })

  it('подхватывает калибровку, если она есть для выбранного размера', () => {
    expect(settingAfterSizeChange(null, 'none', 24)).toEqual({ setting: 24, source: 'calibration' })
  })
})
