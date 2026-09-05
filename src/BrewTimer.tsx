import type { Recipe } from './types'
import { fmt, useBrewTimer } from './useBrewTimer'

export function BrewTimer({ recipe }: { recipe: Recipe }) {
  const { status, elapsed, total, stepIndex, start, pause, resume, reset } =
    useBrewTimer(recipe)

  let acc = 0
  const rows = recipe.steps.map((s, i) => ({
    ...s,
    end: (acc += s.duration),
    i,
  }))
  const cur = rows[stepIndex]

  return (
    <div>
      <div className="time">{fmt(elapsed)}</div>

      <div className="bar">
        <div
          className="fill"
          style={{
            width: `${total ? Math.min(100, (elapsed / total) * 100) : 0}%`,
          }}
        />
      </div>

      {status !== 'idle' && cur && (
        <div className="now">
          <div className="note">{cur.note || `Шаг ${cur.i + 1}`}</div>
          <div className="sub">
            долить до {cur.pourTo} г · до {fmt(cur.end)}
          </div>
        </div>
      )}

      <ul className="steps">
        {rows.map((r) => (
          <li
            key={r.i}
            className={
              status !== 'idle' && r.i === stepIndex
                ? 'active'
                : r.i < stepIndex
                  ? 'past'
                  : ''
            }
          >
            <span className="t">{fmt(r.end)}</span>
            <span className="w">{r.pourTo} г</span>
            <span className="n">{r.note}</span>
          </li>
        ))}
      </ul>

      {status === 'idle' && (
        <button className="btn" onClick={start}>Старт</button>
      )}
      {status === 'run' && (
        <button className="btn secondary" onClick={pause}>Пауза</button>
      )}
      {status === 'pause' && (
        <>
          <button className="btn" onClick={resume}>Продолжить</button>
          <button className="btn secondary" onClick={reset}>Сброс</button>
        </>
      )}
      {status === 'done' && (
        <>
          <div className="now">
            <div className="note">Готово ☕️</div>
          </div>
          <button className="btn" onClick={reset}>Ещё раз</button>
        </>
      )}
    </div>
  )
}