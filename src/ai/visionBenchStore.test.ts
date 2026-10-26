import { describe, expect, it } from 'vitest'
import { exportVisionBench, importVisionBench } from './visionBenchStore'
import type { VisionBenchRecord } from './visionBenchStore'

const sample = (): VisionBenchRecord => ({
  id: 'sample-1', createdAt: 100, updatedAt: 200,
  roaster: 'Friday', coffeeName: 'Kenya Kirinyaga',
  country: 'Kenya', region: 'Kirinyaga', process: 'washed',
  variety: 'SL28', altitude: '1800–2000 m', roastDate: '2026-10-01',
  roastLevel: 'light', verified: true, source: 'label', notes: 'Сверено с пачкой',
  photos: [{ id: 'photo-1', name: 'front.jpg', type: 'image/jpeg', blob: new Blob([Uint8Array.from([1, 2, 3])], { type: 'image/jpeg' }) }],
})

describe('vision benchmark export/import', () => {
  it('сохраняет эталонные поля и фото при цикле экспорт → импорт', async () => {
    const json = await exportVisionBench([sample()])
    const file = new File([json], 'dataset.json', { type: 'application/json' })
    const imported = await importVisionBench(file)
    expect(imported).toHaveLength(1)
    expect(imported[0]).toMatchObject({
      id: 'sample-1', coffeeName: 'Kenya Kirinyaga', country: 'Kenya',
      process: 'washed', verified: true, source: 'label',
    })
    expect(imported[0].photos[0].name).toBe('front.jpg')
    expect(imported[0].photos[0].blob.type).toBe('image/jpeg')
    expect(Array.from(new Uint8Array(await imported[0].photos[0].blob.arrayBuffer()))).toEqual([1, 2, 3])
  })

  it('отклоняет JSON, который не является экспортом тестового набора', async () => {
    const file = new File(['{}'], 'bad.json', { type: 'application/json' })
    await expect(importVisionBench(file)).rejects.toThrow('Это не файл экспорта BrewMate AI Test')
  })

  it('отклоняет фотографии без поддерживаемого data URL', async () => {
    const json = JSON.stringify({
      format: 'brewmate-vision-bench', version: 1, records: [{
        id: 'sample-2', coffeeName: 'Test',
        photos: [{ id: 'p1', name: 'broken.jpg', dataUrl: 'file:///private/photo.jpg' }],
      }],
    })
    const file = new File([json], 'bad-photo.json', { type: 'application/json' })
    await expect(importVisionBench(file)).rejects.toThrow('Фото в JSON должно быть изображением')
  })
})
