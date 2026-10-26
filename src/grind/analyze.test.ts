import { describe, expect, it } from 'vitest'
import { MAX_SINGLE_UM, detectCoinCircle, equivDiameterUm, otsu, particleAreaLimits, scaleFromPoints, segment, summarize, toGray, computeSieveCalibrationFactor } from './analyze'
import type { Img } from './analyze'

interface Disc { x: number; y: number; r: number }

/* Светлая «бумага» и тёмные круглые «частицы» известного размера */
function makeImage(W: number, H: number, discs: Disc[], bg = 240, fg = 40): Img {
  const data = new Uint8ClampedArray(W * H * 4)
  for (let i = 0; i < W * H; i++) { data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = bg; data[i * 4 + 3] = 255 }
  for (const d of discs) {
    for (let y = Math.max(0, Math.floor(d.y - d.r)); y <= Math.min(H - 1, Math.ceil(d.y + d.r)); y++) {
      for (let x = Math.max(0, Math.floor(d.x - d.r)); x <= Math.min(W - 1, Math.ceil(d.x + d.r)); x++) {
        if ((x - d.x) ** 2 + (y - d.y) ** 2 <= d.r ** 2) {
          const k = (y * W + x) * 4
          data[k] = data[k + 1] = data[k + 2] = fg
        }
      }
    }
  }
  return { data, width: W, height: H }
}

/* Сетка: каждая частица в своей ячейке, не касается соседей */
function grid(cols: number, rows: number, cell: number, radius: (i: number) => number, margin = 30): Disc[] {
  const out: Disc[] = []
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const i = r * cols + c
    out.push({ x: margin + c * cell + cell / 2, y: margin + r * cell + cell / 2, r: radius(i) })
  }
  return out
}

const PX_PER_MM = 20 // радиус 6 px = диаметр 0,6 мм = 600 мкм
const SIZE = 30 * 2 + 15 * 40

describe('масштаб', () => {
  it('пикселей на миллиметр по двум краям монеты', () => {
    expect(scaleFromPoints({ x: 0, y: 0 }, { x: 300, y: 400 }, 25)).toBe(20)
    expect(scaleFromPoints({ x: 5, y: 5 }, { x: 5, y: 5 }, 25)).toBeNull()
    expect(scaleFromPoints({ x: 0, y: 0 }, { x: 10, y: 0 }, 0)).toBeNull()
  })
  it('диаметр круга той же площади', () => {
    expect(Math.round(equivDiameterUm(Math.PI * 36, 20))).toBe(600)
  })
})

describe('порог Оцу', () => {
  it('отделяет тёмное от светлого', () => {
    const img = makeImage(100, 100, [{ x: 50, y: 50, r: 20 }])
    const t = otsu(toGray(img))
    expect(t).toBeGreaterThanOrEqual(40)
    expect(t).toBeLessThan(240)
  })
})

