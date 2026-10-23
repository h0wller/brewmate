import { useRef, useState } from 'react'
import { genCode, saveSyncConfig, syncAll } from './sync/sync'
import type { SyncConfig, SyncData } from './sync/sync'
import { mergeData, sanitizeData } from './sync/merge'
import { downloadText } from './download'

export function SyncSettings({ initial, local, onMerged, onClose }: {
  initial: SyncConfig | null
  local: SyncData
  onMerged: (d: SyncData) => void
  onClose: () => void
}) {
  const [c, setC] = useState<SyncConfig>(initial ?? { url: '', anonKey: '', code: '' })
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const ready = c.url && c.anonKey && c.code

  const doSync = async () => {
    setBusy(true); setMsg('')
    try {
      const merged = await syncAll(c, local)
      saveSyncConfig(c)
      onMerged(merged)
      setMsg('✅ Готово: данные слиты и сохранены на сервере')
    } catch (e) { setMsg('❌ ' + (e as Error).message) }
    setBusy(false)
  }

  const exportJson = () => {
    const exportedAt = new Date().toISOString()
    downloadText(
      `brewmate-${exportedAt.slice(0, 10)}.json`,
      JSON.stringify({ app: 'brewmate', version: 1, exportedAt, ...local }, null, 2),
    )
    setMsg('✅ Резервная копия скачана')
  }

  /* импорт сливается с текущими данными (как синхронизация), а не заменяет их */
  const importJson = async (f: File) => {
    setMsg('')
    try {
      const incoming = sanitizeData(JSON.parse(await f.text()))
      if (!incoming.recipes.length && !incoming.sessions.length && !incoming.beans.length && !incoming.logs.length) {
        throw new Error('в файле нет данных BrewMate')
      }
      onMerged(mergeData(local, incoming))
      setMsg(
        `✅ Импортировано: рецептов ${incoming.recipes.length}, зерна ${incoming.beans.length}, ` +
        `каппингов ${incoming.sessions.length}, завариваний ${incoming.logs.length} (слито с текущими данными)`,
      )
    } catch (e) { setMsg('❌ Импорт: ' + (e as Error).message) }
  }

  return (
    <div>
      <button className="back" onClick={onClose}>← Назад</button>
      <h1>Данные и синхронизация ☁️</h1>

      <div className="small">
        Один код — общие данные на всех устройствах. На втором телефоне введи те же URL, key и код.
      </div>

      <div className="row"><label>URL</label>
        <input value={c.url} onChange={e => setC({ ...c, url: e.target.value })} placeholder="https://xxx.supabase.co" /></div>
      <div className="row"><label>anon key</label>
        <input value={c.anonKey} onChange={e => setC({ ...c, anonKey: e.target.value })} placeholder="eyJ…" /></div>
      <div className="row"><label>Код</label>
        <input value={c.code} onChange={e => setC({ ...c, code: e.target.value })} placeholder="BM-…" />
        <button className="btn secondary" style={{ width: 'auto', margin: 0, padding: '10px 14px' }}
          onClick={() => setC({ ...c, code: genCode() })}>🎲</button>
      </div>

      {msg && <div className="small" style={{ wordBreak: 'break-word' }}>{msg}</div>}

      <button className="btn" disabled={!ready || busy} onClick={doSync}>
        {busy ? 'Синхронизирую…' : '🔄 Синхронизировать'}
      </button>
      <button className="btn secondary" disabled={!ready}
        onClick={() => { saveSyncConfig(c); setMsg('✅ Настройки сохранены') }}>
        Сохранить настройки
      </button>

      <div className="small">Резервная копия (файл JSON — рецепты, зерно, каппинги, журнал)</div>
      <input ref={fileRef} type="file" accept="application/json,.json" hidden
        onChange={e => { const f = e.target.files?.[0]; if (f) importJson(f); e.currentTarget.value = '' }} />
      <button className="btn secondary" onClick={exportJson}>⬇️ Скачать копию</button>
      <button className="btn secondary" onClick={() => fileRef.current?.click()}>⬆️ Загрузить из файла</button>
    </div>
  )
}
