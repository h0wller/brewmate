import type { BrewLog } from '../types'

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
  grindSize?: string
  grinderSetting?: string
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
      && typeof p.sourceLogId === 'string'
      && typeof p.doseG === 'number' && Number.isFinite(p.doseG) && p.doseG > 0
      && typeof p.waterG === 'number' && Number.isFinite(p.waterG) && p.waterG > 0
      && typeof p.tempC === 'number' && Number.isFinite(p.tempC)
      && typeof p.positiveTrials === 'number' && Number.isFinite(p.positiveTrials)
      && typeof p.totalTrials === 'number' && Number.isFinite(p.totalTrials)
      && typeof p.savedAt === 'number' && Number.isFinite(p.savedAt)
  }).slice(-100)
}

export function upsertDialInProfile(list: DialInProfile[], profile: DialInProfile): DialInProfile[] {
  // One active promoted snapshot per grinder × brewer. Provenance remains explicit.
  return [...list.filter(p => !(p.grinderId === profile.grinderId && p.method === profile.method)), profile].slice(-100)
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
  try {
    localStorage.setItem(DIAL_IN_PROFILES_KEY, JSON.stringify(next))
  } catch {
    // Storage errors must not crash the brew journal.
  }
}

export function findDialInProfile(
  list: DialInProfile[],
  grinderId: string | undefined,
  method: string,
): DialInProfile | undefined {
  if (!grinderId) return undefined
  return list.find(p => p.grinderId === grinderId && p.method === method)
}
