import type { Recipe } from './types'
import { fmt, useBrewTimer } from './useBrewTimer'
import { ScaleChip } from './ScaleChip'

export function BrewTimer({ recipe }: { recipe: Recipe }) {
  const {
    status, elapsed, total, stepIndex,
    liveG, setLiveG,
    start, pause, resume, reset,
  } = useBrewTimer(recipe)

  const ends = recipe.steps.reduce<number[]>((acc, s) => [...acc, (acc.at(-1) ?? 0) + s.duration], [])
  const rows = recipe.steps.map((s, i) => ({ ...s, end: ends[i], i }))
  const cur = rows[stepIndex]

  // прогресс по граммам, если подключены весы
  const progressPct = liveG !== null && cur && cur.pourTo > 0
    ? Math.min(100, Math.max(0, (liveG / cur.pourTo) * 100))
    : total ? Math.min(100, (elapsed / total) * 100) : 0

  return (
    <div>
      <div className="time">{fmt(elapsed)}</div>

      <div className="bar"><div className="fill" style={{ width: `${progressPct}%` }} /></div>

      <ScaleChip onWeight={setLiveG} />

      {status !== 'idle' && cur && (
        <div className="now">
          <div className="note">{cur.note || `Шаг ${cur.i + 1}`}</div>
          <div className="sub">
            долить до {cur.pourTo} г{liveG !== null ? ` · сейчас ${liveG.toFixed(1)} г` : ''} · до {fmt(cur.end)}
          </div>
        </div>
      )}

      <ul className="steps">
        {rows.map(r => (
          <li key={r.i}
            className={
              status !== 'idle' && r.i === stepIndex ? 'active'
              : r.i < stepIndex ? 'past'
              : (liveG !== null && r.pourTo <= liveG) ? 'done' : ''
            }>
            <span className="t">{fmt(r.end)}</span>
            <span className="w">{r.pourTo} г</span>
            <span className="n">{r.note}</span>
          </li>
        ))}
      </ul>

      {status === 'idle' && <button className="btn" onClick={start}>Старт</button>}
      {status === 'run' && <button className="btn secondary" onClick={pause}>Пауза</button>}
      {status === 'pause' && <>
        <button className="btn" onClick={resume}>Продолжить</button>
        <button className="btn secondary" onClick={reset}>Сброс</button>
      </>}
      {status === 'done' && <>
        <div className="now"><div className="note">Готово ☕️</div></div>
        <button className="btn" onClick={reset}>Ещё раз</button>
      </>}
    </div>
  )
}