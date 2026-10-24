import type { BrewStep, WeightSample } from '../types'

const r1 = (x: number) => Math.round(x * 10) / 10

/* Дописать точку в запись пролива; слишком частые отсчёты (< minDt сек) пропускаем.
   Мутирует переданный массив — вызывается из таймера, не из рендера. */
export function recordSample(samples: WeightSample[], t: number, g: number, minDt = 0.5): void {
  const last = samples.at(-1)
  if (last && t - last.t < minDt) return
  samples.push({ t: r1(t), g: r1(g) })
}

/* Равномерно прореживаем до maxPoints, сохраняя первую и последнюю точки */
export function downsample(samples: WeightSample[], maxPoints = 240): WeightSample[] {
  if (samples.length <= maxPoints) return samples.map(s => ({ ...s }))
  const step = (samples.length - 1) / (maxPoints - 1)
  return Array.from({ length: maxPoints }, (_, i) => ({ ...samples[Math.round(i * step)] }))
}

/* Вес в момент t: линейная интерполяция между отсчётами, за краями — крайние значения */
export function weightAt(samples: WeightSample[], t: number): number | undefined {
  if (!samples.length) return undefined
  const first = samples[0]
  const last = samples[samples.length - 1]
  if (t <= first.t) return first.g
  if (t >= last.t) return last.g
  const i = samples.findIndex(s => s.t >= t)
  const a = samples[i - 1]
  const b = samples[i]
  return b.t === a.t ? b.g : a.g + ((b.g - a.g) * (t - a.t)) / (b.t - a.t)
}

/* Скорость вливания, г/с, в момент t: наклон линии по методу наименьших квадратов
   по отсчётам за последние windowS секунд (устойчивее, чем разность двух точек).
   null — данных мало (меньше 2 точек или они покрывают меньше 1 с). */
export function flowRateAt(samples: WeightSample[], t: number, windowS = 3): number | null {
  const pts = samples.filter(s => s.t <= t && s.t >= t - windowS)
  if (pts.length < 2 || pts[pts.length - 1].t - pts[0].t < 1) return null
  const n = pts.length
  const mt = pts.reduce((s, p) => s + p.t, 0) / n
  const mg = pts.reduce((s, p) => s + p.g, 0) / n
  const num = pts.reduce((s, p) => s + (p.t - mt) * (p.g - mg), 0)
  const den = pts.reduce((s, p) => s + (p.t - mt) ** 2, 0)
  return den === 0 ? null : num / den
}

export interface StepStat {
  index: number
  note?: string
  start: number            // с
  end: number              // с
  planG: number            // сколько воды по плану добавить на шаге
  planRate: number         // план, г/с
  actualG: number | null   // сколько реально прибавилось по весам
  actualRate: number | null
}

/* Статистика по шагам рецепта: план и факт (факт — null, если весов не было) */
export function stepStats(curve: WeightSample[], steps: BrewStep[]): StepStat[] {
  let start = 0
  let prevG = 0
  return steps.map((s, index) => {
    const end = start + s.duration
    const planG = s.pourTo - prevG
    const w0 = weightAt(curve, start)
    const w1 = weightAt(curve, end)
    const actualG = w0 === undefined || w1 === undefined ? null : w1 - w0
    const stat: StepStat = {
      index, note: s.note, start, end, planG,
      planRate: s.duration > 0 ? planG / s.duration : 0,
      actualG,
      actualRate: actualG !== null && s.duration > 0 ? actualG / s.duration : null,
    }
    start = end
    prevG = s.pourTo
    return stat
  })
}

/* Итоговый вес — последнее показание; без весов (пустая кривая) — undefined */
export const finalWeight = (samples: WeightSample[]): number | undefined => samples.at(-1)?.g

/* План из рецепта как ломаная: к концу каждого шага вес должен достичь pourTo */
export function planPoints(steps: BrewStep[]): WeightSample[] {
  return steps.reduce<WeightSample[]>(
    (acc, s) => [...acc, { t: (acc.at(-1)?.t ?? 0) + s.duration, g: s.pourTo }],
    [{ t: 0, g: 0 }],
  )
}

/* SVG-путь для ломаной. Вес ниже нуля рисуем на нуле. */
export function chartPath(
  points: WeightSample[], tMax: number, gMax: number, w: number, h: number, pad = 8,
): string {
  if (!points.length || tMax <= 0 || gMax <= 0) return ''
  const x = (t: number) => pad + (Math.min(Math.max(t, 0), tMax) / tMax) * (w - 2 * pad)
  const y = (g: number) => h - pad - (Math.min(Math.max(g, 0), gMax) / gMax) * (h - 2 * pad)
  return points.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)} ${y(p.g).toFixed(1)}`).join(' ')
}

/* Границы осей: по времени и весу берём максимум из факта и плана (+5 % запаса сверху) */
export function chartBounds(curve: WeightSample[], plan: WeightSample[], durationS: number) {
  const tMax = Math.max(durationS, curve.at(-1)?.t ?? 0, plan.at(-1)?.t ?? 0)
  const gRaw = Math.max(0, ...curve.map(p => p.g), ...plan.map(p => p.g))
  return { tMax, gMax: gRaw * 1.05 }
}
