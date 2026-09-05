import { useState } from 'react'
import type { CuppingSession } from './types'
import { emptyLot, q, scaScore } from './cupping/sca'
import { uid } from './storage'

export function CuppingList({ sessions, onOpen, onCreate, onDelete }: {
  sessions: CuppingSession[]
  onOpen: (id: string) => void
  onCreate: (s: CuppingSession) => void
  onDelete: (id: string) => void
}) {
  const [creating, setCreating] = useState(false)
  const [title, setTitle] = useState('')
  const [n, setN] = useState(2)

  const create = () => {
    onCreate({
      id: uid(),
      title: title.trim() || `Каппинг ${new Date().toLocaleDateString('ru-RU')}`,
      form: 'sca',
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
              <button onClick={() => setN(v => Math.max(1, v - 1))}>−</button>
              <span className="val">{n}</span>
              <button onClick={() => setN(v => Math.min(8, v + 1))}>+</button>
            </div>
          </div>
          <button className="btn" onClick={create}>Создать (SCA)</button>
        </div>
      )}

      {sessions.map(s => {
        const best = Math.max(...s.lots.map(l => scaScore(l).total))
        return (
          <div className="card" key={s.id} onClick={() => onOpen(s.id)}>
            <div className="grow">
              <div>{s.title}</div>
              <div className="meta">{s.lots.length} лот. · лучший балл {q(best)}</div>
            </div>
            <button className="x" onClick={e => { e.stopPropagation(); onDelete(s.id) }}>×</button>
          </div>
        )
      })}

      {sessions.length === 0 && !creating && <div className="small">Нет сессий — создай первую 🧪</div>}
      <div className="small">Форма CoE — скоро 🚧</div>
    </div>
  )
}