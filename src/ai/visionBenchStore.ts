export type VisionBenchPhoto = {
  id: string
  name: string
  type: string
  blob: Blob
}

export type VisionBenchRecord = {
  id: string
  createdAt: number
  updatedAt: number
  roaster: string
  coffeeName: string
  country: string
  region: string
  process: string
  variety: string
  altitude: string
  roastDate: string
  roastLevel: string
  verified: boolean
  source: string
  notes: string
  photos: VisionBenchPhoto[]
}

const DB_NAME = 'brewmate-vision-bench'
const STORE_NAME = 'samples'
const MAX_IMPORT_BYTES = 60 * 1024 * 1024

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('В этом браузере недоступно локальное хранилище фотографий.'))
      return
    }
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: 'id' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Не удалось открыть хранилище тестовых фото.'))
  })
}

export async function listVisionBenchRecords(): Promise<VisionBenchRecord[]> {
  const db = await openDb()
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll()
      request.onsuccess = () => resolve((request.result as VisionBenchRecord[]).sort((a, b) => b.updatedAt - a.updatedAt))
      request.onerror = () => reject(request.error ?? new Error('Не удалось прочитать тестовые данные.'))
    })
  } finally {
    db.close()
  }
}

export async function saveVisionBenchRecord(record: VisionBenchRecord): Promise<void> {
  const db = await openDb()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).put(record)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error('Не удалось сохранить тестовую запись.'))
      tx.onabort = () => reject(tx.error ?? new Error('Сохранение тестовой записи отменено.'))
    })
  } finally {
    db.close()
  }
}

export async function deleteVisionBenchRecord(id: string): Promise<void> {
  const db = await openDb()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).delete(id)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error('Не удалось удалить тестовую запись.'))
      tx.onabort = () => reject(tx.error ?? new Error('Удаление тестовой записи отменено.'))
    })
  } finally {
    db.close()
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('Не удалось прочитать фотографию для экспорта.'))
    reader.readAsDataURL(blob)
  })
}

function dataUrlToBlob(value: unknown): Blob {
  if (typeof value !== 'string') throw new Error('В JSON есть фото без данных.')
  const match = value.match(/^data:(image\/(?:jpeg|png|webp|heic|heif));base64,([A-Za-z0-9+/]+=*)$/i)
  if (!match) throw new Error('Фото в JSON должно быть изображением JPEG, PNG, WebP, HEIC или HEIF.')
  const binary = atob(match[2])
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: match[1].toLowerCase() })
}

export async function exportVisionBench(records: VisionBenchRecord[]): Promise<string> {
  const exported = await Promise.all(records.map(async record => ({
    ...record,
    photos: await Promise.all(record.photos.map(async photo => ({
      id: photo.id,
      name: photo.name,
      type: photo.type,
      dataUrl: await blobToDataUrl(photo.blob),
    }))),
  })))
  return JSON.stringify({ format: 'brewmate-vision-bench', version: 1, exportedAt: new Date().toISOString(), records: exported }, null, 2)
}

export async function importVisionBench(file: File): Promise<VisionBenchRecord[]> {
  if (file.size > MAX_IMPORT_BYTES) throw new Error('Файл импорта больше 60 МБ.')
  const parsed: unknown = JSON.parse(await file.text())
  if (!parsed || typeof parsed !== 'object') throw new Error('Некорректный JSON.')
  const root = parsed as Record<string, unknown>
  if (root.format !== 'brewmate-vision-bench' || root.version !== 1 || !Array.isArray(root.records)) {
    throw new Error('Это не файл экспорта BrewMate AI Test версии 1.')
  }
  const records: VisionBenchRecord[] = []
  for (const raw of root.records) {
    if (!raw || typeof raw !== 'object') throw new Error('В файле есть некорректная запись.')
    const r = raw as Record<string, unknown>
    if (typeof r.id !== 'string' || typeof r.coffeeName !== 'string' || !Array.isArray(r.photos)) {
      throw new Error('В файле есть запись без ID, названия кофе или фотографий.')
    }
    const photos: VisionBenchPhoto[] = r.photos.map((p: unknown) => {
      if (!p || typeof p !== 'object') throw new Error('Некорректная фотография в файле.')
      const photo = p as Record<string, unknown>
      if (typeof photo.id !== 'string' || typeof photo.name !== 'string') throw new Error('У фотографии нет ID или имени.')
      const blob = dataUrlToBlob(photo.dataUrl)
      return { id: photo.id, name: photo.name, type: blob.type, blob }
    })
    if (!photos.length) throw new Error('Каждая тестовая запись должна содержать хотя бы одно фото.')
    records.push({
      id: r.id,
      createdAt: typeof r.createdAt === 'number' ? r.createdAt : Date.now(),
      updatedAt: Date.now(),
      roaster: typeof r.roaster === 'string' ? r.roaster : '',
      coffeeName: r.coffeeName,
      country: typeof r.country === 'string' ? r.country : '',
      region: typeof r.region === 'string' ? r.region : '',
      process: typeof r.process === 'string' ? r.process : '',
      variety: typeof r.variety === 'string' ? r.variety : '',
      altitude: typeof r.altitude === 'string' ? r.altitude : '',
      roastDate: typeof r.roastDate === 'string' ? r.roastDate : '',
      roastLevel: typeof r.roastLevel === 'string' ? r.roastLevel : '',
      verified: r.verified === true,
      source: typeof r.source === 'string' ? r.source : '',
      notes: typeof r.notes === 'string' ? r.notes : '',
      photos,
    })
  }
  return records
}
