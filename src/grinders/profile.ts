import type { Grind, GrinderProfile } from '../types'
import type { GrindSize } from './size'
import { GRIND_SIZES } from './size'
import { normalizeGrind } from './grind'

const KEY = 'brewmate.grinder.v1'

export const emptyProfile = (): GrinderProfile => ({ calibration: {} })

/* Данные из localStorage/файла: берём только то, что похоже на профиль */
export function sanitizeProfile(raw: unknown): GrinderProfile {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const profile = emptyProfile()
  const gr = normalizeGrind({ grinder: r.grinder })?.grinder
  if (gr) profile.grinder = gr
  const cal = (r.calibration && typeof r.calibration === 'object' ? r.calibration : {}) as Record<string, unknown>
  for (const size of GRIND_SIZES) {
    const v = cal[size]
    if (typeof v === 'string' && v.trim()) profile.calibration[size] = v.trim().slice(0, 80)
  }
  return profile
}

export const loadProfile = (): GrinderProfile => {
  try { return sanitizeProfile(JSON.parse(localStorage.getItem(KEY) ?? 'null')) }
  catch { return emptyProfile() }
}

export const saveProfile = (p: GrinderProfile): void => {
  try { localStorage.setItem(KEY, JSON.stringify(p)) }
  catch (e) { console.warn('profile: не удалось сохранить', e) }
}

/* Настройка пользователя для уровня крупности (если он её указал) */
export const settingFor = (p: GrinderProfile, size: GrindSize): string | undefined =>
  p.calibration[size]

/* Помол для рецепта: уровень + настройка пользователя на этой кофемолке */
export function grindFor(p: GrinderProfile, size: GrindSize): Grind {
  const g: Grind = { size }
  if (p.grinder) g.grinder = p.grinder
  const setting = settingFor(p, size)
  if (setting) g.setting = setting
  return g
}