describe('измерение размера', () => {
  const img = makeImage(SIZE, SIZE, grid(15, 15, 40, () => 6))
  const stats = summarize(segment(img), PX_PER_MM)

  it('находит все частицы и размер ≈ 600 мкм', () => {
    expect(stats).not.toBeNull()
    expect(stats!.n).toBe(225)
    expect(Math.abs(stats!.d50 - 600) / 600).toBeLessThan(0.06)
    expect(Math.abs(stats!.d10 - 600) / 600).toBeLessThan(0.08)
    expect(stats!.span).toBeLessThan(0.2)
    expect(stats!.flags).toEqual([])
  })

  it('коэффициент коррекции пропорционально масштабирует D10, D50 и D90', () => {
    const corrected = summarize(segment(img), PX_PER_MM, { calibrationFactor: 0.82 })!
    expect(corrected.d10).toBeCloseTo(stats!.d10 * 0.82, 8)
    expect(corrected.d50).toBeCloseTo(stats!.d50 * 0.82, 8)
    expect(corrected.d90).toBeCloseTo(stats!.d90 * 0.82, 8)
    expect(summarize(segment(img), PX_PER_MM)!.d50).toBeCloseTo(stats!.d50, 8)
  })

  it('более мелкий помол даёт меньший D50, более крупный — больший', () => {
    const fine = summarize(segment(makeImage(SIZE, SIZE, grid(15, 15, 40, () => 4))), PX_PER_MM)!
    const coarse = summarize(segment(makeImage(SIZE, SIZE, grid(15, 15, 40, () => 9))), PX_PER_MM)!
    expect(fine.d50).toBeLessThan(stats!.d50)
    expect(coarse.d50).toBeGreaterThan(stats!.d50)
  })

  it('смесь: по объёму преобладают крупные, поэтому D50 по объёму больше D50 по числу', () => {
    const mix = summarize(segment(makeImage(SIZE, SIZE, grid(15, 15, 40, i => (i % 3 === 0 ? 9 : 4)))), PX_PER_MM)!
    expect(mix.d50).toBeGreaterThan(mix.d50n)
    expect(mix.span).toBeGreaterThan(0.2)
  })

  it('частицы на краю кадра и мелкий шум не считаются', () => {
    const discs = [...grid(15, 15, 40, () => 6), { x: 2, y: 300, r: 8 }, { x: 40, y: 16, r: 1 }]
    const seg = segment(makeImage(SIZE, SIZE, discs), { minArea: 6 })
    expect(seg.particles.length).toBe(225)
    expect(seg.dropped.border).toBeGreaterThan(0)
  })

  it('монета и другие отмеченные круги исключаются', () => {
    const coin: Disc = { x: 300, y: 300, r: 100 }
    const withCoin = makeImage(SIZE, SIZE, [...grid(15, 15, 40, () => 6).filter(d => Math.hypot(d.x - 300, d.y - 300) > 130), coin])
    const raw = summarize(segment(withCoin), PX_PER_MM)!
    const excl = summarize(segment(withCoin, { exclude: [{ cx: 300, cy: 300, r: 100 }] }), PX_PER_MM)!
    expect(raw.d90).toBeGreaterThan(2000)            // без исключения монета «ломает» результат
    expect(Math.abs(excl.d90 - 600) / 600).toBeLessThan(0.1)
  })
})

describe('калибровка по ситам', () => {
  it('считает отношение ситового D50 к сырому D50 и ограничивает коэффициент', () => {
    expect(computeSieveCalibrationFactor(900, '600-900')).toBeCloseTo(735 / 900, 8)
    expect(computeSieveCalibrationFactor(0, '600-900')).toBeNull()
    expect(computeSieveCalibrationFactor(-1, '600-900')).toBeNull()
    expect(computeSieveCalibrationFactor(1, 'over-1400')).toBe(1.45)
    expect(computeSieveCalibrationFactor(10000, 'under-600')).toBe(0.55)
  })
})

describe('предупреждения о качестве', () => {
  it('мало частиц', () => {
    const s = summarize(segment(makeImage(400, 400, grid(4, 4, 80, () => 6))), PX_PER_MM)!
    expect(s.flags).toContain('few_particles')
  })
  it('слишком густо', () => {
    const s = summarize(segment(makeImage(SIZE, SIZE, grid(20, 20, 28, () => 12, 10))), PX_PER_MM)!
    expect(s.coverage).toBeGreaterThan(0.3)
    expect(s.flags).toContain('too_dense')
  })
  it('слишком далёкий снимок: мелочь не видна', () => {
    const s = summarize(segment(makeImage(SIZE, SIZE, grid(15, 15, 40, () => 2.5))), PX_PER_MM)!
    expect(s.flags).toContain('low_resolution')
  })
  it('комки: несколько крупных пятен несут основной объём', () => {
    const small = grid(15, 15, 40, () => 4).filter((_, i) => i % 5 !== 0)
    const blobs = [60, 220, 380, 540].map(c => ({ x: c + 20, y: 20 + 0, r: 22 }))
    const s = summarize(segment(makeImage(SIZE, SIZE, [...small.filter(d => d.y > 80), ...blobs.map(b => ({ ...b, y: 50 }))])), PX_PER_MM)!
    expect(s.flags).toContain('clumps')
  })
  it('пустой кадр — нет результата', () => {
    expect(summarize(segment(makeImage(100, 100, [])), PX_PER_MM)).toBeNull()
  })
})

