import { useRef, useState } from 'react'
import { genCode, saveSyncConfig, syncAll } from './sync/sync'
import type { SyncConfig, SyncData } from './sync/sync'
import { emptyData, mergeData, sanitizeData } from './sync/merge'
import { CoffeeJSONError, COFFEEJSON_MEDIA_TYPE, parseCoffeeJSON, toCoffeeJSON } from './coffeejson/coffeejson'
import { downloadText } from './download'
import type { GrinderProfile } from './types'
import { backupFileName, dialInProfilesToRestore, makeBackup, parseBackupJson, profileToRestore } from './backup'
import { loadDialInProfiles, sanitizeDialInProfiles } from './beans/dialInProfile'
import { saveRecipes } from './storage'
import { runStorageWrites } from './storageError'
import { applyLocalData } from './sync/applyLocal'

export function SyncSettings({ initial, local, profile, onProfile, onMerged, onClose, onOpenGrinder, onOpenAI }: {
  initial: SyncConfig | null
  local: SyncData
  profile: GrinderProfile
  onProfile: (p: GrinderProfile) => void
  onMerged: (d: SyncData) => void
  onClose: () => void
  onOpenGrinder: () => void
  onOpenAI: () => void
}) {
  const [c, setC] = useState<SyncConfig>(initial ?? { url: '', anonKey: '', code: '' })
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const cjRef = useRef<HTMLInputElement>(null)
  const ready = c.url && c.anonKey && c.code

  const doSync = async () => {
    setBusy(true); setMsg('')
    try {
      const merged = await syncAll(c, local)
      const failed = applyLocalData(merged)
      if (failed.length) {
        setMsg('⚠️ Серверная синхронизация завершена, но локально не сохранены: ' + failed.join(', ') + '. Данные могли сохраниться частично; проверьте резервную копию.')
      } else {
        /* интерфейс обновляем до записи конфига: сырой setItem конфига может бросить,
           и тогда данные на диске новее состояния экрана */
        onMerged(merged)
        let cfgWarning = ''
        try { saveSyncConfig(c) } catch { cfgWarning = ' Настройки подключения на устройстве не сохранились.' }
        setMsg('✅ Готово: данные синхронизированы с сервером и сохранены на устройстве.' + cfgWarning)
      }
    } catch (e) { setMsg('❌ ' + (e as Error).message) }
    setBusy(false)
  }

  const exportJson = () => {
    const b = makeBackup(local, profile, new Date().toISOString(), loadDialInProfiles())
    downloadText(backupFileName(b.exportedAt), JSON.stringify(b, null, 2))
    setMsg('✅ Резервная копия скачана')
  }

  /* импорт сливается с текущими данными (как синхронизация), а не заменяет их */
  const importJson = async (f: File) => {
    setMsg('')
    try {
      const raw = parseBackupJson(await f.text())
      const incoming = sanitizeData(raw)
      const restored = profileToRestore(raw, profile)
      const rawProfiles = raw && typeof raw === 'object'
        ? sanitizeDialInProfiles((raw as Record<string, unknown>).dialInProfiles)
        : []
      if (!incoming.recipes.length && !incoming.sessions.length && !incoming.beans.length
        && !incoming.logs.length && !incoming.grindChecks.length && !incoming.dialInProfiles.length
        && !incoming.photoProfiles.length && !restored && !rawProfiles.length) {
        throw new Error('в файле нет данных BrewMate')
      }
      const merged = mergeData(local, incoming)
      const dialInProfiles = rawProfiles.length
        ? dialInProfilesToRestore(raw, loadDialInProfiles())
        : merged.dialInProfiles
      const dataToApply = { ...merged, dialInProfiles }
      const failed = applyLocalData(dataToApply, restored ?? undefined)
      if (failed.length) {
        setMsg('❌ Импорт не применён в интерфейсе. Ошибка локальной записи: ' + failed.join(', ') + '. Часть ключей могла сохраниться; проверьте резервную копию.')
        return
      }
      onMerged(dataToApply)
      if (restored) onProfile(restored)
      setMsg(
        `✅ Импортировано: рецептов ${incoming.recipes.length}, зерна ${incoming.beans.length}, ` +
        `каппингов ${incoming.sessions.length}, завариваний ${incoming.logs.length}, ` +
        `замеров помола ${incoming.grindChecks.length}, dial-in-профилей ${incoming.dialInProfiles.length}, ` +
        `фото-профилей ${incoming.photoProfiles.length}, профилей настройки ${rawProfiles.length}${restored ? ', кофемолка восстановлена' : ''} (слито с текущими данными)`,
      )
    } catch (e) { setMsg('❌ Импорт: ' + (e as Error).message) }
  }

  /* обмен рецептами с другими приложениями (формат CoffeeJSON) */
  const exportCoffeeJSON = () => {
    if (!local.recipes.length) { setMsg('❌ Нет рецептов для экспорта'); return }
    downloadText(`brewmate-recipes-${new Date().toISOString().slice(0, 10)}.json`, toCoffeeJSON(local.recipes), COFFEEJSON_MEDIA_TYPE)
    setMsg(`✅ Экспортировано рецептов: ${local.recipes.length} (CoffeeJSON)`)
  }

  const importCoffeeJSON = async (f: File) => {
    setMsg('')
    try {
      if (f.size > 2_000_000) throw new CoffeeJSONError('not_a_document', 'файл больше 2 МБ — это не рецепты')
      const res = parseCoffeeJSON(await f.text())
      if (res.recipes.length) {
        const merged = mergeData(local, { ...emptyData(), recipes: res.recipes })
        const failed = runStorageWrites([{ key: 'рецепты', write: () => saveRecipes(merged.recipes) }])
        if (failed.length) {
          setMsg('❌ Импорт CoffeeJSON не применён: не удалось сохранить рецепты на устройстве. Проверьте резервную копию.')
          return
        }
        onMerged(merged)
      }
      const lines = [
        res.recipes.length ? `✅ Импортировано рецептов: ${res.recipes.length}` : '❌ Ни один рецепт не подошёл',
        ...res.skipped.map(x => `пропущен «${x.title}»: ${x.reason}`),
        ...res.notes,
      ]
      setMsg(lines.join('\n'))
    } catch (e) { setMsg('❌ Импорт CoffeeJSON: ' + (e as Error).message) }
  }

  return (
    <div>
      <button className="back" onClick={onClose}>← Назад</button>
      <h1>Настройки</h1>

      <button className="btn secondary" style={{ marginTop: 0 }} onClick={onOpenGrinder}>🔧 Моя кофемолка</button>
      <button className="btn secondary" onClick={onOpenAI}>🤖 AI: свой ключ (для продвинутых)</button>

      <div className="small">Данные и синхронизация ☁️</div>

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
          aria-label="Сгенерировать код" onClick={() => setC({ ...c, code: genCode() })}>🎲</button>
      </div>

      {msg && <div className="small" style={{ wordBreak: 'break-word', whiteSpace: 'pre-line' }}>{msg}</div>}

      <button className="btn" disabled={!ready || busy} onClick={doSync}>
        {busy ? 'Синхронизирую…' : '🔄 Синхронизировать'}
      </button>
      <button className="btn secondary" disabled={!ready}
        onClick={() => {
          if (!saveSyncConfig(c)) {
            setMsg('❌ Настройки подключения не сохранились на устройстве.')
            return
          }
          setMsg('✅ Настройки сохранены') }}>
        Сохранить настройки
      </button>

      <div className="small">Резервная копия (JSON: рецепты, зерно, каппинги, журнал, замеры помола, «Моя кофемолка» и профили настройки)</div>
      <input ref={fileRef} type="file" accept="application/json,.json" hidden
        onChange={e => { const f = e.target.files?.[0]; if (f) importJson(f); e.currentTarget.value = '' }} />
      <button className="btn secondary" onClick={exportJson}>⬇️ Скачать копию</button>
      <button className="btn secondary" onClick={() => fileRef.current?.click()}>⬆️ Загрузить из файла</button>

      <div className="small">
        Обмен рецептами с другими приложениями — открытый формат CoffeeJSON (рецепты, без журнала и зерна)
      </div>
      <input ref={cjRef} type="file" accept="application/json,.json" hidden
        onChange={e => { const f = e.target.files?.[0]; if (f) importCoffeeJSON(f); e.currentTarget.value = '' }} />
      <button className="btn secondary" onClick={exportCoffeeJSON}>⬇️ Рецепты в CoffeeJSON</button>
      <button className="btn secondary" onClick={() => cjRef.current?.click()}>⬆️ Рецепты из CoffeeJSON</button>
    </div>
  )
}
