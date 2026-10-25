/* Измерение помола по фото: чистые функции над пикселями (без DOM), поэтому проверяются тестами.
   Фото — тёмные частицы на светлом фоне (белая бумага). Масштаб даёт монета известного диаметра,
   края которой пользователь отмечает на снимке. Результат — размеры в микронах и предупреждения о качестве.
   Это оценка для сравнений «до/после» на одной кофемолке, а не замер лазерным анализатором. */

export interface Img { data: ArrayLike<number>; width: number; height: number } // RGBA, как ImageData

export interface Particle {
  area: number            // px²
  cx: number; cy: number  // центр, px
  w: number; h: number    // габариты, px
}

export interface Segmentation {
  particles: Particle[]   // без краевых и без отмеченных монет
  threshold: number
  coverage: number        // доля тёмных пикселей кадра
  dropped: { border: number; tiny: number; excluded: number }
}

export type QualityFlag = 'few_particles' | 'too_dense' | 'low_resolution' | 'clumps'

export interface GrindStats {
  n: number
  d10: number; d50: number; d90: number   // мкм, по объёму (d³), как у лазерных анализаторов
  d50n: number                            // мкм, по числу частиц
  span: number                            // (d90 − d10) / d50: чем меньше, тем равномернее
  limitUm: number                         // мельче этого размера частицы на снимке не видны
  coverage: number
  flags: QualityFlag[]
}

export interface Circle { cx: number; cy: number; r: number }

/* ---------- масштаб ---------- */

export const COINS = [
  { id: 'rub1', label: '1 ₽', mm: 20.5 },
  { id: 'rub2', label: '2 ₽', mm: 23 },
  { id: 'rub5', label: '5 ₽', mm: 25 },
  { id: 'rub10', label: '10 ₽', mm: 22 },
  { id: 'eur1', label: '1 €', mm: 23.25 },
  { id: 'eur2', label: '2 €', mm: 25.75 },
  { id: 'usd25', label: '25 ¢ (США)', mm: 24.26 },
] as const

/* Пикселей на миллиметр по двум точкам на противоположных краях монеты */
export function scaleFromPoints(
  a: { x: number; y: number }, b: { x: number; y: number }, diameterMm: number,
): number | null {
  const px = Math.hypot(a.x - b.x, a.y - b.y)
  return px > 0 && diameterMm > 0 ? px / diameterMm : null
}

/* ---------- сегментация ---------- */

export function toGray(img: Img): Uint8Array {
  const { data, width, height } = img
  const g = new Uint8Array(width * height)
  for (let i = 0, j = 0; i < g.length; i++, j += 4) {
    g[i] = (data[j] * 77 + data[j + 1] * 150 + data[j + 2] * 29) >> 8
  }
  return g
}

/* Порог Оцу: максимизирует разницу между классами «тёмное» и «светлое» */
export function otsu(gray: Uint8Array): number {
  const hist = new Array<number>(256).fill(0)
  for (let i = 0; i < gray.length; i++) hist[gray[i]]++
  const total = gray.length
  let sum = 0
  for (let t = 0; t < 256; t++) sum += t * hist[t]
  let wB = 0, sumB = 0, best = -1, thr = 128
  for (let t = 0; t < 256; t++) {
    wB += hist[t]
    if (!wB) continue
    const wF = total - wB
    if (!wF) break
    sumB += t * hist[t]
    const mB = sumB / wB, mF = (sum - sumB) / wF
    const between = wB * wF * (mB - mF) * (mB - mF)
    if (between > best) { best = between; thr = t }
  }
  return thr
}

export interface SegmentOptions {
  exclude?: Circle[]    // монета и прочее, что не частицы
  minArea?: number      // px², меньше — шум
  threshold?: number    // вручную; иначе Оцу
}

