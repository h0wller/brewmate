import { useEffect, useState } from 'react'
import { blobToDataUrl, saveVisionBenchRecord } from './ai/visionBenchStore'
import type { VisionBenchRecord, VisionBenchRun } from './ai/visionBenchStore'

type PublicProvider = { id: string; model: string; priority: number }
type ProviderStatus = { id: string; model: string; configured: boolean }
type ProviderList = { providers?: PublicProvider[]; providerStatus?: ProviderStatus[]; maxImageChars?: number }

async function prepareImage(blob: Blob, maxImageChars: number): Promise<string> {
  const targetChars = Math.max(10_000, maxImageChars - 10_000)
  if (blob.size * 4 / 3 < targetChars) return blobToDataUrl(blob)
  const url = URL.createObjectURL(blob)
  try {
    const image = new Image()
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('Не удалось прочитать фото. Попробуй JPEG, PNG или WebP.'))
      image.src = url
    })
    let scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight))
    for (let attempt = 0; attempt < 7; attempt++) {
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Браузер не поддерживает обработку фото.')
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      for (const quality of [0.86, 0.76, 0.66, 0.56]) {
        const compressed = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', quality))
        if (compressed && compressed.size * 4 / 3 < targetChars) return blobToDataUrl(compressed)
      }
      scale *= 0.8
    }
    throw new Error('Фото не удалось сжать до лимита сервера. Используй фото меньшего размера.')
  } finally {
    URL.revokeObjectURL(url)
  }
}
type PackageResult = { bean?: { name?: string; origin?: string; notes?: string; process?: string; roastLevel?: string; roastDate?: string | null }; recipe?: { title?: string } }

const PROCESS_LABELS: Record<string, string> = { washed: 'мытая', natural: 'натуральная', honey: 'хани', anaerobic: 'анаэробная', other: 'другая' }
const ROAST_LABELS: Record<string, string> = { light: 'светлая', medium: 'средняя', dark: 'тёмная' }
const formatDate = (timestamp: number) => new Date(timestamp).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })

function normalized(value: string) {
  return value.normalize('NFKC').toLocaleLowerCase().replace(/[ё]/g, 'е').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}

function scoreRun(record: VisionBenchRecord, run: VisionBenchRun) {
  if (!record.verified || !run.result || typeof run.result !== 'object') return null
  const bean = (run.result as PackageResult).bean
  if (!bean) return null
  const checks: boolean[] = []
  if (record.process) checks.push(bean.process === record.process)
  if (record.roastLevel) checks.push(bean.roastLevel === record.roastLevel)
  if (record.roastDate) checks.push(bean.roastDate === record.roastDate)
  const originParts = [record.country, record.region].filter(Boolean).map(normalized)
  if (originParts.length) {
    const origin = normalized(bean.origin ?? '')
    checks.push(originParts.every(part => part.length > 0 && origin.includes(part)))
  }
  return checks.length ? { correct: checks.filter(Boolean).length, total: checks.length } : null
}

async function errorMessage(response: Response) {
  const body = await response.json().catch(() => ({})) as { error?: string; message?: string }
  if (body.error === 'limit') return 'Достигнут дневной лимит AI.'
  if (body.error === 'busy') return 'AI-провайдеры временно недоступны.'
  if (body.error === 'provider_unavailable') return 'Провайдер не настроен на сервере.'
  return body.message || body.error || 'HTTP ' + response.status
}

