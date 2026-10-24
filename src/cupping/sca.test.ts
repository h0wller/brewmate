import { describe, expect, it } from 'vitest'
import { coeScore, defectPoints, emptyLot, q, scaScore } from './sca'

describe('каппинг', () => {
  it('пустой лот SCA: 7 атрибутов по 7 + 30 за чашки = 79', () => {
    expect(scaScore(emptyLot('A'))).toEqual({ quality: 49, cups: 30, defects: 0, total: 79 })
  })

  it('пустой лот CoE: 9 атрибутов по 7 + 10 за однородность = 73', () => {
    expect(coeScore(emptyLot('A'))).toEqual({ quality: 63, cups: 10, defects: 0, total: 73 })
  })

  it('чашка без отметки снимает 2 балла', () => {
    const lot = emptyLot('A')
    lot.cups.sweetness[0] = false
    expect(scaScore(lot).cups).toBe(28)
    expect(scaScore(lot).total).toBe(77)
  })

  /* ВАЖНО: тесты фиксируют ТЕКУЩУЮ формулу (taint ×1, fault ×2).
     Её нужно сверить с официальной формой SCA — при смене формулы обновить ожидания. */
  it('дефекты: интенсивность × чашки × тип (текущая формула)', () => {
    expect(defectPoints({ id: 'd', type: 'taint', intensity: 2, cups: 3 })).toBe(6)
    expect(defectPoints({ id: 'd', type: 'fault', intensity: 2, cups: 3 })).toBe(12)
  })

  it('дефекты вычитаются из итога', () => {
    const lot = emptyLot('A')
    lot.defects = [{ id: 'd', type: 'fault', intensity: 2, cups: 3 }]
    const s = scaScore(lot)
    expect(s.defects).toBe(12)
    expect(s.total).toBe(67)
  })

  it('q форматирует баллы без лишних нулей', () => {
    expect(q(7)).toBe('7')
    expect(q(7.5)).toBe('7.5')
    expect(q(7.256)).toBe('7.26')
  })
})
