import type { GrindSize } from '../grinders/size'
import { GRIND_SIZES } from '../grinders/size'
import type { Taste } from './advise'
import type { CurvePoint } from './curve'

/* Замер помола: только числа. Само фото остаётся на телефоне и нигде не сохраняется. */
export interface GrindCheck {
  id: string
  at: number                 // время, мс
  grinderId?: string
  setting: number            // настройка на шкале кофемолки
  size: GrindSize            // под какой уровень крупности целились
  d10: number; d50: number; d90: number   // мкм
  n: number                  // сколько частиц посчитано
  taste?: Taste
}

const KEY = 'brewmate.grindchecks.v1'
const MAX = 200

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

export function sanitizeChecks(raw: unknown): GrindCheck[] {
  if (!Array.isArray(raw)) return []
  const out: GrindCheck[] = []
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue
    const c = r as Record<string, unknown>
    if (typeof c.id !== 'string' || !num(c.at) || !num(c.setting) || !num(c.d10) || !num(c.d50) || !num(c.d90) || !num(c.n)) continue
    if (c.d50 <= 0 || !GRIND_SIZES.includes(c.size as GrindSize)) continue
    out.push({
      id: c.id, at: c.at, setting: c.setting, size: c.size as GrindSize,
      d10: c.d10, d50: c.d50, d90: c.d90, n: c.n,
      grinderId: typeof c.grinderId === 'string' ? c.grinderId : undefined,
      taste: c.taste === 'sour' || c.taste === 'bitter' || c.taste === 'ok' ? c.taste : undefined,
    })
  }
  return out.slice(-MAX)
}

export const loadChecks = (): GrindCheck[] => {
  try { return sanitizeChecks(JSON.parse(localStorage.getItem(KEY) ?? '[]')) } catch { return [] }
}

export const saveChecks = (list: GrindCheck[]): void => {
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(-MAX))) }
  catch (e) { console.warn('grind: не удалось сохранить замеры', e) }
}

/* Точки кривой: только замеры этой кофемолки; по одной настройке берём самый свежий замер,
   чтобы старые снимки (другие жернова/износ) не тянули кривую */
export function curvePoints(list: GrindCheck[], grinderId?: string): CurvePoint[] {
  const bySetting = new Map<number, GrindCheck>()
  for (const c of list) {
    if ((c.grinderId ?? '') !== (grinderId ?? '')) continue
    const prev = bySetting.get(c.setting)
    if (!prev || prev.at <= c.at) bySetting.set(c.setting, c)
  }
  return [...bySetting.values()].map(c => ({ setting: c.setting, d50: c.d50 }))
}
