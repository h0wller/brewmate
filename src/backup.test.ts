import { describe, expect, it } from 'vitest'
import { backupFileName, dialInProfilesToRestore, hasProfile, makeBackup, parseBackupJson, profileToRestore } from './backup'
import type { DialInProfile } from './beans/dialInProfile'
import type { PhotoGrindProfile } from './grind/store'
import { emptyData, sanitizeData } from './sync/merge'
import { emptyProfile } from './grinders/profile'
import type { GrinderProfile } from './types'

const mine: GrinderProfile = { grinder: { id: 'comandante-c40' }, calibration: { medium: '24' } }
const photoProfile: PhotoGrindProfile = { grinderId: 'comandante-c40', size: 'medium', setting: 24, measuredSetting: 22, d50: 800, updatedAt: 100, checkId: 'check-1' }

const dialInProfile = (p: Partial<DialInProfile> = {}): DialInProfile => ({
  id: 'c40:moccamaster:trial-1', grinderId: 'comandante-c40', method: 'moccamaster',
  beanId: 'bean-1', beanName: 'Ethiopia', roastDate: '2026-10-01', sourceLogId: 'trial-1',
  doseG: 20, waterG: 320, tempC: 93, grindSize: 'medium_coarse',
  steps: [{ duration: 240, pourTo: 320 }], positiveTrials: 3, totalTrials: 3, savedAt: 100,
  ...p,
})

describe('резервная копия', () => {
  it('содержит все данные, замеры помола и профиль кофемолки', () => {
    const b = makeBackup({ ...emptyData(), grindChecks: [], photoProfiles: [photoProfile], dialInProfiles: [dialInProfile()] }, mine, '2026-10-26T00:00:00.000Z', [dialInProfile()])
    expect(b.app).toBe('brewmate')
    expect(b.grinderProfile).toEqual(mine)
    expect(b.dialInProfiles).toEqual([dialInProfile()])
    expect(b.photoProfiles).toEqual([photoProfile])
    for (const k of ['recipes', 'sessions', 'beans', 'logs', 'grindChecks', 'dialInProfiles', 'photoProfiles', 'deleted']) expect(k in b).toBe(true)
    expect(backupFileName(b.exportedAt)).toBe('brewmate-2026-10-26.json')
  })
  it('копия переживает JSON и читается обратно без потерь', () => {
    const b = JSON.parse(JSON.stringify(makeBackup(emptyData(), mine, undefined, [dialInProfile()])))
    expect(sanitizeData(b).grindChecks).toEqual([])
    expect(sanitizeData(b).photoProfiles).toEqual([])
    expect(sanitizeData(b).dialInProfiles).toEqual([dialInProfile()])
    expect(profileToRestore(b, emptyProfile())).toEqual(mine)
    expect(dialInProfilesToRestore(b, []).map(p => p.id)).toEqual([dialInProfile().id])
  })
  it('сохраняет dial-in и photo-профили в JSON-копии и принимает старый формат без них', () => {
    const b = makeBackup({ ...emptyData(), dialInProfiles: [dialInProfile()], photoProfiles: [photoProfile] }, mine)
    const parsed = sanitizeData(parseBackupJson(JSON.stringify(b)))
    expect(parsed.dialInProfiles).toEqual([dialInProfile()])
    expect(parsed.photoProfiles).toEqual([photoProfile])
    expect(sanitizeData({ recipes: [] }).dialInProfiles).toEqual([])
    expect(sanitizeData({ recipes: [] }).photoProfiles).toEqual([])
  })

  it('rejects malformed backup JSON for the import error handler', () => {
    expect(() => parseBackupJson('{broken json')).toThrow()
  })

  it('sanitizes broken profiles and merges imports with local profiles', () => {
    const local = dialInProfile({ id: 'local', beanId: 'local-bean' })
    const imported = dialInProfile({ id: 'imported', beanId: 'imported-bean' })
    const invalid = { ...imported, doseG: -1 }
    expect(dialInProfilesToRestore({ dialInProfiles: [imported, invalid, null] }, [local])).toEqual([local, imported])
    expect(dialInProfilesToRestore({ dialInProfiles: 'broken' }, [local])).toEqual([local])
    expect(dialInProfilesToRestore(null, [local])).toEqual([local])
  })
})

describe('восстановление «Моя кофемолка» из файла', () => {
  it('на устройстве без настроенной кофемолки — восстанавливается', () => {
    expect(profileToRestore({ grinderProfile: mine }, emptyProfile())).toEqual(mine)
  })
  it('уже настроенную не затирает', () => {
    expect(profileToRestore({ grinderProfile: { calibration: { fine: '10' } } }, mine)).toBeNull()
  })
  it('старый файл без профиля, мусор и пустой профиль — ничего не делают', () => {
    expect(profileToRestore({}, emptyProfile())).toBeNull()
    expect(profileToRestore(null, emptyProfile())).toBeNull()
    expect(profileToRestore({ grinderProfile: 'x' }, emptyProfile())).toBeNull()
    expect(profileToRestore({ grinderProfile: { calibration: {} } }, emptyProfile())).toBeNull()
  })
  it('hasProfile: только кофемолка или только калибровка — уже «настроено»', () => {
    expect(hasProfile(emptyProfile())).toBe(false)
    expect(hasProfile({ grinder: { id: 'x' }, calibration: {} })).toBe(true)
    expect(hasProfile({ calibration: { fine: '5' } })).toBe(true)
  })
})
