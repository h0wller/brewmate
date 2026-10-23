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