export function VisionBenchRunner({ record, onComplete }: { record: VisionBenchRecord; onComplete: () => Promise<void> }) {
  const [providers, setProviders] = useState<PublicProvider[]>([])
  const [providerStatus, setProviderStatus] = useState<ProviderStatus[]>([])
  const [providerListError, setProviderListError] = useState('')
  const [maxImageChars, setMaxImageChars] = useState(1_500_000)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)

  useEffect(() => {
    let active = true
    fetch('/api/vision').then(async response => {
      if (!response.ok) throw new Error('Не удалось получить список AI-провайдеров.')
      const body = await response.json() as ProviderList
      if (active) {
        setProviders(Array.isArray(body.providers) ? body.providers : [])
        setProviderStatus(Array.isArray(body.providerStatus) ? body.providerStatus : [])
        setProviderListError('')
        if (typeof body.maxImageChars === 'number' && body.maxImageChars > 0) setMaxImageChars(body.maxImageChars)
      }
    }).catch((error: unknown) => { if (active) { setProviders([]); setProviderStatus([]); setProviderListError(error instanceof Error ? error.message : 'Не удалось загрузить конфигурацию AI.') } })
    return () => { active = false }
  }, [])

  const run = async () => {
    if (!record.verified) {
      setMessage('Сначала отметь эталонные поля как проверенные.')
      setIsError(true)
      return
    }
    if (!providers.length) {
      setMessage('На сервере не настроено ни одного AI-провайдера.')
      setIsError(true)
      return
    }
    const photo = record.photos[0]
    setBusy(true)
    setMessage('')
    setIsError(false)
    const runs: VisionBenchRun[] = [...(record.benchmarkRuns ?? [])]
    try {
      const image = await prepareImage(photo.blob, maxImageChars)
      for (const provider of providers) {
        setMessage('Проверяю ' + provider.id + ' · ' + provider.model + '…')
        let nextRun: VisionBenchRun
        try {
          const response = await fetch('/api/vision', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ task: 'package', methodLabel: 'V60', image, providerId: provider.id }),
          })
          if (!response.ok) {
            nextRun = { providerId: provider.id, model: provider.model, photoId: photo.id, ranAt: Date.now(), error: await errorMessage(response) }
          } else {
            const body = await response.json() as { result: unknown; provider: string }
            nextRun = { providerId: body.provider || provider.id, model: provider.model, photoId: photo.id, ranAt: Date.now(), result: body.result }
          }
        } catch (error) {
          nextRun = { providerId: provider.id, model: provider.model, photoId: photo.id, ranAt: Date.now(), error: error instanceof Error ? error.message : 'Сетевая ошибка' }
        }
        const oldIndex = runs.findIndex(item => item.providerId === nextRun.providerId && item.photoId === photo.id)
        if (oldIndex >= 0) runs.splice(oldIndex, 1)
        runs.push(nextRun)
        await saveVisionBenchRecord({ ...record, benchmarkRuns: [...runs], updatedAt: Date.now() })
        if (nextRun.error && nextRun.error.includes('лимит')) break
      }
      await onComplete()
      setMessage('Готово. Проверено первое фото: ' + photo.name + '. Результаты сохранены локально.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Не удалось выполнить тест.')
      setIsError(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="benchResults">
      <div className="benchRunnerHead">
        <strong>Сравнение моделей</strong>
        <span>{providers.length ? providers.length + ' провайдеров настроено' : 'Нет настроенных провайдеров'}</span>
      </div>
      {providerListError && <p className="benchRunError">Не удалось загрузить список провайдеров: {providerListError}</p>}
      {providerStatus.length > 0 && <div className="benchProviderList" aria-label="Статус AI-провайдеров">
        {providerStatus.map(provider => <div className="benchProviderStatus" key={provider.id}>
          <span>{provider.id} · {provider.model}</span>
          <strong className={provider.configured ? 'isConfigured' : 'isMissing'}>{provider.configured ? 'настроен' : 'нет API-ключа'}</strong>
        </div>)}
      </div>}
      <button type="button" className="chip" disabled={busy || !record.verified || !providers.length} onClick={() => void run()}>
        {busy ? 'Тестирую…' : 'Проверить моделями (' + providers.length + ')'}
      </button>
      {message && <p className={isError ? 'benchRunError' : 'benchRunnerMessage'} role={isError ? 'alert' : 'status'}>{message}</p>}
      {record.benchmarkRuns && record.benchmarkRuns.length > 0 && (
        <div className="benchRunList">
          {record.benchmarkRuns.map((item, index) => {
            const score = scoreRun(record, item)
            const result = item.result && typeof item.result === 'object' ? item.result as PackageResult : undefined
            return (
              <div className="benchRun" key={item.providerId + '-' + item.photoId + '-' + item.ranAt + '-' + index}>
                <div><strong>{item.providerId}</strong><span>{item.model}</span></div>
                {item.error ? <span className="benchRunError">{item.error}</span> : (
                  <>
                    <span className="benchRunTimestamp">Завершено: {formatDate(item.ranAt)} · фото: {record.photos.find(photo => photo.id === item.photoId)?.name || 'фото не найдено'}</span>
                    <div className="benchModelFields">
                      <div><span>Название, по версии модели</span><strong>{result?.bean?.name || 'не распознано'}</strong></div>
                      <div><span>Происхождение</span><strong>{result?.bean?.origin || 'не распознано'}</strong></div>
                      <div><span>Обработка</span><strong>{result?.bean?.process ? PROCESS_LABELS[result.bean.process] || result.bean.process : 'не указана'}</strong></div>
                      <div><span>Обжарка</span><strong>{result?.bean?.roastLevel ? ROAST_LABELS[result.bean.roastLevel] || result.bean.roastLevel : 'не указана'}</strong></div>
                      <div><span>Дата обжарки</span><strong>{result?.bean?.roastDate || 'не распознана'}</strong></div>
                      <div><span>Рецепт</span><strong>{result?.recipe?.title || 'не предложен'}</strong></div>
                      <div className="benchModelNotes"><span>Описание / tasting notes</span><p>{result?.bean?.notes || 'модель не вернула описание'}</p></div>
                    </div>
                    {score && <span className="benchScore">Совпадение с эталоном: {score.correct}/{score.total} ({Math.round(score.correct / score.total * 100)}%). Это сравнение заполненных полей, а не общая точность модели.</span>}
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}
      <p className="benchTip">Для сравнения используется первое фото записи. Каждый провайдер расходует отдельный AI-запрос; дневной лимит действует. Ответ модели — это распознавание с фотографии, а не подтверждённые факты. Совпадение считается только по заполненным полям проверенного эталона.</p>
    </div>
  )
}
