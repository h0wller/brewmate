import type { GrindSize } from '../grinders/size'
import { SIEVE_REFERENCES } from './target'
import type { SieveBracket } from './target'
import { GRIND_SIZES } from '../grinders/size'
import type { Taste } from './advise'
import type { CurvePoint } from './curve'
import { safeWrite } from '../storageError'

/* Замер помола: только числа. Само фото остаётся на телефоне и нигде не сохраняется. */
export interface GrindCheck {
  id: string
  at: number                 // время, мс
  grinderId?: string
  setting?: number           // настройка на шкале; отсутствует у чисто оптического ситового референса
  size: GrindSize            // под какой уровень крупности целились
  d10: number; d50: number; d90: number   // мкм
  n: number                  // сколько частиц посчитано
  taste?: Taste
  logId?: string             // запись журнала, к которой относится замер (если выбрана)
  createdAt?: number         // для слияния при синхронизации; у старых замеров = at
  updatedAt?: number
  source?: 'photo' | 'sieve'
  sieveBracket?: SieveBracket
  rawD50?: number
  calibrationFactor?: number
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
    if (typeof c.id !== 'string' || !num(c.at) || !num(c.d10) || !num(c.d50) || !num(c.d90) || !num(c.n)) continue
    if (!num(c.setting) && c.source !== 'sieve') continue
    if (c.d50 <= 0 || !GRIND_SIZES.includes(c.size as GrindSize)) continue
    out.push({
      id: c.id, at: c.at, ...(num(c.setting) ? { setting: c.setting } : {}), size: c.size as GrindSize,
      d10: c.d10, d50: c.d50, d90: c.d90, n: c.n,
      grinderId: typeof c.grinderId === 'string' ? c.grinderId : undefined,
      taste: c.taste === 'sour' || c.taste === 'bitter' || c.taste === 'ok' ? c.taste : undefined,
      logId: typeof c.logId === 'string' ? c.logId : undefined,
      createdAt: num(c.createdAt) ? c.createdAt : c.at,
      updatedAt: num(c.updatedAt) ? c.updatedAt : c.at,
      source: c.source === 'photo' || c.source === 'sieve' ? c.source : undefined,
      sieveBracket: typeof c.sieveBracket === 'string' && Object.hasOwn(SIEVE_REFERENCES, c.sieveBracket) ? c.sieveBracket as SieveBracket : undefined,
      rawD50: num(c.rawD50) && c.rawD50 > 0 ? c.rawD50 : undefined,
      calibrationFactor: num(c.calibrationFactor) && c.calibrationFactor >= 0.55 && c.calibrationFactor <= 1.45 ? c.calibrationFactor : undefined,
    })
  }
  return capChecks(out)
}


/** Median of accepted optical correction factors. Prefer this grinder's references; fall back to all grinders. */
export function activeCalibrationFactor(checks: GrindCheck[], grinderId?: string): number {
  const valid = (c: GrindCheck) => c.source === 'sieve'
    && typeof c.calibrationFactor === 'number'
    && Number.isFinite(c.calibrationFactor)
    && c.calibrationFactor >= 0.55 && c.calibrationFactor <= 1.45
  const own = checks.filter(c => valid(c) && (c.grinderId ?? '') === (grinderId ?? ''))
  const selected = own.length ? own : checks.filter(valid)
  if (!selected.length) return 1
  const factors = selected.map(c => c.calibrationFactor!).sort((a, b) => a - b)
  const middle = Math.floor(factors.length / 2)
  return factors.length % 2 ? factors[middle] : (factors[middle - 1] + factors[middle]) / 2
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
    if ((c.grinderId ?? '') !== (grinderId ?? '') || typeof c.setting !== 'number') continue
    const prev = bySetting.get(c.setting)
    if (!prev || prev.at <= c.at) bySetting.set(c.setting, c)
  }
  return [...bySetting.values()].map(c => ({ setting: c.setting!, d50: c.d50 }))
}

/* Фото-рекомендация хранится отдельно от ручной калибровки GrinderProfile. */
export interface PhotoGrindProfile {
  grinderId: string
  size: GrindSize
  setting: number
  measuredSetting: number
  d50: number
  updatedAt: number
  checkId: string
}

export const PHOTO_GRIND_PROFILES_KEY = 'brewmate.photo-grind-profiles.v1'

export function sanitizePhotoProfiles(raw: unknown): PhotoGrindProfile[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((v): v is PhotoGrindProfile => {
    if (!v || typeof v !== 'object') return false
    const p = v as Record<string, unknown>
    return typeof p.grinderId === 'string' && p.grinderId.length > 0
      && GRIND_SIZES.includes(p.size as GrindSize)
      && num(p.setting) && num(p.measuredSetting) && num(p.d50) && p.d50 > 0
      && num(p.updatedAt) && typeof p.checkId === 'string'
  }).slice(-100)
}

export function loadPhotoProfiles(): PhotoGrindProfile[] {
  try { return sanitizePhotoProfiles(JSON.parse(localStorage.getItem(PHOTO_GRIND_PROFILES_KEY) ?? '[]')) }
  catch { return [] }
}

export function savePhotoProfiles(profiles: PhotoGrindProfile[]): void {
  safeWrite(localStorage, PHOTO_GRIND_PROFILES_KEY, sanitizePhotoProfiles(profiles))
}

export function savePhotoProfile(profile: PhotoGrindProfile): void {
  const list = loadPhotoProfiles().filter(p => !(p.grinderId === profile.grinderId && p.size === profile.size))
  savePhotoProfiles([...list, profile].slice(-100))
}

export function photoProfileFor(grinderId: string | undefined, size: GrindSize): PhotoGrindProfile | undefined {
  if (!grinderId) return undefined
  return loadPhotoProfiles().find(p => p.grinderId === grinderId && p.size === size)
}
