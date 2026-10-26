import { useEffect, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import {
  deleteVisionBenchRecord, exportVisionBench, importVisionBench, listVisionBenchRecords,
  saveVisionBenchRecord,
} from './ai/visionBenchStore'
import type { VisionBenchPhoto, VisionBenchRecord } from './ai/visionBenchStore'
import './VisionBench.css'

type Draft = Omit<VisionBenchRecord, 'id' | 'createdAt' | 'updatedAt'>

const emptyDraft = (): Draft => ({
  roaster: '', coffeeName: '', country: '', region: '', process: '', variety: '',
  altitude: '', roastDate: '', roastLevel: '', verified: false, source: '', notes: '', photos: [],
})

const makeId = () => crypto.randomUUID()

function PhotoThumb({ photo, onRemove }: { photo: VisionBenchPhoto; onRemove?: () => void }) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    const next = URL.createObjectURL(photo.blob)
    setUrl(next)
    return () => URL.revokeObjectURL(next)
  }, [photo.blob])

  return (
    <div className="benchPhoto">
      {url && <img src={url} alt={photo.name} />}
      <div className="benchPhotoName" title={photo.name}>{photo.name}</div>
      {onRemove && <button type="button" className="x" aria-label={`Удалить фото ${photo.name}`} onClick={onRemove}>×</button>}
    </div>
  )
}

