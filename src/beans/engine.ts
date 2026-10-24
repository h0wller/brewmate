import type { BeanProfile, BrewStep, Grind, Recipe } from '../types'
import { uid } from '../storage'
import { GRIND_SIZES, describeCoarseness } from '../grinders/size'
import type { GrindSize } from '../grinders/size'

export type RoastLevel = 'light' | 'medium' | 'dark'
export type MethodKey = 'v60' | 'drip' | 'french' | 'aero' | 'cupping'

export const LEVEL_LABEL: Record<RoastLevel, string> = {
  light: 'светлая', medium: 'средняя', dark: 'тёмная',
}

/* Базовые настройки под среднюю обжарку. Помол — уровень общей шкалы крупности,
   а не клики конкретной кофемолки: в настройку своей кофемолки он переводится
   через калибровку пользователя (grinders/profile.ts). */
export const METHODS: Record<MethodKey, { label: string; ratio: number; size: GrindSize; temp: number; bloom: number }> = {
  v60: { label: 'V60', ratio: 16, size: 'medium_fine', temp: 93, bloom: 45 },
  drip: { label: 'Капельная', ratio: 15, size: 'medium', temp: 93, bloom: 30 },
  french: { label: 'Френч-пресс', ratio: 15, size: 'coarse', temp: 95, bloom: 0 },
  aero: { label: 'Аэропресс', ratio: 13, size: 'medium_fine', temp: 90, bloom: 0 },
  cupping: { label: 'Каппинг', ratio: 18, size: 'medium_coarse', temp: 94, bloom: 0 },
}

export const levelFromAgtron = (a: number): RoastLevel =>
  a >= 70 ? 'light' : a >= 55 ? 'medium' : 'dark'

export const daysSince = (iso?: string): number | null => {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (isNaN(t)) return null
  return Math.max(0, Math.floor((Date.now() - t) / 86400000))
}

/* Фото зерна → средний цвет → прикидка Agtron.
   Снимать на белом фоне при дневном свете. */
export function analyzeBeanPhoto(file: File): Promise<{ agtron: number; level: RoastLevel; color: string }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const size = 120
      const canvas = document.createElement('canvas')
      canvas.width = size; canvas.height = size
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, size, size)
      const { data } = ctx.getImageData(0, 0, size, size)
      let r = 0, g = 0, b = 0, n = 0
      for (let i = 0; i < data.length; i += 4) {
        const R = data[i], G = data[i + 1], B = data[i + 2]
        const lum = 0.2126 * R + 0.7152 * G + 0.0722 * B
        if (lum > 235) continue // белый фон
        if (lum < 15) continue  // тени
        r += R; g += G; b += B; n++
      }
      URL.revokeObjectURL(url)
      if (!n) { reject(new Error('Не вижу зерно в кадре — попробуй на белом фоне')); return }
      r /= n; g /= n; b /= n
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
      const agtron = Math.max(20, Math.min(95, Math.round((lum - 20) * 0.75 + 30)))
      resolve({ agtron, level: levelFromAgtron(agtron), color: `rgb(${r | 0},${g | 0},${b | 0})` })
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Не удалось открыть фото')) }
    img.src = url
  })
}

export interface Recommendation {
  coarseness: number          // дробная крупность: 0 — очень мелкий … 6 — очень крупный
  size: GrindSize             // ближайший уровень шкалы
  nudge: -1 | 0 | 1           // −1 «чуть мельче», +1 «чуть крупнее» относительно уровня
  temp: number; ratio: number; bloom: number; tips: string[]
}

export function recommend(bean: BeanProfile, method: MethodKey): Recommendation {
  const m = METHODS[method]
  let coarse = GRIND_SIZES.indexOf(m.size)   // в долях уровня шкалы
  let temp = m.temp
  let bloom = m.bloom
  const tips: string[] = []

  if (bean.roastLevel === 'dark') {
    coarse += 0.4; temp -= 3
    tips.push('Тёмная обжарка — помол крупнее и вода холоднее, чтобы не горчить.')
  }
  if (bean.roastLevel === 'light') {
    coarse -= 0.4; temp += 2
    tips.push('Светлая обжарка — мельче помол и горячее вода для плотной экстракции.')
  }

  const days = daysSince(bean.roastDate)
  if (days !== null) {
    if (days < 7) {
      coarse += 0.3; bloom += 15
      tips.push(`Свежее зерно (${days} дн.) — дегазация: блюм дольше на 15 сек.`)
    } else if (days > 30) {
      coarse -= 0.4
      tips.push(`Зерну ${days} дн. — мели мельче и используй скорее.`)
    }
  }

  if (bean.process === 'natural') {
    coarse += 0.3; temp -= 1
    tips.push('Натуральная обработка — слаще и растворимее: чуть крупнее помол.')
  }
  if (bean.process === 'anaerobic') {
    tips.push('Анаэробная ферментация — яркая чашка: начни с базового помола и слушай вкус.')
  }

  const { size, nudge } = describeCoarseness(coarse)
  return {
    coarseness: Math.max(0, Math.min(GRIND_SIZES.length - 1, coarse)),
    size,
    nudge,
    temp: Math.max(85, Math.min(98, temp)),
    ratio: m.ratio,
    bloom,
    tips,
  }
}

export function recipeFromBean(bean: BeanProfile, method: MethodKey, rec: Recommendation, grind: Grind): Recipe {
  const dose = 15
  const water = Math.round(dose * rec.ratio)
  let steps: BrewStep[]
  if (method === 'french') steps = [
    { duration: 60, pourTo: water, note: 'залить всю воду' },
    { duration: 240, pourTo: water, note: 'настоять 4 мин, снять корку' },
    { duration: 30, pourTo: water, note: 'продавить' },
  ]
  else if (method === 'aero') steps = [
    { duration: 30, pourTo: water, note: 'залить и перемешать' },
    { duration: 90, pourTo: water, note: 'продавить' },
  ]
  else steps = [
    { duration: rec.bloom, pourTo: dose * 3, note: 'блюм' },
    { duration: 30, pourTo: Math.round(water * 0.6), note: 'первое вливание' },
    { duration: 30, pourTo: water, note: 'второе вливание' },
  ]
  return {
    id: uid(),
    title: `${bean.name || 'Зерно'} · ${METHODS[method].label}`,
    method,
    doseG: dose,
    waterG: water,
    tempC: rec.temp,
    grind,
    steps,
    createdAt: Date.now(),
  }
}