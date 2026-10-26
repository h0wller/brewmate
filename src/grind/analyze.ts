/* Измерение помола по фото: чистые функции над пикселями (без DOM), поэтому проверяются тестами.
   Фото — тёмные частицы на светлом фоне (белая бумага). Масштаб даёт монета известного диаметра.
   Что делает код:
   1. при заданном maxArea: находит светлый лист (ROI), бинаризует локальным порогом (интегральное изображение)
      вместе с глобальным (Оцу), иначе — только глобальный порог Оцу;
   2. связные компоненты → площадь, периметр, круглость, габариты;
   3. слишком крупные, вытянутые, пустотелые или слишком синие компоненты не считаются частицами
      (комки идут в `clumps` и рисуются на снимке, не входят в статистику);
   4. диаметр = круг той же площади; D10/D50/D90 — по объёму (d³).
   Пороги формы и цвета — эвристики, не откалиброваны по ситовому анализу или лазерному анализатору.
   Это оценка для сравнений «до/после» на одной кофемолке, а не лабораторное измерение.
   Результат НЕ зависит от ожидаемой настройки кофемолки: замер всегда сырой. */

export interface Img { data: ArrayLike<number>; width: number; height: number } // RGBA, как ImageData

export interface Particle {
  area: number            // px²
  perimeter: number       // px (длина границы)
  circularity: number     // 4π·area / perimeter² (0..1, у круга = 1, у комков < 0.42)
  cx: number; cy: number  // центр, px
  w: number; h: number    // габариты, px
}

export interface Segmentation {
  particles: Particle[]   // верифицированные одиночные крупинки
  clumps: Particle[]      // отсечённые агломераты (комки и куча)
  threshold: number
  coverage: number        // доля тёмных пикселей внутри листа
  dropped: { border: number; tiny: number; excluded: number; clumps: number; shape: number }
}

export type QualityFlag = 'few_particles' | 'too_dense' | 'low_resolution' | 'clumps'

export interface GrindStats {
  n: number
  d10: number; d50: number; d90: number   // мкм, по объёму (d³)
  d50n: number                            // мкм, по числу частиц
  span: number                            // (d90 − d10) / d50
  limitUm: number                         // предел разрешения камеры, мкм
  coverage: number
  flags: QualityFlag[]
}

export interface Circle { cx: number; cy: number; r: number }

export const COINS = [
  { id: 'rub1', label: '1 ₽', mm: 20.5 },
  { id: 'rub2', label: '2 ₽', mm: 23 },
  { id: 'rub5', label: '5 ₽', mm: 25 },
  { id: 'rub10', label: '10 ₽', mm: 22 },
  { id: 'eur1', label: '1 €', mm: 23.25 },
  { id: 'eur2', label: '2 €', mm: 25.75 },
  { id: 'usd25', label: '25 ¢ (США)', mm: 24.26 },
] as const

export function scaleFromPoints(
  a: { x: number; y: number }, b: { x: number; y: number }, diameterMm: number,
): number | null {
  const px = Math.hypot(a.x - b.x, a.y - b.y)
  return px > 0 && diameterMm > 0 ? px / diameterMm : null
}

export function detectCoinCircle(img: Img): Circle {
  const { width: W, height: H } = img
  const gray = toGray(img)
  const rDefault = Math.round(Math.min(W, H) * 0.16)
  let bestX = Math.round(W * 0.5)
  let bestY = Math.round(H * 0.22)
  let bestR = rDefault
  let bestScore = -1

  const step = Math.max(4, Math.round(Math.min(W, H) / 60))
  const rMin = Math.round(Math.min(W, H) * 0.10)
  const rMax = Math.round(Math.min(W, H) * 0.28)
  const rStep = Math.max(4, Math.round((rMax - rMin) / 6))

  for (let r = rMin; r <= rMax; r += rStep) {
    for (let y = Math.round(r * 0.8); y <= H - r - step; y += step * 2) {
      for (let x = r + step; x <= W - r - step; x += step * 2) {
        let edgeSum = 0, inSum = 0, outSum = 0
        const dirs = 16
        for (let k = 0; k < dirs; k++) {
          const ang = (k * 2 * Math.PI) / dirs
          const cos = Math.cos(ang), sin = Math.sin(ang)
          const xi = Math.max(0, Math.min(W - 1, Math.round(x + cos * (r * 0.82))))
          const yi = Math.max(0, Math.min(H - 1, Math.round(y + sin * (r * 0.82))))
          const xo = Math.max(0, Math.min(W - 1, Math.round(x + cos * (r * 1.15))))
          const yo = Math.max(0, Math.min(H - 1, Math.round(y + sin * (r * 1.15))))
          const gi = gray[yi * W + xi], go = gray[yo * W + xo]
          inSum += gi; outSum += go
          if (go - gi > 12) edgeSum += (go - gi)
        }
        const meanOut = outSum / dirs, meanIn = inSum / dirs
        if (meanOut > 140 && meanOut - meanIn > 18 && meanIn > 45) {
          const score = edgeSum - Math.abs(y - H * 0.22) * 0.08
          if (score > bestScore) { bestScore = score; bestX = x; bestY = y; bestR = r }
        }
      }
    }
  }
  return { cx: bestX, cy: bestY, r: bestR }
}

