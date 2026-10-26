import { describe, expect, it } from 'vitest'
import type { BrewLog } from '../types'
import {
  findDialInProfile, profileFromConfirmedLog, sanitizeDialInProfiles, upsertDialInProfile,
} from './dialInProfile'

const log = (p: Partial<BrewLog> = {}): BrewLog => ({
  id: 'trial-3',
  title: 'Ethiopia',
  method: 'moccamaster',
  beanId: 'bean-1',
  beanName: 'Ethiopia washed',
  beanRoastDate: '2026-10-01',
  doseG: 20,
  waterG: 320,
  tempC: 93,
  grind: { grinder: { id: 'comandante-c40' }, setting: '28 clicks', size: 'medium_coarse' },
  steps: [{ duration: 240, pourTo: 320 }],
  startedAt: 1,
  durationS: 240,
  createdAt: 1,
  trial: { sourceLogId: 'source-1', variable: 'grind', baselineTaste: 'sour' },
  rating: 5,
  taste: 'balanced',
  ...p,
})

describe('dial-in profile promotion', () => {
  it('only promotes a confirmed, rated, balanced trial with bean and roast provenance', () => {
    const assessment = { status: 'confirmed', positive: 3, trials: 3 }
    expect(profileFromConfirmedLog(log(), assessment, 100)).toMatchObject({
      grinderId: 'comandante-c40',
      method: 'moccamaster',
      beanId: 'bean-1',
      roastDate: '2026-10-01',
      sourceLogId: 'trial-3',
      positiveTrials: 3,
      totalTrials: 3,
      savedAt: 100,
    })
    expect(profileFromConfirmedLog(log({ beanRoastDate: undefined }), assessment)).toBeUndefined()
    expect(profileFromConfirmedLog(log({ rating: undefined }), assessment)).toBeUndefined()
    expect(profileFromConfirmedLog(log({ taste: 'sour' }), assessment)).toBeUndefined()
    expect(profileFromConfirmedLog(log({ grind: undefined }), assessment)).toBeUndefined()
    expect(profileFromConfirmedLog(log(), { status: 'promising', positive: 3, trials: 3 })).toBeUndefined()
  })

  it('keeps one active snapshot per grinder and method without changing other combinations', () => {
    const first = profileFromConfirmedLog(log(), { status: 'confirmed', positive: 3, trials: 3 }, 100)!
    const replacement = { ...first, id: 'new', sourceLogId: 'trial-4', savedAt: 200 }
    const otherMethod = { ...first, id: 'v60', method: 'v60' }
    const result = upsertDialInProfile([first, otherMethod], replacement)
    expect(result).toHaveLength(2)
    expect(findDialInProfile(result, 'comandante-c40', 'moccamaster')?.sourceLogId).toBe('trial-4')
    expect(findDialInProfile(result, 'comandante-c40', 'v60')?.id).toBe('v60')
    expect(findDialInProfile(result, 'other-grinder', 'moccamaster')).toBeUndefined()
  })

  it('preserves separate profiles for different beans and roast dates on one setup', () => {
    const first = profileFromConfirmedLog(log(), { status: 'confirmed', positive: 3, trials: 3 }, 100)!
    const anotherBean = { ...first, id: 'bean-2', beanId: 'bean-2', beanName: 'Kenya', sourceLogId: 'trial-kenya' }
    const anotherRoast = { ...first, id: 'roast-2', roastDate: '2026-10-05', sourceLogId: 'trial-roast-2' }
    const result = upsertDialInProfile([first], anotherBean)
    const all = upsertDialInProfile(result, anotherRoast)
    expect(all).toHaveLength(3)
    expect(findDialInProfile(all, 'comandante-c40', 'moccamaster', 'bean-1', '2026-10-01')?.sourceLogId).toBe(first.sourceLogId)
    expect(findDialInProfile(all, 'comandante-c40', 'moccamaster', 'bean-2', '2026-10-01')?.sourceLogId).toBe('trial-kenya')
    expect(findDialInProfile(all, 'comandante-c40', 'moccamaster', 'bean-1', '2026-10-05')?.sourceLogId).toBe('trial-roast-2')
  })

  it('sanitizes malformed imported profile data', () => {
    const valid = profileFromConfirmedLog(log(), { status: 'confirmed', positive: 3, trials: 3 }, 100)!
    expect(sanitizeDialInProfiles([valid, null, { ...valid, doseG: -1 }, { ...valid, grinderId: '' }])).toEqual([valid])
  })
})
