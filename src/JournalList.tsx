import type { BrewLog } from './types'
import { fmt } from './useBrewTimer'
import { fmtDate, stars } from './brewlog/format'
import { clickableProps } from './a11y'

export function JournalList({ logs, onOpen }: {
  logs: BrewLog[]
  onOpen: (id: string) => void
}) {
  const sorted = [...logs].sort((a, b) => b.startedAt - a.startedAt)
  return (
    <div>
      <div className="header"><h1>Журнал 📓</h1></div>

      {sorted.map(l => (
        <div className="card" key={l.id} {...clickableProps(() => onOpen(l.id))}>
          <div className="grow">
            <div>{l.title}{l.rating ? <span className="stars"> {stars(l.rating)}</span> : null}</div>
            <div className="meta">
              {[
                fmtDate(l.startedAt),
                l.beanName,
                `${l.doseG} → ${l.finalG !== undefined ? Math.round(l.finalG) : l.waterG} г`,
                fmt(l.durationS),
              ].filter(Boolean).join(' · ')}
            </div>
          </div>
        </div>
      ))}

      {sorted.length === 0 && (
        <div className="small">
          Пока пусто. Сваришь кофе по рецепту — нажми «Записать в журнал» на экране таймера.
        </div>
      )}
    </div>
  )
}
