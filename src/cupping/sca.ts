import type { CuppingLot, Defect, QualityAttr } from '../types'
import { uid } from '../storage'

export const QUALITY_ATTRS: { key: QualityAttr; label: string }[] = [
  { key: 'aroma', label: 'Аромат' },
  { key: 'flavor', label: 'Вкус' },
  { key: 'aftertaste', label: 'Послевкусие' },
  { key: 'acidity', label: 'Кислотность' },
  { key: 'body', label: 'Тело' },
  { key: 'balance', label: 'Баланс' },
  { key: 'overall', label: 'Общее впечатление' },
]

export const CUP_ATTRS = [
  { key: 'sweetness', label: 'Сладость' },
  { key: 'uniformity', label: 'Однородность' },
  { key: 'clean', label: 'Чистота чашки' },
] as const

export const q = (v: number) => String(+v.toFixed(2))

export const emptyLot = (name: string): CuppingLot => ({
  id: uid(),
  name,
  quality: { aroma: 7, flavor: 7, aftertaste: 7, acidity: 7, body: 7, balance: 7, overall: 7 },
  cups: {
    sweetness: Array(5).fill(true),
    uniformity: Array(5).fill(true),
    clean: Array(5).fill(true),
  },
  defects: [],
  notes: '',
})

export const defectPoints = (d: Defect) =>
  d.intensity * d.cups * (d.type === 'fault' ? 2 : 1)

export function scaScore(l: CuppingLot) {
  const quality = QUALITY_ATTRS.reduce((s, a) => s + (l.quality[a.key] ?? 0), 0)
  const cups = (['sweetness', 'uniformity', 'clean'] as const)
    .reduce((s, k) => s + l.cups[k].filter(Boolean).length * 2, 0)
  const defects = l.defects.reduce((s, d) => s + defectPoints(d), 0)
  return { quality, cups, defects, total: quality + cups - defects }
}