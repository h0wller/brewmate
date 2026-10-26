import { describe, expect, it } from 'vitest'
import { adviseGrind, aimFor } from './advise'
import { fitCurve, predictUm, settingFor } from './curve'
import { coarsenessFromUm, midUm, TARGET_UM } from './target'
import type { GrindStats } from './analyze'

const stats = (d50: number, p: Partial<GrindStats> = {}): GrindStats => ({
  n: 400, d10: d50 * 0.7, d50, d90: d50 * 1.4, d50n: d50, span: 0.7, limitUm: 150, coverage: 0.1, flags: [], ...p,
})

describe('цели по уровням', () => {
  it('диапазоны растут вместе с крупностью, середина лежит внутри', () => {
    let prev = 0
    for (const [size, [lo, hi]] of Object.entries(TARGET_UM)) {
      expect(lo).toBeLessThan(hi)
      expect(midUm(size as keyof typeof TARGET_UM)).toBeGreaterThan(lo)
      expect(midUm(size as keyof typeof TARGET_UM)).toBeLessThan(hi)
      expect(lo).toBeGreaterThan(prev - 1)
      prev = lo
    }
  })
  it('размер → крупность 0..6 монотонно и с ограничением', () => {
    expect(coarsenessFromUm(10)).toBe(0)
    expect(coarsenessFromUm(5000)).toBe(6)
    expect(coarsenessFromUm(midUm('medium_fine'))).toBeCloseTo(2, 5)
    expect(coarsenessFromUm(800)).toBeGreaterThan(coarsenessFromUm(600))
  })
})

describe('вердикт по фото', () => {
  it('в диапазоне — всё хорошо', () => {
    const a = adviseGrind({ stats: stats(620), size: 'medium_fine' })
    expect(a.verdict).toBe('ok')
    expect(a.offPct).toBe(0)
    expect(a.suggested).toBeUndefined()
  })
  it('мельче диапазона — сделать крупнее; крупнее — мельче; процент от края диапазона', () => {
    const fine = adviseGrind({ stats: stats(400), size: 'medium_fine' })
    expect(fine.verdict).toBe('coarser')
    expect(fine.offPct).toBe(20)
    const coarse = adviseGrind({ stats: stats(900), size: 'medium_fine' })
    expect(coarse.verdict).toBe('finer')
    expect(coarse.offPct).toBe(20)
  })
})

describe('вкус', () => {
  it('кислое при помоле у крупного края диапазона — мельче, хотя по фото «в норме»', () => {
    expect(adviseGrind({ stats: stats(740), size: 'medium_fine', taste: 'sour' }).verdict).toBe('finer')
    expect(adviseGrind({ stats: stats(520), size: 'medium_fine', taste: 'bitter' }).verdict).toBe('coarser')
  })
  it('вкус в норме не двигает цель; кислое целится мельче, горькое — крупнее', () => {
    expect(aimFor('medium_fine', 'sour')).toBeLessThan(aimFor('medium_fine'))
    expect(aimFor('medium_fine', 'bitter')).toBeGreaterThan(aimFor('medium_fine'))
  })
  it('фото говорит «мельче», а на вкус горько — не крутим помол вслепую', () => {
    const a = adviseGrind({ stats: stats(900), size: 'medium_fine', taste: 'bitter' })
    expect(a.verdict).toBe('ok')
    expect(a.notes.some(n => n.includes('не в крупности'))).toBe(true)
  })
})

