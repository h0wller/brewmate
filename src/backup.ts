import type { GrinderProfile } from './types'
import type { AppData } from './sync/merge'
import { hasCalibration, sanitizeProfile } from './grinders/profile'
import { sanitizeDialInProfiles, upsertDialInProfile } from './beans/dialInProfile'
import type { DialInProfile } from './beans/dialInProfile'

/* Файл резервной копии: все данные для синхронизации + «Моя кофемолка» (она в синхронизацию не входит,
   но терять её при переезде на новый телефон не нужно) */
export function makeBackup(
  data: AppData,
  profile: GrinderProfile,
  exportedAt = new Date().toISOString(),
  dialInProfiles: DialInProfile[] = [],
) {
  return { app: 'brewmate', version: 1, exportedAt, ...data, grinderProfile: profile, dialInProfiles: sanitizeDialInProfiles(dialInProfiles) }
}

export function dialInProfilesToRestore(raw: unknown, current: DialInProfile[]): DialInProfile[] {
  const root = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
  const incoming = sanitizeDialInProfiles(root.dialInProfiles)
  return incoming.reduce((profiles, item) => upsertDialInProfile(profiles, item), sanitizeDialInProfiles(current))
}

export const hasProfile = (p: GrinderProfile): boolean => Boolean(p.grinder) || hasCalibration(p)

/* Кофемолку из файла берём, только если на этом устройстве своя ещё не настроена: настроенную не затираем */
export function profileToRestore(raw: unknown, current: GrinderProfile): GrinderProfile | null {
  if (hasProfile(current)) return null
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  if (!r.grinderProfile || typeof r.grinderProfile !== 'object') return null
  const p = sanitizeProfile(r.grinderProfile)
  return hasProfile(p) ? p : null
}

export const backupFileName = (exportedAt: string) => `brewmate-${exportedAt.slice(0, 10)}.json`
