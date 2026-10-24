import type { Grind, GrinderProfile } from '../types'
import type { GrindSize } from './size'
import { GRIND_SIZES } from './size'
import { normalizeGrind } from './grind'
import { presetSettingByCoarseness, presetSettingForSize } from './presets'

const KEY = 'brewmate.grinder.v1'

export const emptyProfile = (): GrinderProfile => ({ calibration: {} })

/* Данные из localStorage/файла: берём только то, что похоже на профиль */
export function sanitizeProfile(raw: unknown): GrinderProfile {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const profile = emptyProfile()
  const gr = normalizeGrind({ grinder: r.grinder })?.grinder
  if (gr) profile.grinder = gr
  if (typeof r.redClix === 'boolean') profile.redClix = r.redClix
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

/* Настройка пользователя для уровня крупности (если он её указал вручную) */
export const settingFor = (p: GrinderProfile, size: GrindSize): string | undefined =>
  p.calibration[size]

/* Умный подбор настройки: сначала ручная калибровка пользователя,
   а если её нет — точный расчёт по заводской шкале кофемолки (с учётом дробного coarseness и Red Clix) */
export function smartSettingFor(
  p: GrinderProfile,
  size: GrindSize,
  coarseness?: number,
): string | undefined {
  const manual = p.calibration[size]
  if (manual) return manual
  const gid = p.grinder?.id
  if (coarseness !== undefined) return presetSettingByCoarseness(gid, coarseness, p.redClix)
  return presetSettingForSize(gid, size, p.redClix)
}

/* Помол для рецепта: уровень + настройка пользователя (или авто-пресет кофемолки при переданном coarseness) */
export function grindFor(p: GrinderProfile, size: GrindSize, coarseness?: number): Grind {
  const g: Grind = { size }
  if (p.grinder) g.grinder = p.grinder
  const setting = coarseness !== undefined ? smartSettingFor(p, size, coarseness) : settingFor(p, size)
  if (setting) g.setting = setting
  return g
}