describe('личная кривая', () => {
  const pts = [{ setting: 20, d50: 500 }, { setting: 30, d50: 750 }, { setting: 40, d50: 1120 }]
  it('подгоняет по замерам и предсказывает', () => {
    const c = fitCurve(pts)!
    expect(c.n).toBe(3)
    expect(c.r2).toBeGreaterThan(0.99)
    expect(Math.abs(predictUm(c, 30) - 750) / 750).toBeLessThan(0.03)
    const s = settingFor(c, 750)
    expect(Math.abs(s.setting - 30)).toBeLessThan(0.7)
    expect(s.reliable).toBe(true)
  })
  it('нужны две разные настройки; вне диапазона замеров — не «надёжно»', () => {
    expect(fitCurve([{ setting: 20, d50: 500 }])).toBeNull()
    expect(fitCurve([{ setting: 20, d50: 500 }, { setting: 20, d50: 520 }])).toBeNull()
    const c = fitCurve(pts)!
    expect(settingFor(c, 3000).extrapolated).toBe(true)
    expect(settingFor(c, 3000).reliable).toBe(false)
  })
  it('рекомендация по кривой: слишком мелко → настройка растёт', () => {
    const c = fitCurve(pts)!
    const a = adviseGrind({ stats: stats(400), size: 'medium_fine', curve: c, currentSetting: 15 })
    expect(a.verdict).toBe('coarser')
    expect(a.basis).toBe('curve')
    expect(a.suggested!).toBeGreaterThan(20)
    expect(a.suggested!).toBeLessThan(30)
  })
})

describe('без кривой', () => {
  it('по таблице пресетов — относительный шаг в нужную сторону с пометкой «ориентир»', () => {
    const a = adviseGrind({ stats: stats(400), size: 'medium_fine', grinderId: 'comandante-c40', currentSetting: 20 })
    expect(a.basis).toBe('preset')
    expect(a.suggested!).toBeGreaterThan(20)
    expect(a.notes.some(n => n.includes('ориентировочное'))).toBe(true)
    const b = adviseGrind({ stats: stats(900), size: 'medium_fine', grinderId: 'comandante-c40', currentSetting: 30 })
    expect(b.suggested!).toBeLessThan(30)
  })
  it('без кофемолки и кривой — просим двигать на шаг и переснять', () => {
    const a = adviseGrind({ stats: stats(400), size: 'medium_fine' })
    expect(a.basis).toBe('none')
    expect(a.suggested).toBeUndefined()
    expect(a.notes.some(n => n.includes('1–2 шага'))).toBe(true)
  })
  it('предупреждения о качестве снимка попадают в заметки', () => {
    const a = adviseGrind({ stats: stats(620, { flags: ['clumps'] }), size: 'medium_fine' })
    expect(a.notes.some(n => n.includes('комки'))).toBe(true)
  })
})

describe('время заваривания как подсказка', () => {
  it('дольше плана при помоле у крупного края диапазона — советует крупнее (как «горько»)', () => {
    const none = adviseGrind({ stats: stats(520), size: 'medium_fine' })
    const slow = adviseGrind({ stats: stats(520), size: 'medium_fine', flow: 'slow' })
    expect(none.verdict).toBe('ok')
    expect(slow.verdict).toBe('coarser')
    expect(slow.notes.some(n => n.includes('дольше плана'))).toBe(true)
  })
  it('быстрее плана при помоле у крупного края — советует мельче (как «кисло»)', () => {
    const fast = adviseGrind({ stats: stats(740), size: 'medium_fine', flow: 'fast' })
    expect(fast.verdict).toBe('finer')
    expect(fast.notes.some(n => n.includes('быстрее плана'))).toBe(true)
  })
  it('вкус главнее времени: «кисло» + «дольше плана» не превращается в «горько»', () => {
    const a = adviseGrind({ stats: stats(740), size: 'medium_fine', taste: 'sour', flow: 'slow' })
    expect(a.verdict).toBe('finer')
    expect(a.notes.some(n => n.includes('дольше плана'))).toBe(false)
  })
  it('вкус «нормально» оставляет время подсказкой, а отсутствие времени ничего не меняет', () => {
    expect(adviseGrind({ stats: stats(520), size: 'medium_fine', taste: 'ok', flow: 'slow' }).verdict).toBe('coarser')
    expect(adviseGrind({ stats: stats(620), size: 'medium_fine' }).verdict).toBe('ok')
  })
})
