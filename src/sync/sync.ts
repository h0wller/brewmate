import { createClient } from '@supabase/supabase-js'
import type { BeanProfile, CuppingSession, Recipe } from '../types'

export interface SyncConfig { url: string; anonKey: string; code: string }
export interface SyncData { recipes: Recipe[]; sessions: CuppingSession[]; beans: BeanProfile[] }

const KEY = 'brewmate.sync.v1'
export const loadSyncConfig = (): SyncConfig | null => {
  try { return JSON.parse(localStorage.getItem(KEY) ?? 'null') } catch { return null }
}
export const saveSyncConfig = (c: SyncConfig) => localStorage.setItem(KEY, JSON.stringify(c))
export const genCode = () => 'BM-' + Math.random().toString(36).slice(2, 8).toUpperCase()

/* слияние по id: что есть локально или на сервере — всё в общую кучу */
const merge = <T extends { id: string }>(a: T[], b: T[]): T[] => {
  const map = new Map(a.map(x => [x.id, x]))
  for (const x of b) if (!map.has(x.id)) map.set(x.id, x)
  return [...map.values()]
}

export async function syncAll(cfg: SyncConfig, local: SyncData): Promise<SyncData> {
  const sb = createClient(cfg.url, cfg.anonKey)
  const { data, error } = await sb.from('sync').select('data').eq('id', cfg.code).maybeSingle()
  if (error) throw new Error('pull: ' + error.message)
  const remote = (data?.data ?? null) as SyncData | null
  const merged: SyncData = remote
    ? {
        recipes: merge(local.recipes, remote.recipes ?? []),
        sessions: merge(local.sessions, remote.sessions ?? []),
        beans: merge(local.beans, remote.beans ?? []),
      }
    : local
  const { error: e2 } = await sb
    .from('sync')
    .upsert({ id: cfg.code, data: merged, updated_at: new Date().toISOString() })
  if (e2) throw new Error('push: ' + e2.message)
  return merged
}