export function toGray(img: Img): Uint8Array {
  const { data, width, height } = img
  const g = new Uint8Array(width * height)
  for (let i = 0, j = 0; i < g.length; i++, j += 4) {
    g[i] = (data[j] * 77 + data[j + 1] * 150 + data[j + 2] * 29) >> 8
  }
  return g
}

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

function buildIntegral(gray: Uint8Array, W: number, H: number): Int32Array {
  const sat = new Int32Array((W + 1) * (H + 1))
  for (let y = 1; y <= H; y++) {
    let rowSum = 0
    const srcOff = (y - 1) * W, dstOff = y * (W + 1), prevOff = (y - 1) * (W + 1)
    for (let x = 1; x <= W; x++) {
      rowSum += gray[srcOff + x - 1]
      sat[dstOff + x] = sat[prevOff + x] + rowSum
    }
  }
  return sat
}

function boxMean(sat: Int32Array, W: number, H: number, x: number, y: number, r: number): number {
  const x0 = Math.max(0, x - r), y0 = Math.max(0, y - r)
  const x1 = Math.min(W, x + r + 1), y1 = Math.min(H, y + r + 1)
  const stride = W + 1
  const sum = sat[y1 * stride + x1] - sat[y0 * stride + x1] - sat[y1 * stride + x0] + sat[y0 * stride + x0]
  return sum / ((x1 - x0) * (y1 - y0))
}

function findPaperROI(gray: Uint8Array, W: number, H: number): { xMin: number; xMax: number; yMin: number; yMax: number } {
  const colBright = new Uint8Array(W)
  const stepY = Math.max(1, Math.floor(H / 64))
  const samples: number[] = []
  for (let x = 0; x < W; x++) {
    samples.length = 0
    for (let y = 0; y < H; y += stepY) samples.push(gray[y * W + x])
    samples.sort((a, b) => a - b)
    colBright[x] = samples[Math.floor(samples.length * 0.8)]
  }
  const peak = Math.max(...colBright)
  const paperCut = Math.max(135, peak * 0.78)

  let cx = Math.floor(W / 2)
  if (colBright[cx] < paperCut) {
    const bestIdx = colBright.findIndex(v => v >= paperCut)
    if (bestIdx >= 0) cx = bestIdx
  }
  let xMin = cx, xMax = cx
  while (xMin > 0 && colBright[xMin - 1] >= paperCut) xMin--
  while (xMax < W - 1 && colBright[xMax + 1] >= paperCut) xMax++

  const padX = Math.round((xMax - xMin) * 0.035)
  const padY = Math.round(H * 0.02)
  if (xMax - xMin > W * 0.35) {
    return { xMin: xMin + padX, xMax: xMax - padX, yMin: padY, yMax: H - 1 - padY }
  }
  return { xMin: padX, xMax: W - 1 - padX, yMin: padY, yMax: H - 1 - padY }
}

export interface SegmentOptions {
  exclude?: Circle[]
  minArea?: number
  maxArea?: number
  threshold?: number
}

