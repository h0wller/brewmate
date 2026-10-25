import type { BeanProfile } from './types'
import { LEVEL_LABEL } from './beans/engine'
import { clickableProps } from './a11y'

export function BeansList({ beans, onOpen, onCreate, onDelete }: {
  beans: BeanProfile[]
  onOpen: (id: string) => void
  onCreate: () => void
  onDelete: (id: string) => void
}) {
  return (
    <div>
      <div className="header">
        <h1>Зерно 🫘</h1>
        <button className="btn" style={{ width: 'auto', marginTop: 0, padding: '10px 18px' }}
          aria-label="Добавить зерно" onClick={onCreate}>+</button>
      </div>

      {beans.map(b => (
        <div className="card" key={b.id} {...clickableProps(() => onOpen(b.id))}>
          <div className="grow">
            <div>{b.name || 'Без названия'}</div>
            <div className="meta">
              {[b.origin, b.process, b.roastLevel && LEVEL_LABEL[b.roastLevel]]
                .filter(Boolean).join(' · ') || 'нет данных'}
            </div>
          </div>
          <button className="x" aria-label={`Удалить: ${b.name || 'Без названия'}`}
            onClick={e => { e.stopPropagation(); onDelete(b.id) }}>×</button>
        </div>
      ))}

      {beans.length === 0 && <div className="small">Добавь первое зерно 🫘</div>}
    </div>
  )
}