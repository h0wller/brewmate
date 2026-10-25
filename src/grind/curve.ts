/* Личная кривая кофемолки: «настройка → размер частиц». Строится по замерам самого пользователя
   (две и более разные настройки), поэтому не зависит ни от чужих таблиц, ни от износа жерновов других людей.
   Модель: ln(D50) = a + b · настройка (у ручных кофемолок размер растёт примерно по такому закону на небольшом участке шкалы). */

export interface CurvePoint { setting: number; d50: number }

export interface Curve {
  a: number
  b: number
  r2: number        // 1 — точки лежат на прямой
  n: number         // замеров
  min: number       // диапазон настроек, по которому строили
  max: number
}

export function fitCurve(points: CurvePoint[]): Curve | null {
  const pts = points.filter(p => Number.isFinite(p.setting) && p.d50 > 0)
  if (new Set(pts.map(p => p.setting)).size < 2) return null
  const n = pts.length
  const xs = pts.map(p => p.setting), ys = pts.map(p => Math.log(p.d50))
  const mx = xs.reduce((s, v) => s + v, 0) / n, my = ys.reduce((s, v) => s + v, 0) / n
  let sxx = 0, sxy = 0, syy = 0
  for (let i = 0; i < n; i++) { sxx += (xs[i] - mx) ** 2; sxy += (xs[i] - mx) * (ys[i] - my); syy += (ys[i] - my) ** 2 }
  if (sxx === 0) return null
  const b = sxy / sxx
  if (b === 0) return null
  const a = my - b * mx
  const r2 = syy === 0 ? 1 : (sxy * sxy) / (sxx * syy)
  return { a, b, r2, n, min: Math.min(...xs), max: Math.max(...xs) }
}

export const predictUm = (c: Curve, setting: number): number => Math.exp(c.a + c.b * setting)

/* Настройка, дающая нужный размер, и честная оценка надёжности */
export function settingFor(c: Curve, targetUm: number): { setting: number; extrapolated: boolean; reliable: boolean } {
  const setting = (Math.log(targetUm) - c.a) / c.b
  const span = Math.max(c.max - c.min, 1e-9)
  const extrapolated = setting < c.min - 0.25 * span || setting > c.max + 0.25 * span
  return { setting, extrapolated, reliable: c.n >= 3 && c.r2 >= 0.8 && !extrapolated }
}