export function segment(img: Img, opts: SegmentOptions = {}): Segmentation {
  const { width: W, height: H, data } = img
  const gray = toGray(img)
  const globalThr = opts.threshold ?? otsu(gray)
  const minArea = opts.minArea ?? 6
  const maxArea = opts.maxArea ?? Infinity

  const useAdaptive = opts.maxArea !== undefined
  const winR = Math.max(14, Math.round(Math.min(W, H) * 0.035))
  const sat = useAdaptive ? buildIntegral(gray, W, H) : null
  const roi = useAdaptive && opts.threshold === undefined
    ? findPaperROI(gray, W, H)
    : { xMin: 0, xMax: W - 1, yMin: 0, yMax: H - 1 }

  const mask = new Uint8Array(W * H)
  let dark = 0
  let paperPixels = 0

  for (let y = roi.yMin; y <= roi.yMax; y++) {
    for (let x = roi.xMin; x <= roi.xMax; x++) {
      const i = y * W + x
      if (sat) {
        const localMean = boxMean(sat, W, H, x, y, winR)
        if (localMean < 128 && opts.threshold === undefined) continue
        paperPixels++
        const isDarkLocal = gray[i] < localMean - 28
        const isDarkGlobal = gray[i] <= Math.min(globalThr + 5, 165)
        if (opts.threshold !== undefined ? gray[i] <= opts.threshold : (isDarkLocal && isDarkGlobal)) {
          mask[i] = 1
          dark++
        }
      } else if (gray[i] <= globalThr) {
        mask[i] = 1
        dark++
      }
    }
  }

  const particles: Particle[] = []
  const clumps: Particle[] = []
  const dropped = { border: 0, tiny: 0, excluded: 0, clumps: 0, shape: 0 }
  const stack = new Int32Array(W * H)

  for (let start = 0; start < mask.length; start++) {
    if (mask[start] !== 1) continue
    let sp = 0
    stack[sp++] = start
    mask[start] = 2
    let area = 0, perimeter = 0, sx = 0, sy = 0, minX = W, maxX = 0, minY = H, maxY = 0
    let sumR = 0, sumB = 0
    while (sp) {
      const p = stack[--sp]
      const x = p % W, y = (p - x) / W
      area++; sx += x; sy += y
      const rgbaIdx = p * 4
      sumR += data[rgbaIdx]
      sumB += data[rgbaIdx + 2]
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y

      let boundaryEdges = 0
      if (x > 0) {
        if (mask[p - 1] === 1) { mask[p - 1] = 2; stack[sp++] = p - 1 }
        else if (mask[p - 1] === 0) boundaryEdges++
      } else boundaryEdges++
      if (x < W - 1) {
        if (mask[p + 1] === 1) { mask[p + 1] = 2; stack[sp++] = p + 1 }
        else if (mask[p + 1] === 0) boundaryEdges++
      } else boundaryEdges++
      if (y > 0) {
        if (mask[p - W] === 1) { mask[p - W] = 2; stack[sp++] = p - W }
        else if (mask[p - W] === 0) boundaryEdges++
      } else boundaryEdges++
      if (y < H - 1) {
        if (mask[p + W] === 1) { mask[p + W] = 2; stack[sp++] = p + W }
        else if (mask[p + W] === 0) boundaryEdges++
      } else boundaryEdges++
      perimeter += boundaryEdges
    }

    const cx = sx / area, cy = sy / area
    const w = maxX - minX + 1, h = maxY - minY + 1

    if (opts.exclude?.some(c => Math.hypot(cx - c.cx, cy - c.cy) <= c.r * 1.18)) {
      dropped.excluded++; continue
    }
    if (area < minArea) { dropped.tiny++; continue }
    if (minX <= roi.xMin || minY <= roi.yMin || maxX >= roi.xMax || maxY >= roi.yMax) {
      dropped.border++; continue
    }

    const perimCorrected = Math.max(1, perimeter * 0.88)
    const circularity = Math.min(1, (4 * Math.PI * area) / (perimCorrected * perimCorrected))

    if (useAdaptive) {
      const aspect = Math.max(w, h) / Math.max(1, Math.min(w, h))
      const boxFill = area / (w * h)
      const isCold = sumB > sumR + area * 8
      /* Горка: обе стороны больше предельного диаметра одиночной крупинки. Локальный порог «выедает» середину
         тёмной горки, и она выглядит пустотелой (boxFill мал), поэтому проверяем её раньше формы:
         горка должна попасть в комки (жёлтый контур, предупреждение), а не пропасть молча. */
      const maxSide = 2 * Math.sqrt(maxArea / Math.PI)
      if (w > maxSide && h > maxSide) {
        dropped.clumps++
        clumps.push({ area: Math.max(area, Math.round(Math.PI * (Math.min(w, h) / 2) ** 2)), perimeter, circularity, cx, cy, w, h })
        continue
      }
      if (aspect > 2.8 || boxFill < 0.28 || isCold) {
        dropped.shape++; continue
      }
      if (area > maxArea || (area > minArea * 5 && circularity < 0.42)) {
        dropped.clumps++
        clumps.push({ area, perimeter, circularity, cx, cy, w, h })
        continue
      }
    } else if (area > maxArea) {
      dropped.clumps++
      clumps.push({ area, perimeter, circularity, cx, cy, w, h })
      continue
    }

    particles.push({ area, perimeter, circularity, cx, cy, w, h })
  }

  const denom = Math.max(1, paperPixels || mask.length)
  return { particles, clumps, threshold: globalThr, coverage: dark / denom, dropped }
}

