import type { BeanProfile, BrewLog, CuppingSession, Recipe } from '../types'
import { migrateGrind } from '../grinders/grind'
import { capChecks, sanitizeChecks } from '../grind/store'
import type { GrindCheck, PhotoGrindProfile } from '../grind/store'
import { sanitizePhotoProfiles } from '../grind/store'
import type { DialInProfile } from '../beans/dialInProfile'
import { sanitizeDialInProfiles } from '../beans/dialInProfile'

/* id → время удаления (мс). Нужны, чтобы удалённое не «воскресало» при синхронизации */
export type Tombstones = Record<string, number>

export interface AppData {
  recipes: Recipe[]
  sessions: CuppingSession[]
  beans: BeanProfile[]
  logs: BrewLog[]
  grindChecks: GrindCheck[]
  dialInProfiles: DialInProfile[]
  photoProfiles: PhotoGrindProfile[]
  deleted: Tombstones
}

interface Item { id: string; createdAt?: number; updatedAt?: number }

export const emptyData = (): AppData => ({ recipes: [], sessions: [], beans: [], logs: [], grindChecks: [], dialInProfiles: [], photoProfiles: [], deleted: {} })

/* пометить запись как изменённую сейчас */
export const stamp = <T extends object>(x: T): T & { updatedAt: number } =>
  ({ ...x, updatedAt: Date.now() })

/* Данные из внешнего источника (сервер, файл) берём только в том виде, который похож на наши */
const cleanList = <T extends Item>(v: unknown): T[] =>
  Array.isArray(v)
    ? v.filter((x): x is T => !!x && typeof x === 'object' && typeof (x as Item).id === 'string')
    : []

const cleanDeleted = (v: unknown): Tombstones => {
  const out: Tombstones = {}
  if (v && typeof v === 'object') {
    for (const [id, t] of Object.entries(v)) {
      if (typeof t === 'number' && Number.isFinite(t)) out[id] = t
    }
  }
  return out
}

export function sanitizeData(raw: unknown): AppData {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return {
    recipes: cleanList<Recipe>(r.recipes).map(migrateGrind),
    sessions: cleanList<CuppingSession>(r.sessions),
    beans: cleanList<BeanProfile>(r.beans),
    logs: cleanList<BrewLog>(r.logs).map(migrateGrind),
    grindChecks: sanitizeChecks(r.grindChecks),   // нет в старых копиях и на сервере — тогда пусто
    dialInProfiles: sanitizeDialInProfiles(r.dialInProfiles),
    photoProfiles: sanitizePhotoProfiles(r.photoProfiles),
    deleted: cleanDeleted(r.deleted),
  }
}

const mergeDeleted = (a: Tombstones, b: Tombstones): Tombstones => {
  const out: Tombstones = { ...a }
  for (const [id, t] of Object.entries(b)) out[id] = Math.max(out[id] ?? 0, t)
  return out
}

/* Побеждает более свежая правка (updatedAt); при равенстве — локальная запись.
   Запись, удалённая позже последней правки, в результат не попадает. */
function mergeList<T extends Item>(local: T[], remote: T[], dead: Tombstones): T[] {
  const map = new Map<string, T>()
  for (const x of [...remote, ...local]) {
    const cur = map.get(x.id)
    if (!cur || (x.updatedAt ?? 0) >= (cur.updatedAt ?? 0)) map.set(x.id, x)
  }
  return [...map.values()]
    .filter(x => {
      const d = dead[x.id]
      return d === undefined || (x.updatedAt ?? 0) > d
    })
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
}

/* Dial-in snapshots are keyed by grinder + method + bean + roast date; latest savedAt wins. */
function mergeDialInProfiles(local: DialInProfile[], remote: DialInProfile[], dead: Tombstones): DialInProfile[] {
  const map = new Map<string, DialInProfile>()
  const keyOf = (p: DialInProfile) => JSON.stringify([p.grinderId, p.method, p.beanId ?? null, p.roastDate ?? null])
  for (const p of [...remote, ...local]) {
    const key = keyOf(p)
    const current = map.get(key)
    if (!current || p.savedAt >= current.savedAt) map.set(key, p)
  }
  return [...map.values()]
    .filter(p => dead[p.id] === undefined || p.savedAt > dead[p.id])
    .sort((a, b) => b.savedAt - a.savedAt)
}

/* Photo recommendations have no stable id; use grinder + grind size and latest updatedAt. */
function mergePhotoProfiles(local: PhotoGrindProfile[], remote: PhotoGrindProfile[]): PhotoGrindProfile[] {
  const map = new Map<string, PhotoGrindProfile>()
  for (const p of [...remote, ...local]) {
    const key = JSON.stringify([p.grinderId, p.size])
    const current = map.get(key)
    if (!current || p.updatedAt >= current.updatedAt) map.set(key, p)
  }
  return [...map.values()].sort((a, b) => b.updatedAt - a.updatedAt)
}

export function mergeData(local: AppData, remote: AppData): AppData {
  const deleted = mergeDeleted(local.deleted, remote.deleted)
  return {
    recipes: mergeList(local.recipes, remote.recipes, deleted),
    sessions: mergeList(local.sessions, remote.sessions, deleted),
    beans: mergeList(local.beans, remote.beans, deleted),
    logs: mergeList(local.logs, remote.logs, deleted),
    grindChecks: capChecks(mergeList(local.grindChecks, remote.grindChecks, deleted)),
    dialInProfiles: mergeDialInProfiles(local.dialInProfiles, remote.dialInProfiles, deleted),
    photoProfiles: mergePhotoProfiles(local.photoProfiles, remote.photoProfiles),
    deleted,
  }
}

/* Что кладём на сервер: слитые данные поверх того, что там уже лежало. Поля, которых эта версия приложения
   не знает (их записало более новое приложение на другом устройстве), сохраняем, а не затираем. */
export function buildPayload(remoteRaw: unknown, merged: AppData): Record<string, unknown> {
  const base = remoteRaw && typeof remoteRaw === 'object' && !Array.isArray(remoteRaw) ? remoteRaw : {}
  return { ...base, ...merged }
}
