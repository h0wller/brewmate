import type { BrewLog, BrewStep } from '../types'
import type { GrindSize } from '../grinders/size'
import { safeWrite } from '../storageError'

/**
 * An explicitly promoted, repeatable dial-in snapshot. It is not the manual
 * grinder calibration and is never silently applied to another bean/roast.
 */
export interface DialInProfile {
  id: string
  grinderId: string
  method: string
  beanId?: string
  beanName?: string
  roastDate?: string
  sourceLogId: string
  doseG: number
  waterG: number
  tempC: number
  grindSize?: GrindSize
  grinderSetting?: string
  steps: BrewStep[]
  positiveTrials: number
  totalTrials: number
  savedAt: number
}

export const DIAL_IN_PROFILES_KEY = 'brewmate.dial-in-profiles.v1'

export function sanitizeDialInProfiles(raw: unknown): DialInProfile[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((v): v is DialInProfile => {
    if (!v || typeof v !== 'object') return false
    const p = v as Record<string, unknown>
    return typeof p.id === 'string' && typeof p.grinderId === 'string' && p.grinderId.length > 0
      && typeof p.method === 'string' && p.method.length > 0
      && (p.grindSize === undefined || ['extra_fine', 'fine', 'medium_fine', 'medium', 'medium_coarse', 'coarse', 'extra_coarse'].includes(String(p.grindSize)))
      && typeof p.sourceLogId === 'string'
      && typeof p.doseG === 'number' && Number.isFinite(p.doseG) && p.doseG > 0
      && typeof p.waterG === 'number' && Number.isFinite(p.waterG) && p.waterG > 0
      && typeof p.tempC === 'number' && Number.isFinite(p.tempC)
      && typeof p.positiveTrials === 'number' && Number.isFinite(p.positiveTrials)
      && typeof p.totalTrials === 'number' && Number.isFinite(p.totalTrials)
      && Array.isArray(p.steps) && p.steps.every(step => step && typeof step.duration === 'number' && Number.isFinite(step.duration) && typeof step.pourTo === 'number' && Number.isFinite(step.pourTo))
      && typeof p.savedAt === 'number' && Number.isFinite(p.savedAt)
  }).slice(-100)
}

export function upsertDialInProfile(list: DialInProfile[], profile: DialInProfile): DialInProfile[] {
  // Keep separate snapshots for different beans/roast dates on the same grinder and brewer.
  return [...list.filter(p => !(p.grinderId === profile.grinderId && p.method === profile.method && p.beanId === profile.beanId && p.roastDate === profile.roastDate)), profile].slice(-100)
}

export function profileFromConfirmedLog(
  log: BrewLog,
  assessment: { status: string; positive: number; trials: number },
  now = Date.now(),
): DialInProfile | undefined {
  const grinderId = log.grind?.grinder?.id
  if (assessment.status !== 'confirmed' || !grinderId || !log.trial) return undefined
  if (!log.beanId || !log.beanRoastDate || !log.rating || log.taste !== 'balanced') return undefined
  return {
    id: `${grinderId}:${log.method}:${log.id}`,
    grinderId,
    method: log.method,
    beanId: log.beanId,
    beanName: log.beanName,
    roastDate: log.beanRoastDate,
    sourceLogId: log.id,
    doseG: log.doseG,
    waterG: log.waterG,
    tempC: log.tempC,
    grindSize: log.grind?.size,
    grinderSetting: log.grind?.setting,
    steps: log.steps.map(step => ({ ...step })),
    positiveTrials: assessment.positive,
    totalTrials: assessment.trials,
    savedAt: now,
  }
}

export function loadDialInProfiles(): DialInProfile[] {
  try {
    return sanitizeDialInProfiles(JSON.parse(localStorage.getItem(DIAL_IN_PROFILES_KEY) ?? '[]'))
  } catch {
    return []
  }
}

export function saveDialInProfile(profile: DialInProfile): void {
  const next = upsertDialInProfile(loadDialInProfiles(), profile)
  safeWrite(localStorage, DIAL_IN_PROFILES_KEY, next)
}

export function findDialInProfile(
  list: DialInProfile[],
  grinderId: string | undefined,
  method: string,
  options: { matchBean?: boolean; beanId?: string; matchRoastDate?: boolean; roastDate?: string } = {},
): DialInProfile | undefined {
  if (!grinderId) return undefined
  const { matchBean = false, beanId, matchRoastDate = false, roastDate } = options
  return list.find(p =>
    p.grinderId === grinderId &&
    p.method === method &&
    (!matchBean || p.beanId === beanId) &&
    (!matchRoastDate || p.roastDate === roastDate),
  )
}