export function VisionBench() {
  const [records, setRecords] = useState<VisionBenchRecord[]>([])
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [ready, setReady] = useState(false)

  const refresh = async () => {
    setRecords(await listVisionBenchRecords())
    setReady(true)
  }

  useEffect(() => {
    let active = true
    listVisionBenchRecords().then(rows => {
      if (active) { setRecords(rows); setReady(true) }
    }).catch(e => {
      if (active) { setError(e instanceof Error ? e.message : 'Не удалось открыть локальную базу тестовых фото.'); setReady(true) }
    })
    return () => { active = false }
  }, [])

  const setField = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft(current => ({ ...current, [key]: value }))

  const addPhotos = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    setError('')
    if (draft.photos.length + files.length > 4) {
      setError('На одну запись можно добавить максимум 4 фото (например, лицевая и оборотная стороны пачки).')
      return
    }
    const tooLarge = files.find(file => file.size > 15 * 1024 * 1024)
    if (tooLarge) {
      setError(`Фото «${tooLarge.name}» больше 15 МБ. Уменьши его перед добавлением.`)
      return
    }
    const invalid = files.find(file => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    if (invalid) {
      setError(`Формат «${invalid.name}» не поддерживается. Используй JPEG, PNG или WebP.`)
      return
    }
    setDraft(current => ({
      ...current,
      photos: [...current.photos, ...files.map(file => ({
        id: makeId(), name: file.name, type: file.type, blob: file,
      }))],
    }))
  }

  const resetForm = () => {
    setDraft(emptyDraft())
    setEditingId(null)
    setError('')
    setNotice('')
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setNotice('')
    if (!draft.coffeeName.trim()) { setError('Укажи название кофе или лота.'); return }
    if (!draft.photos.length) { setError('Добавь хотя бы одну фотографию пачки.'); return }
    setBusy(true)
    try {
      const now = Date.now()
      const existing = editingId ? records.find(record => record.id === editingId) : undefined
      const record: VisionBenchRecord = {
        ...draft,
        coffeeName: draft.coffeeName.trim(),
        roaster: draft.roaster.trim(),
        id: editingId ?? makeId(),
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      }
      await saveVisionBenchRecord(record)
      await refresh()
      resetForm()
      setNotice('Эталонная запись сохранена на этом устройстве.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить запись.')
    } finally {
      setBusy(false)
    }
  }

  const editRecord = (record: VisionBenchRecord) => {
    setEditingId(record.id)
    setDraft({
      roaster: record.roaster, coffeeName: record.coffeeName, country: record.country,
      region: record.region, process: record.process, variety: record.variety,
      altitude: record.altitude, roastDate: record.roastDate, roastLevel: record.roastLevel,
      verified: record.verified, source: record.source, notes: record.notes, photos: [...record.photos],
    })
    setError('')
    setNotice('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const removeRecord = async (record: VisionBenchRecord) => {
    if (!window.confirm(`Удалить тестовую запись «${record.coffeeName}» и её фото с этого устройства?`)) return
    setError('')
    setNotice('')
    try {
      await deleteVisionBenchRecord(record.id)
      await refresh()
      if (editingId === record.id) resetForm()
      setNotice('Запись удалена с этого устройства.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось удалить запись.')
    }
  }

  const exportAll = async () => {
    setBusy(true); setError(''); setNotice('')
    try {
      const json = await exportVisionBench(records)
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `brewmate-vision-bench-${new Date().toISOString().slice(0, 10)}.json`
      anchor.click()
      URL.revokeObjectURL(url)
      setNotice(`Экспортировано записей: ${records.length}. Файл содержит эталонные поля и исходные фото.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось экспортировать тестовый набор.')
    } finally {
      setBusy(false)
    }
  }

  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setBusy(true); setError(''); setNotice('')
    try {
      const imported = await importVisionBench(file)
      for (const record of imported) await saveVisionBenchRecord(record)
      await refresh()
      setNotice(`Импортировано записей: ${imported.length}. Совпадающие ID обновлены, остальные добавлены.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось импортировать тестовый набор.')
    } finally {
      setBusy(false)
    }
  }

  const verifiedCount = records.filter(record => record.verified).length

  return (
    <main className="visionBench">
      <header className="header">
        <div>
          <h1>AI Test Bench</h1>
          <div className="meta">Эталонный набор фотографий кофе</div>
        </div>
        <div className="benchActions">
          <button className="btn" type="button" disabled={busy || records.length === 0} onClick={exportAll}>Экспорт</button>
          <label className="btn benchImport">
            Импорт
            <input type="file" accept="application/json,.json" onChange={importFile} disabled={busy} />
          </label>
        </div>
      </header>

      <section className="benchIntro">
        <strong>Сначала соберём эталоны, затем сравним модели.</strong>
        <p>Добавляй фото реальных пачек и вручную переноси подтверждённые данные с этикетки или сайта обжарщика. Пока это каталог для будущего тестирования: запросы к AI здесь не запускаются.</p>
        <p className="benchPrivacy">Фотографии и записи хранятся локально в IndexedDB этого браузера. Они не отправляются на сервер. Экспортируй JSON, чтобы не потерять набор при очистке данных браузера или переносе на другое устройство.</p>
        <div className="benchStats">
          <div><strong>{records.length}</strong><span>образцов</span></div>
          <div><strong>{records.reduce((sum, record) => sum + record.photos.length, 0)}</strong><span>фотографий</span></div>
          <div><strong>{verifiedCount}</strong><span>проверено</span></div>
        </div>
      </section>

      {error && <div className="benchMessage error" role="alert">{error}</div>}
      {notice && <div className="benchMessage" role="status">{notice}</div>}
      {!ready && <p className="small">Открываю локальную базу тестовых фото…</p>}

      <section className="benchPanel">
        <h2>{editingId ? 'Редактировать эталон' : 'Добавить образец'}</h2>
        <form onSubmit={submit}>
          <label className="benchField">
            Название кофе / лота *
            <input value={draft.coffeeName} maxLength={120} required onChange={e => setField('coffeeName', e.target.value)} placeholder="Например, Kenya Kirinyaga AA" />
          </label>
          <label className="benchField">
            Обжарщик
            <input value={draft.roaster} maxLength={120} onChange={e => setField('roaster', e.target.value)} placeholder="Название обжарщика" />
          </label>
          <div className="benchGrid">
            <label className="benchField">Страна
              <input value={draft.country} maxLength={80} onChange={e => setField('country', e.target.value)} placeholder="Кения" />
            </label>
            <label className="benchField">Регион / станция
              <input value={draft.region} maxLength={120} onChange={e => setField('region', e.target.value)} placeholder="Kirinyaga, станция…" />
            </label>
            <label className="benchField">Обработка
              <select value={draft.process} onChange={e => setField('process', e.target.value)}>
                <option value="">Не указана</option>
                <option value="washed">Washed / мытая</option>
                <option value="natural">Natural / натуральная</option>
                <option value="honey">Honey</option>
                <option value="anaerobic">Анаэробная</option>
                <option value="other">Другая / экспериментальная</option>
              </select>
            </label>
            <label className="benchField">Разновидность
              <input value={draft.variety} maxLength={120} onChange={e => setField('variety', e.target.value)} placeholder="SL28, Bourbon…" />
            </label>
            <label className="benchField">Высота
              <input value={draft.altitude} maxLength={80} onChange={e => setField('altitude', e.target.value)} placeholder="1800–2000 м" />
            </label>
            <label className="benchField">Дата обжарки
              <input type="date" value={draft.roastDate} onChange={e => setField('roastDate', e.target.value)} />
            </label>
            <label className="benchField">Обжарка
              <select value={draft.roastLevel} onChange={e => setField('roastLevel', e.target.value)}>
                <option value="">Не указана</option>
                <option value="light">Светлая</option>
                <option value="medium">Средняя</option>
                <option value="dark">Тёмная</option>
              </select>
            </label>
            <label className="benchField">Источник эталонных данных
              <select value={draft.source} onChange={e => setField('source', e.target.value)}>
                <option value="">Не указан</option>
                <option value="label">Этикетка пачки</option>
                <option value="roaster">Сайт обжарщика</option>
                <option value="supplier">Поставщик / импортёр</option>
                <option value="manual">Проверено вручную</option>
              </select>
            </label>
          </div>
          <label className="benchField">
            Фото пачки (JPEG, PNG или WebP; до 15 МБ каждое; максимум 4)
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={addPhotos} disabled={busy || draft.photos.length >= 4} />
          </label>
          <div className="benchTip">Желательно: лицевая сторона с названием и отдельное резкое фото этикетки с происхождением и обработкой. Не обрезай важный текст.</div>
          {draft.photos.length > 0 && (
            <div className="benchPhotos">
              {draft.photos.map(photo => <PhotoThumb key={photo.id} photo={photo} onRemove={() => setField('photos', draft.photos.filter(p => p.id !== photo.id))} />)}
            </div>
          )}
          <label className="benchCheck">
            <input type="checkbox" checked={draft.verified} onChange={e => setField('verified', e.target.checked)} />
            Эталонные поля сверены с указанным источником
          </label>
          <label className="benchField">
            Примечания
            <textarea value={draft.notes} maxLength={2000} onChange={e => setField('notes', e.target.value)} placeholder="Что важно учесть при оценке распознавания…" rows={3} />
          </label>
          <div className="benchFormActions">
            <button className="btn" type="submit" disabled={busy}>{busy ? 'Сохраняю…' : editingId ? 'Сохранить изменения' : 'Добавить в набор'}</button>
            {editingId && <button className="chip" type="button" disabled={busy} onClick={resetForm}>Отмена</button>}
          </div>
        </form>
      </section>

      <section className="benchRecords">
        <h2>Тестовый набор <span className="benchCount">{records.length}</span></h2>
        {records.length === 0 ? (
          <div className="benchEmpty">
            <strong>Пока нет образцов</strong>
            <p>Добавь первую пачку и заполни только те поля, которые можешь подтвердить. Неизвестные значения оставляй пустыми — так мы не будем считать догадки эталоном.</p>
          </div>
        ) : records.map(record => (
          <article className="benchRecord" key={record.id}>
            <div className="benchRecordHeader">
              <div className="grow">
                <h3>{record.coffeeName}</h3>
                <div className="meta">{[record.roaster, record.country, record.region].filter(Boolean).join(' · ') || 'Нет данных о происхождении'}</div>
              </div>
              <span className={record.verified ? 'benchBadge verified' : 'benchBadge'}>{record.verified ? 'Проверен' : 'Черновик'}</span>
            </div>
            <div className="benchRecordFields">
              {[
                ['Обработка', record.process], ['Разновидность', record.variety],
                ['Высота', record.altitude], ['Дата обжарки', record.roastDate],
                ['Обжарка', ({ light: 'Светлая', medium: 'Средняя', dark: 'Тёмная' } as Record<string, string>)[record.roastLevel] ?? record.roastLevel],
                ['Источник', ({ label: 'Этикетка', roaster: 'Сайт обжарщика', supplier: 'Поставщик', manual: 'Проверено вручную' } as Record<string, string>)[record.source] ?? record.source],
              ].filter(([, value]) => value).map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}
            </div>
            <div className="benchPhotos">
              {record.photos.map(photo => <PhotoThumb key={photo.id} photo={photo} />)}
            </div>
            {record.notes && <p className="benchNotes">{record.notes}</p>}
            <div className="benchRecordActions">
              <button type="button" className="chip" onClick={() => editRecord(record)}>Редактировать</button>
              <button type="button" className="chip fault" onClick={() => void removeRecord(record)}>Удалить</button>
            </div>
          </article>
        ))}
      </section>
    </main>
  )
}
