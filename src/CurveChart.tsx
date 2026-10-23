import type { BrewStep, WeightSample } from './types'
import { chartBounds, chartPath, planPoints } from './brewlog/curve'

const W = 320
const H = 170

/* Кривая пролива: сплошная линия — вес с весов, пунктир — план из рецепта */
export function CurveChart({ curve, steps, durationS }: {
  curve: WeightSample[]
  steps: BrewStep[]
  durationS: number
}) {
  const plan = planPoints(steps)
  const { tMax, gMax } = chartBounds(curve, plan, durationS)
  const actual = chartPath(curve, tMax, gMax, W, H)
  const planned = chartPath(plan, tMax, gMax, W, H)
  if (!actual && !planned) return null

  return (
    <svg className="curve" viewBox={`0 0 ${W} ${H}`} role="img"
      aria-label="График веса по времени: факт и план">
      <path d={`M8 ${H - 8} H${W - 8}`} className="axis" />
      <path d={`M8 8 V${H - 8}`} className="axis" />
      {planned && <path d={planned} className="plan" />}
      {actual && <path d={actual} className="fact" />}
      <text x={W - 8} y={H - 12} textAnchor="end" className="axisLabel">
        {Math.floor(tMax / 60)}:{String(Math.round(tMax % 60)).padStart(2, '0')}
      </text>
      <text x={12} y={16} className="axisLabel">{Math.round(gMax / 1.05)} г</text>
    </svg>
  )
}
