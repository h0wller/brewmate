import { useEffect, useState } from 'react'
import { blobToDataUrl, saveVisionBenchRecord } from './ai/visionBenchStore'
import type { VisionBenchRecord, VisionBenchRun } from './ai/visionBenchStore'

type PublicProvider = { id: string; model: string; priority: number }
type ProviderList = { providers?: PublicProvider[]; maxImageChars?: number }

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
type PackageResult = { bean?: { origin?: string; process?: string; roastLevel?: string; roastDate?: string | null } }

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
        if (typeof body.maxImageChars === 'number' && body.maxImageChars >= 100_000) setMaxImageChars(body.maxImageChars)
      }
    }).catch(() => { if (active) setProviders([]) })
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
        <span>{providers.length ? providers.length + ' провайдеров настроено' : 'Список провайдеров недоступен'}</span>
      </div>
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
                    <span>{result?.bean?.origin || 'Происхождение не распознано'} · {result?.bean?.process || 'обработка не указана'} · {result?.bean?.roastLevel || 'обжарка не указана'}</span>
                    {score && <span className="benchScore">Совпадение по заполненным эталонным полям: {score.correct}/{score.total} ({Math.round(score.correct / score.total * 100)}%)</span>}
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}
      <p className="benchTip">Для сравнения используется первое фото записи. Каждый провайдер расходует отдельный AI-запрос; дневной лимит действует. Точность считается только по заполненным полям проверенного эталона: происхождению, обработке, уровню и дате обжарки.</p>
    </div>
  )
}
