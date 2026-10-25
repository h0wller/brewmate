import type { CuppingLot, Defect } from '../types'
import { uid } from '../storage'

/* ---------- SCA ---------- */
export const QUALITY_ATTRS: { key: string; label: string }[] = [
  { key: 'aroma', label: 'Аромат' },
  { key: 'flavor', label: 'Вкус' },
  { key: 'aftertaste', label: 'Послевкусие' },
  { key: 'acidity', label: 'Кислотность' },
  { key: 'body', label: 'Тело' },
  { key: 'balance', label: 'Баланс' },
  { key: 'overall', label: 'Общее впечатление' },
]

/* ---------- CoE (как в Beansy: 9 атрибутов) ----------
   Официальная форма CoE считает иначе (8 атрибутов + 36):
   если нужно — поменяй формулу в coeScore() */
export const COE_ATTRS: { key: string; label: string }[] = [
  { key: 'aroma', label: 'Аромат' },
  { key: 'clean', label: 'Чистота чашки' },
  { key: 'sweet', label: 'Сладость' },
  { key: 'acidity', label: 'Кислотность' },
  { key: 'mouthfeel', label: 'Тело (Mouth feel)' },
  { key: 'flavor', label: 'Вкус' },
  { key: 'aftertaste', label: 'Послевкусие' },
  { key: 'balance', label: 'Баланс' },
  { key: 'overall', label: 'Общее впечатление' },
]

export const CUP_ATTRS = [
  { key: 'sweetness', label: 'Сладость' },
  { key: 'uniformity', label: 'Однородность' },
  { key: 'clean', label: 'Чистота чашки' },
] as const

export const q = (v: number) => String(+v.toFixed(2))

/* дефолт оценки атрибута, если в лоте его нет — один источник правды для emptyLot и скоринга */
const ATTR_DEFAULT = 7

export const emptyLot = (name: string): CuppingLot => {
  const quality: Record<string, number> = {}
  for (const a of [...QUALITY_ATTRS, ...COE_ATTRS]) quality[a.key] ??= ATTR_DEFAULT
  return {
    id: uid(),
    name,
    quality,
    cups: {
      sweetness: Array(5).fill(true),
      uniformity: Array(5).fill(true),
      clean: Array(5).fill(true),
    },
    defects: [],
    notes: '',
  }
}

export const defectPoints = (d: Defect) =>
  d.intensity * d.cups * (d.type === 'fault' ? 2 : 1)

export function scaScore(l: CuppingLot) {
  const quality = QUALITY_ATTRS.reduce((s, a) => s + (l.quality[a.key] ?? ATTR_DEFAULT), 0) // /70
  const cups = (['sweetness', 'uniformity', 'clean'] as const)
    .reduce((s, k) => s + l.cups[k].filter(Boolean).length * 2, 0)              // /30
  const defects = l.defects.reduce((s, d) => s + defectPoints(d), 0)
  return { quality, cups, defects, total: quality + cups - defects }
}

export function coeScore(l: CuppingLot) {
  const quality = COE_ATTRS.reduce((s, a) => s + (l.quality[a.key] ?? ATTR_DEFAULT), 0)    // /90
  const cups = l.cups.uniformity.filter(Boolean).length * 2                    // /10
  const defects = l.defects.reduce((s, d) => s + defectPoints(d), 0)
  return { quality, cups, defects, total: quality + cups - defects }
}

export const scoreFor = (form: 'sca' | 'coe', l: CuppingLot) =>
  form === 'coe' ? coeScore(l) : scaScore(l)