/* Боевой путь экрана: segment с maxArea (лист-ROI, локальный порог, фильтры формы) + summarize.
   Замер не должен зависеть от ожиданий: на «лабораторном» кадре он совпадает с простым путём. */
describe('боевой путь с границами одиночной крупинки', () => {
  const run = (img: Img) => {
    const lim = particleAreaLimits(PX_PER_MM)
    return { seg: segment(img, lim), stats: summarize(segment(img, lim), PX_PER_MM) }
  }

  it('границы площади: 95 мкм — шум, 2,5 мм — предел одиночной крупинки', () => {
    const hi = particleAreaLimits(60)                      // 60 px/мм: 95 мкм ≈ 5,7 px
    expect(Math.abs(hi.minArea - Math.PI * (0.095 * 60 / 2) ** 2)).toBeLessThan(1)
    expect(Math.abs(hi.maxArea - Math.PI * (MAX_SINGLE_UM / 1000 * 60 / 2) ** 2)).toBeLessThan(2)
    expect(particleAreaLimits(5).minArea).toBe(4)          // у далёкого снимка нижняя граница не падает ниже 4 px²
  })

  for (const um of [400, 600, 900, 1200, 1600]) it(`размер ${um} мкм измеряется так же, как простым путём (±5 %)`, () => {
    const r = um / 1000 * PX_PER_MM / 2
    const cell = Math.ceil(r * 2) + 14
    const n = Math.floor(900 / cell)
    const discs: Disc[] = []
    for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) discs.push({ x: 40 + a * cell + cell / 2, y: 40 + b * cell + cell / 2, r })
    const img = makeImage(1000, 1000, discs)
    const simple = summarize(segment(img), PX_PER_MM)!
    const { stats } = run(img)
    expect(stats).not.toBeNull()
    expect(Math.abs(stats!.d50 - simple.d50) / simple.d50).toBeLessThan(0.05)
    expect(Math.abs(stats!.d50 - um) / um).toBeLessThan(0.08)
  })

  it('слипшийся комок не считается частицей и даёт предупреждение, остальной замер не искажается', () => {
    const small = grid(15, 15, 40, () => 6).filter(d => d.y > 150)
    const blob: Disc = { x: 300, y: 100, r: 50 }              // диаметр 5 мм — комок
    const { seg, stats } = run(makeImage(SIZE, SIZE, [...small, blob]))
    expect(seg.dropped.clumps).toBeGreaterThan(0)
    expect(seg.clumps.length).toBeGreaterThan(0)
    expect(stats!.flags).toContain('clumps')
    expect(Math.abs(stats!.d50 - 600) / 600).toBeLessThan(0.08)
  })

  it('вытянутая «соринка» (волос, волокно) не считается частицей', () => {
    const img = makeImage(SIZE, SIZE, grid(15, 15, 40, () => 6))
    const px = img.data as Uint8ClampedArray
    for (let x = 100; x < 160; x++) for (let y = 20; y < 24; y++) {   // 60×4 px
      const k = (y * SIZE + x) * 4
      px[k] = px[k + 1] = px[k + 2] = 40
    }
    const { seg } = run(img)
    expect(seg.dropped.shape).toBeGreaterThan(0)
  })
})

describe('автопоиск монеты', () => {
  it('находит серый круг на белой бумаге (центр ±20 px, радиус ±25 %)', () => {
    const W = 800, H = 600
    const coin: Disc = { x: 406, y: 140, r: 96 }
    const img = makeImage(W, H, [coin], 240, 150)
    const c = detectCoinCircle(img)
    expect(Math.hypot(c.cx - coin.x, c.cy - coin.y)).toBeLessThan(20)
    expect(c.r).toBeGreaterThan(coin.r * 0.75)
    expect(c.r).toBeLessThan(coin.r * 1.25)
  })
  it('на пустой бумаге возвращает запасное кольцо в пределах кадра', () => {
    const c = detectCoinCircle(makeImage(800, 600, [], 240, 150))
    expect(c.cx).toBeGreaterThan(0); expect(c.cx).toBeLessThan(800)
    expect(c.cy).toBeGreaterThan(0); expect(c.cy).toBeLessThan(600)
    expect(c.r).toBeGreaterThan(0)
  })
})
