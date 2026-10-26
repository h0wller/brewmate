import { createClient } from '@supabase/supabase-js'
import { buildPayload, mergeData, sanitizeData } from './merge'
import type { AppData } from './merge'

export interface SyncConfig { url: string; anonKey: string; code: string }
export type SyncData = AppData

const KEY = 'brewmate.sync.v1'
export const loadSyncConfig = (): SyncConfig | null => {
  try { return JSON.parse(localStorage.getItem(KEY) ?? 'null') } catch { return null }
}
export const saveSyncConfig = (c: SyncConfig) => localStorage.setItem(KEY, JSON.stringify(c))

/* BM-XXXX-XXXX-XXXX: 12 символов из 32 → 60 бит случайности (crypto, а не Math.random) */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const genCode = () => {
  const s = Array.from(crypto.getRandomValues(new Uint8Array(12)), x => CODE_ALPHABET[x % 32]).join('')
  return `BM-${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8)}`
}

export async function syncAll(cfg: SyncConfig, local: SyncData): Promise<SyncData> {
  const sb = createClient(cfg.url, cfg.anonKey)
  const { data, error } = await sb.from('sync').select('data').eq('id', cfg.code).maybeSingle()
  if (error) throw new Error('pull: ' + error.message)
  /* сервер мог хранить старый формат (без updatedAt и deleted) — sanitizeData его допускает */
  const merged = data?.data ? mergeData(local, sanitizeData(data.data)) : local
  const { error: e2 } = await sb
    .from('sync')
    .upsert({ id: cfg.code, data: buildPayload(data?.data, merged), updated_at: new Date().toISOString() })
  if (e2) throw new Error('push: ' + e2.message)
  return merged
}
