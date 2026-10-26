import { describe, expect, it } from 'vitest'
import { backupFileName, hasProfile, makeBackup, profileToRestore } from './backup'
import { emptyData, sanitizeData } from './sync/merge'
import { emptyProfile } from './grinders/profile'
import type { GrinderProfile } from './types'

const mine: GrinderProfile = { grinder: { id: 'comandante-c40' }, calibration: { medium: '24' } }

describe('резервная копия', () => {
  it('содержит все данные, замеры помола и профиль кофемолки', () => {
    const b = makeBackup({ ...emptyData(), grindChecks: [] }, mine, '2026-10-26T00:00:00.000Z')
    expect(b.app).toBe('brewmate')
    expect(b.grinderProfile).toEqual(mine)
    for (const k of ['recipes', 'sessions', 'beans', 'logs', 'grindChecks', 'deleted']) expect(k in b).toBe(true)
    expect(backupFileName(b.exportedAt)).toBe('brewmate-2026-10-26.json')
  })
  it('копия переживает JSON и читается обратно без потерь', () => {
    const b = JSON.parse(JSON.stringify(makeBackup(emptyData(), mine)))
    expect(sanitizeData(b).grindChecks).toEqual([])
    expect(profileToRestore(b, emptyProfile())).toEqual(mine)
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