const quantile = (sortedD: number[], cumW: number[], q: number): number => {
  const target = cumW[cumW.length - 1] * q
  let lo = 0, hi = cumW.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (cumW[mid] >= target) hi = mid; else lo = mid + 1
  }
  return sortedD[lo]
}

export const equivDiameterUm = (areaPx: number, pxPerMm: number): number =>
  (2 * Math.sqrt(areaPx / Math.PI) / pxPerMm) * 1000

export const MIN_PARTICLES = 150

/* Границы одиночной крупинки: мельче 95 мкм не отличить от шума и пыли, крупнее 2,5 мм одиночной крупинки кофе не бывает
   (значит, это слипшийся комок). Не зависят от настройки кофемолки и ожиданий. */
export const MIN_SINGLE_UM = 95
export const MAX_SINGLE_UM = 2500

export function particleAreaLimits(pxPerMm: number): { minArea: number; maxArea: number } {
  const area = (um: number) => { const r = (um / 1000) * pxPerMm / 2; return Math.round(Math.PI * r * r) }
  return { minArea: Math.max(4, area(MIN_SINGLE_UM)), maxArea: Math.max(25, area(MAX_SINGLE_UM)) }
}

export function summarize(seg: Segmentation, pxPerMm: number): GrindStats | null {
  if (!(pxPerMm > 0)) return null
  const limitUm = (4 / pxPerMm) * 1000   // меньше ~4 px поперёк не отличить от шума
  const ds = seg.particles.map(p => equivDiameterUm(p.area, pxPerMm)).sort((a, b) => a - b)
  if (!ds.length) return null

  const cum: number[] = []
  let acc = 0
  for (const d of ds) { acc += d * d * d; cum.push(acc) }
  const d10 = quantile(ds, cum, 0.1), d50 = quantile(ds, cum, 0.5), d90 = quantile(ds, cum, 0.9)
  const d50n = ds[Math.floor(ds.length / 2)]

  const flags: QualityFlag[] = []
  if (ds.length < MIN_PARTICLES) flags.push('few_particles')
  if (seg.coverage > 0.3) flags.push('too_dense')
  if (limitUm > 0.5 * d50) flags.push('low_resolution')

  const medArea = [...seg.particles].map(p => p.area).sort((a, b) => a - b)[Math.floor(seg.particles.length / 2)] ?? 1
  let clumpVol = 0, totalVol = 0
  for (const p of seg.particles) {
    const v = Math.pow(p.area, 1.5)
    totalVol += v
    if (p.area > 8 * medArea) clumpVol += v
  }
  if (seg.dropped.clumps > 0 || (totalVol > 0 && clumpVol / totalVol > 0.12)) {
    flags.push('clumps')
  }

  return {
    n: ds.length, d10, d50, d90, d50n,
    span: d50 > 0 ? (d90 - d10) / d50 : 0,
    limitUm, coverage: seg.coverage, flags,
  }
}

export const FLAG_TEXT: Record<QualityFlag, string> = {
  few_particles: 'Мало отдельных крупинок в кадре: рассыпь щепотку помола свободнее.',
  too_dense: 'Частицы лежат слишком густо и слипаются: рассыпь тонким слоем на белой бумаге.',
  low_resolution: 'Снимок слишком далёкий — мелочь не видна: сними ближе (монета должна занимать заметную часть кадра).',
  clumps: 'На фото есть слипшиеся комки (обведены жёлтым) — они исключены из расчёта размера.',
}
