import type { BeanProfile, BrewLog } from './types'
import { CurveChart } from './CurveChart'
import { fmtDate } from './brewlog/format'
import { formatGrind } from './grinders/grind'
import { fmt } from './useBrewTimer'
import { stepStats } from './brewlog/curve'

export function LogView({ log, beans, canRepeat, onChange, onBack, onRepeat, onDelete }: {
  log: BrewLog
  beans: BeanProfile[]
  canRepeat: boolean         // исходный рецепт ещё существует
  onChange: (l: BrewLog) => void
  onBack: () => void
  onRepeat: () => void
  onDelete: (id: string) => void
}) {
  const set = (p: Partial<BrewLog>) => onChange({ ...log, ...p })

  const pickBean = (id: string) => {
    const b = beans.find(x => x.id === id)
    set({ beanId: b?.id, beanName: b ? (b.name || 'Без названия') : undefined })
  }

  /* если зерно удалили, запись всё равно показывает сохранённое имя */
  const beanKnown = !log.beanId || beans.some(b => b.id === log.beanId)

  return (
    <div>
      <button className="back" onClick={onBack}>← Журнал</button>
      <h1>{log.title}</h1>
      <div className="small" style={{ marginTop: 0 }}>{fmtDate(log.startedAt)}</div>

      <div className="card statGrid" style={{ cursor: 'default' }}>
        <div><div className="recVal">{fmt(log.durationS)}</div><div className="small">время</div></div>
        <div>
          <div className="recVal">{log.finalG !== undefined ? Math.round(log.finalG) : '—'}</div>
          <div className="small">г в итоге (план {log.waterG})</div>
        </div>
        <div><div className="recVal">{log.tempC}°</div><div className="small">вода</div></div>
      </div>
      <div className="small" style={{ marginTop: 0 }}>
        {log.doseG} г кофе{log.grind ? ` · ${formatGrind(log.grind, { withGrinder: true })}` : ''}
      </div>

      {log.curve && log.curve.length > 1
        ? <CurveChart curve={log.curve} steps={log.steps} durationS={log.durationS} />
        : <div className="small">Кривой нет: весы не были подключены.</div>}

      {log.curve && log.curve.length > 1 && (
        <>
          <div className="small">Шаги: план → факт</div>
          <ul className="steps stats">
            {stepStats(log.curve, log.steps).map(st => (
              <li key={st.index}>
                <span className="t">{fmt(st.end)}</span>
                <span className="n">{st.note || `Шаг ${st.index + 1}`}</span>
                <span className="w">
                  {st.actualG === null ? '—' : `${Math.round(st.actualG)}/${Math.round(st.planG)} г`}
                </span>
                <span className="w">
                  {st.actualRate === null ? '' : `${Math.max(0, st.actualRate).toFixed(1)}/${st.planRate.toFixed(1)}`}
                </span>
              </li>
            ))}
          </ul>
          <div className="small" style={{ marginTop: 0 }}>налито факт/план, г · скорость факт/план, г/с</div>
        </>
      )}

      <div className="small">Оценка</div>
      <div className="lotChips">
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n} className={'chip' + (log.rating === n ? ' on' : '')}
            aria-pressed={log.rating === n} aria-label={`Оценка: ${n} из 5`}
            onClick={() => set({ rating: log.rating === n ? undefined : n })}>
            {'★'.repeat(n)}
          </button>
        ))}
      </div>

      <div className="small">Зерно</div>
      <select className="select" value={log.beanId ?? ''} onChange={e => pickBean(e.target.value)}>
        <option value="">— не выбрано —</option>
        {!beanKnown && <option value={log.beanId}>{log.beanName ?? 'удалённое зерно'} (удалено)</option>}
        {beans.map(b => <option key={b.id} value={b.id}>{b.name || 'Без названия'}</option>)}
      </select>

      <div className="small">Заметки: вкус, что поменять в следующий раз</div>
      <textarea value={log.notes ?? ''} onChange={e => set({ notes: e.target.value })}
        placeholder="Кисло — помол мельче; горчит — вода холоднее…" />

      {canRepeat && <button className="btn" onClick={onRepeat}>☕ Сварить ещё раз по этому рецепту</button>}
      <button className="btn danger" onClick={() => onDelete(log.id)}>Удалить запись</button>
    </div>
  )
}
