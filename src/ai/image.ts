import { fileToBase64 } from './client'

/* Подготовка фото для AI: уменьшаем до 1024 px по длинной стороне и сжимаем в JPEG.
   Снимок с телефона весит 3–8 МБ; после сжатия — 100–300 КБ: быстрее по мобильной сети,
   проходит ограничение сервера и расходует меньше бесплатной квоты провайдеров. */
export const MAX_SIDE = 1024
export const MAX_DATA_URL_CHARS = 1_400_000      // чуть меньше лимита сервера (1 500 000)

/* Размер после уменьшения с сохранением пропорций */
export function fitSize(w: number, h: number, maxSide = MAX_SIDE): { w: number; h: number } {
  const k = Math.min(1, maxSide / Math.max(w, h))
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) }
}

async function render(file: File, maxSide: number, quality: number): Promise<string> {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
  try {
    const { w, h } = fitSize(bmp.width, bmp.height, maxSide)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas недоступен')
    ctx.drawImage(bmp, 0, 0, w, h)
    return canvas.toDataURL('image/jpeg', quality)
  } finally {
    bmp.close()
  }
}

export async function prepareImage(file: File): Promise<string> {
  try {
    let out = await render(file, MAX_SIDE, 0.8)
    if (out.length > MAX_DATA_URL_CHARS) out = await render(file, 768, 0.7)
    if (out.length > MAX_DATA_URL_CHARS) throw new Error('слишком большое фото')
    return out
  } catch {
    /* браузер не умеет сжимать (старый Safari и т. п.) — отправляем как есть, если влезает */
    const raw = await fileToBase64(file)
    if (raw.length > MAX_DATA_URL_CHARS) throw new Error('Фото слишком большое для отправки. Сфотографируй ещё раз при меньшем разрешении.')
    return raw
  }
}

/* Уже загруженный снимок (пиксели с холста) → JPEG для AI, тот же предел размера, что и у фото пачки */
export function imageDataToJpeg(img: ImageData): string {
  const src = document.createElement('canvas')
  src.width = img.width; src.height = img.height
  src.getContext('2d')!.putImageData(img, 0, 0)
  for (const [side, q] of [[MAX_SIDE, 0.8], [768, 0.7]] as const) {
    const { w, h } = fitSize(img.width, img.height, side)
    const dst = document.createElement('canvas')
    dst.width = w; dst.height = h
    dst.getContext('2d')!.drawImage(src, 0, 0, w, h)
    const out = dst.toDataURL('image/jpeg', q)
    if (out.length <= MAX_DATA_URL_CHARS) return out
  }
  throw new Error('слишком большое фото')
}
