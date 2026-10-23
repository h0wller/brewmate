import type { BeanProfile, BrewLog, CuppingSession, Recipe } from './types'
import { sanitizeData } from './sync/merge'
import type { Tombstones } from './sync/merge'

const RKEY = 'brewmate.recipes.v1'
const CKEY = 'brewmate.cupping.v1'
const BKEY = 'brewmate.beans.v1'
const LKEY = 'brewmate.logs.v1'
const DKEY = 'brewmate.deleted.v1'

/* ключи с пользовательскими данными (без ключей AI и синхронизации — там секреты) */
export const DATA_KEYS = [RKEY, CKEY, BKEY, LKEY, DKEY]

function readList<T extends { id: string }>(key: string): T[] {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? '[]')
    return Array.isArray(v) ? v.filter(x => x && typeof x.id === 'string') : []
  } catch { return [] }
}

/* запись не должна ронять приложение: переполнение квоты, приватный режим и т.п. */
function writeJSON(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)) }
  catch (e) { console.warn('storage: не удалось сохранить', key, e) }
}

export const loadRecipes = (): Recipe[] => readList<Recipe>(RKEY)
export const saveRecipes = (r: Recipe[]): void => writeJSON(RKEY, r)

export const loadSessions = (): CuppingSession[] => readList<CuppingSession>(CKEY)
export const saveSessions = (s: CuppingSession[]): void => writeJSON(CKEY, s)

export const loadBeans = (): BeanProfile[] => readList<BeanProfile>(BKEY)
export const saveBeans = (b: BeanProfile[]): void => writeJSON(BKEY, b)

export const loadLogs = (): BrewLog[] => readList<BrewLog>(LKEY)
export const saveLogs = (l: BrewLog[]): void => writeJSON(LKEY, l)

export const loadDeleted = (): Tombstones => {
  try { return sanitizeData({ deleted: JSON.parse(localStorage.getItem(DKEY) ?? 'null') }).deleted }
  catch { return {} }
}
export const saveDeleted = (d: Tombstones): void => writeJSON(DKEY, d)

/* id записей: 20 hex-символов из crypto (getRandomValues работает и без https) */
export const uid = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(10)), x => x.toString(16).padStart(2, '0')).join('')
