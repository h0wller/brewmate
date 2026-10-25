import { describe, expect, it } from 'vitest'
import { equivDiameterUm, otsu, scaleFromPoints, segment, summarize, toGray } from './analyze'
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