export function segment(img: Img, opts: SegmentOptions = {}): Segmentation {
  const { width: W, height: H } = img
  const gray = toGray(img)
  const threshold = opts.threshold ?? otsu(gray)
  const minArea = opts.minArea ?? 6
  const mask = new Uint8Array(W * H)
  let dark = 0
  for (let i = 0; i < mask.length; i++) if (gray[i] <= threshold) { mask[i] = 1; dark++ }

  const particles: Particle[] = []
  const dropped = { border: 0, tiny: 0, excluded: 0 }
  const stack = new Int32Array(W * H)
  for (let start = 0; start < mask.length; start++) {
    if (mask[start] !== 1) continue
    let sp = 0
    stack[sp++] = start
    mask[start] = 2
    let area = 0, sx = 0, sy = 0, minX = W, maxX = 0, minY = H, maxY = 0
    while (sp) {
      const p = stack[--sp]
      const x = p % W, y = (p - x) / W
      area++; sx += x; sy += y
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
      if (x > 0 && mask[p - 1] === 1) { mask[p - 1] = 2; stack[sp++] = p - 1 }
      if (x < W - 1 && mask[p + 1] === 1) { mask[p + 1] = 2; stack[sp++] = p + 1 }
      if (y > 0 && mask[p - W] === 1) { mask[p - W] = 2; stack[sp++] = p - W }
      if (y < H - 1 && mask[p + W] === 1) { mask[p + W] = 2; stack[sp++] = p + W }
    }
    const cx = sx / area, cy = sy / area
    if (opts.exclude?.some(c => Math.hypot(cx - c.cx, cy - c.cy) <= c.r * 1.1)) { dropped.excluded++; continue }
    if (area < minArea) { dropped.tiny++; continue }
    if (minX === 0 || minY === 0 || maxX === W - 1 || maxY === H - 1) { dropped.border++; continue }
    particles.push({ area, cx, cy, w: maxX - minX + 1, h: maxY - minY + 1 })
  }
  return { particles, threshold, coverage: dark / mask.length, dropped }
}

/* ---------- статистика ---------- */

const quantile = (sortedD: number[], cumW: number[], q: number): number => {
  const target = cumW[cumW.length - 1] * q
  let lo = 0, hi = cumW.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (cumW[mid] >= target) hi = mid; else lo = mid + 1
  }
  return sortedD[lo]
}

/* Диаметр круга той же площади, мкм */
export const equivDiameterUm = (areaPx: number, pxPerMm: number): number =>
  (2 * Math.sqrt(areaPx / Math.PI) / pxPerMm) * 1000

export const MIN_PARTICLES = 150

export function summarize(seg: Segmentation, pxPerMm: number): GrindStats | null {
  const ds = seg.particles.map(p => equivDiameterUm(p.area, pxPerMm)).sort((a, b) => a - b)
  if (!ds.length || !(pxPerMm > 0)) return null
  const cum: number[] = []
  let acc = 0
  for (const d of ds) { acc += d * d * d; cum.push(acc) }
  const d10 = quantile(ds, cum, 0.1), d50 = quantile(ds, cum, 0.5), d90 = quantile(ds, cum, 0.9)
  const d50n = ds[Math.floor(ds.length / 2)]
  const limitUm = (4 / pxPerMm) * 1000   // меньше ~4 px поперёк не отличить от шума

  const flags: QualityFlag[] = []
  if (ds.length < MIN_PARTICLES) flags.push('few_particles')
  if (seg.coverage > 0.3) flags.push('too_dense')
  if (limitUm > 0.5 * d50) flags.push('low_resolution')
  const medArea = [...seg.particles].map(p => p.area).sort((a, b) => a - b)[Math.floor(seg.particles.length / 2)]
  let clumpVol = 0, totalVol = 0
  for (const p of seg.particles) {
    const v = Math.pow(p.area, 1.5)
    totalVol += v
    if (p.area > 8 * medArea) clumpVol += v
  }
  if (totalVol > 0 && clumpVol / totalVol > 0.12) flags.push('clumps')

  return {
    n: ds.length, d10, d50, d90, d50n,
    span: d50 > 0 ? (d90 - d10) / d50 : 0,
    limitUm, coverage: seg.coverage, flags,
  }
}

export const FLAG_TEXT: Record<QualityFlag, string> = {
  few_particles: 'Мало частиц в кадре: рассыпь побольше помола или сними шире.',
  too_dense: 'Частицы лежат слишком густо и слипаются: рассыпь тонким слоем на белой бумаге.',
  low_resolution: 'Снимок слишком далёкий — мелочь не видна: сними ближе (монета должна занимать заметную часть кадра).',
  clumps: 'Похоже на комки: разровняй помол кисточкой или постучи по листу и сфоткай заново.',
}
