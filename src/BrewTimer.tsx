import type { LogDraft, Recipe } from './types'
import { fmt, useBrewTimer } from './useBrewTimer'
import { ScaleChip } from './ScaleChip'
import { finalWeight } from './brewlog/curve'

export function BrewTimer({ recipe, onLog }: { recipe: Recipe; onLog?: (d: LogDraft) => void }) {
  const {
    status, elapsed, total, stepIndex,
    liveG, setLiveG, flow, getCurve,
    start, pause, resume, reset,
  } = useBrewTimer(recipe)

  /* запись в журнал: рецепт копируется «снимком», кривая — только если были весы */
  const logBrew = () => {
    const curve = getCurve()
    onLog?.({
      recipeId: recipe.id,
      trial: recipe.trial,
      reference: recipe.reference,
      title: recipe.title,
      method: recipe.method,
      doseG: recipe.doseG,
      waterG: recipe.waterG,
      tempC: recipe.tempC,
      grind: recipe.grind,
      steps: recipe.steps,
      durationS: Math.round(elapsed),
      finalG: finalWeight(curve),
      curve: curve.length ? curve : undefined,
    })
  }

  const ends = recipe.steps.reduce<number[]>((acc, s) => [...acc, (acc.at(-1) ?? 0) + s.duration], [])
  const rows = recipe.steps.map((s, i) => ({ ...s, end: ends[i], i }))
  const cur = rows[stepIndex]
  /* план скорости вливания на текущем шаге, г/с */
  const planRate = cur && cur.duration > 0
    ? (cur.pourTo - (cur.i > 0 ? rows[cur.i - 1].pourTo : 0)) / cur.duration
    : 0

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
          {flow !== null && (
            <div className="sub">
              скорость {Math.max(0, flow).toFixed(1)} г/с{planRate > 0 ? ` · по плану ${planRate.toFixed(1)}` : ''}
            </div>
          )}
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
        {onLog && <button className="btn secondary" onClick={logBrew}>📓 Закончить и записать в журнал</button>}
        <button className="btn secondary" onClick={reset}>Сброс</button>
      </>}
      {status === 'done' && <>
        <div className="now"><div className="note">Готово ☕️</div></div>
        {onLog && <button className="btn" onClick={logBrew}>📓 Записать в журнал</button>}
        <button className="btn secondary" onClick={reset}>Ещё раз</button>
      </>}
    </div>
  )
}