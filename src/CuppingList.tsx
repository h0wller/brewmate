import { useState } from 'react'
import type { CuppingSession } from './types'
import { emptyLot, q, scoreFor } from './cupping/sca'
import { uid } from './storage'
import { clickableProps } from './a11y'

export function CuppingList({ sessions, onOpen, onCreate, onDelete }: {
  sessions: CuppingSession[]
  onOpen: (id: string) => void
  onCreate: (s: CuppingSession) => void
  onDelete: (id: string) => void
}) {
  const [creating, setCreating] = useState(false)
  const [title, setTitle] = useState('')
  const [n, setN] = useState(2)
  const [form, setForm] = useState<'sca' | 'coe'>('sca')

  const create = () => {
    onCreate({
      id: uid(),
      title: title.trim() || `Каппинг ${new Date().toLocaleDateString('ru-RU')}`,
      form,
      createdAt: Date.now(),
      lots: Array.from({ length: n }, (_, i) => emptyLot(`Лот ${i + 1}`)),
    })
    setCreating(false)
    setTitle('')
  }

  return (
    <div>
      <div className="header">
        <h1>Каппинг 🧪</h1>
        <button className="btn" style={{ width: 'auto', marginTop: 0, padding: '10px 18px' }}
          aria-label="Новый каппинг" aria-expanded={creating}
          onClick={() => setCreating(c => !c)}>+</button>
      </div>

      {creating && (
        <div className="card" style={{ display: 'block', cursor: 'default' }}>
          <div className="row">
            <label>Название</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Эфиопия vs Кения" />
          </div>
          <div className="row">
            <label>Лотов</label>
            <div className="stepper">
              <button aria-label="Меньше лотов" onClick={() => setN(v => Math.max(1, v - 1))}>−</button>
              <span className="val">{n}</span>
              <button aria-label="Больше лотов" onClick={() => setN(v => Math.min(8, v + 1))}>+</button>
            </div>
          </div>
          <div className="row">
            <label>Форма</label>
            <button className={'chip' + (form === 'sca' ? ' on' : '')} onClick={() => setForm('sca')}>SCA</button>
            <button className={'chip' + (form === 'coe' ? ' on' : '')} onClick={() => setForm('coe')}>CoE</button>
          </div>
          <button className="btn" onClick={create}>Создать</button>
        </div>
      )}

      {sessions.map(s => {
        const best = Math.max(...s.lots.map(l => scoreFor(s.form, l).total))
        return (
          <div className="card" key={s.id} {...clickableProps(() => onOpen(s.id))}>
            <div className="grow">
              <div>{s.title}</div>
              <div className="meta">
                {s.form.toUpperCase()} · {s.lots.length} лот. · лучший балл {q(best)}
              </div>
            </div>
            <button className="x" aria-label={`Удалить: ${s.title}`}
              onClick={e => { e.stopPropagation(); onDelete(s.id) }}>×</button>
          </div>
        )
      })}

      {sessions.length === 0 && !creating && <div className="small">Нет сессий — создай первую 🧪</div>}
    </div>
  )
}