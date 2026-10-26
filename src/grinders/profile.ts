import type { Grind, GrinderProfile } from '../types'
import type { GrindSize } from './size'
import { GRIND_SIZES } from './size'
import { normalizeGrind } from './grind'
import { safeWrite } from '../storageError'
import { allPresetSettings } from './presets'

export const GRINDER_KEY = 'brewmate.grinder.v1'
const KEY = GRINDER_KEY

/* Метка ориентировочной настройки: заводские пресеты не проверены, свои значения метки не имеют */
export const APPROX = '≈'

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

export const saveProfile = (p: GrinderProfile): void => { safeWrite(localStorage, KEY, p) }

/* Настройка пользователя для уровня крупности (если он её указал вручную) */
export const settingFor = (p: GrinderProfile, size: GrindSize): string | undefined =>
  p.calibration[size]

/* Безопасный подбор настройки: числовые factory presets в presets.ts не подтверждены
   источниками и не являются измерениями. Поэтому не выдаём их за рекомендацию рецепта.
   Они доступны отдельно через «Подставить ориентиры»; в рецепте используем ручную калибровку. */
export function smartSettingFor(
  p: GrinderProfile,
  size: GrindSize,
  _coarseness?: number,
): string | undefined {
  const manual = p.calibration[size]
  if (manual) return manual
  return undefined
}

/* Помол для рецепта: уровень + только пользовательская калибровка, если она есть. */
export function grindFor(p: GrinderProfile, size: GrindSize, coarseness?: number): Grind {
  const g: Grind = { size }
  if (p.grinder) g.grinder = p.grinder
  const setting = coarseness !== undefined ? smartSettingFor(p, size, coarseness) : settingFor(p, size)
  if (setting) g.setting = setting
  return g
}

/* Ориентиры для всех уровней («≈ N кл.»): то, что подставляет кнопка «Подставить ориентиры» */
export function factoryCalibration(id: string, redClix?: boolean): GrinderProfile['calibration'] {
  const out: GrinderProfile['calibration'] = {}
  const all = allPresetSettings(id, redClix)
  for (const s of GRIND_SIZES) if (all[s]) out[s] = `${APPROX} ${all[s]}`
  return out
}

/* Есть ли у пользователя хоть одна своя настройка */
export const hasCalibration = (p: GrinderProfile): boolean =>
  GRIND_SIZES.some(s => Boolean(p.calibration[s]))

/* Смена кофемолки: настройки прежней модели к новой не подходят — сбрасываем их и Red Clix.
   Тот же id (например, повторный выбор) профиль не трогает. */
export function withGrinder(p: GrinderProfile, id: string, label: string): GrinderProfile {
  if (p.grinder?.id === id) return { ...p, grinder: { id, label } }
  return { calibration: {}, grinder: { id, label } }
}

/* Red Clix: если шкала была заполнена заводскими значениями, пересчитываем её под новый режим,
   иначе после включения Red Clix остались бы клики вдвое меньше нужных. Свои значения не трогаем. */
export function withRedClix(p: GrinderProfile, next: boolean): GrinderProfile {
  const id = p.grinder?.id
  if (id && hasCalibration(p)) {
    const factory = factoryCalibration(id, p.redClix)
    const isFactory = GRIND_SIZES.every(s => (p.calibration[s] ?? '') === (factory[s] ?? ''))
    if (isFactory) return { ...p, redClix: next, calibration: factoryCalibration(id, next) }
  }
  return { ...p, redClix: next }
}
