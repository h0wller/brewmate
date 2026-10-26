import type { GrindSize } from '../grinders/size'
import { GRIND_SIZES } from '../grinders/size'
import type { Taste } from './advise'
import type { CurvePoint } from './curve'
import { safeWrite } from '../storageError'

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
  logId?: string             // запись журнала, к которой относится замер (если выбрана)
  createdAt?: number         // для слияния при синхронизации; у старых замеров = at
  updatedAt?: number
}

export const GRIND_CHECKS_KEY = 'brewmate.grindchecks.v1'
const KEY = GRIND_CHECKS_KEY
const MAX = 200

/* Оставляем самые свежие MAX замеров, порядок — от старых к новым */
export const capChecks = (list: GrindCheck[]): GrindCheck[] =>
  [...list].sort((a, b) => a.at - b.at).slice(-MAX)

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
      logId: typeof c.logId === 'string' ? c.logId : undefined,
      createdAt: num(c.createdAt) ? c.createdAt : c.at,
      updatedAt: num(c.updatedAt) ? c.updatedAt : c.at,
    })
  }
  return capChecks(out)
}

export const loadChecks = (): GrindCheck[] => {
  try { return sanitizeChecks(JSON.parse(localStorage.getItem(KEY) ?? '[]')) } catch { return [] }
}

export const saveChecks = (list: GrindCheck[]): void => { safeWrite(localStorage, KEY, capChecks(list)) }

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
