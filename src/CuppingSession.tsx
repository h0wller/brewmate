import { useState } from 'react'
import type { CuppingLot, CuppingSession, Defect, QualityAttr } from './types'
import { CUP_ATTRS, QUALITY_ATTRS, defectPoints, q, scaScore } from './cupping/sca'
import { uid } from './storage'

export function CuppingSessionView({ session, onChange, onBack }: {
  session: CuppingSession
  onChange: (s: CuppingSession) => void
  onBack: () => void
}) {
  const [lotId, setLotId] = useState(session.lots[0].id)
  const lot = session.lots.find(l => l.id === lotId) ?? session.lots[0]
  if (!lot) return null

  const update = (patch: Partial<CuppingLot>) =>
    onChange({ ...session, lots: session.lots.map(l => l.id === lot.id ? { ...l, ...patch } : l) })

  const s = scaScore(lot)

  const setQ = (k: QualityAttr, v: number) =>
    update({ quality: { ...lot.quality, [k]: Math.min(10, Math.max(6, v)) } })

  const toggleCup = (k: 'sweetness' | 'uniformity' | 'clean', i: number) => {
    const arr = [...lot.cups[k]]
    arr[i] = !arr[i]
    update({ cups: { ...lot.cups, [k]: arr } })
  }

  const setDef = (id: string, patch: Partial<Defect>) =>
    update({ defects: lot.defects.map(d => d.id === id ? { ...d, ...patch } : d) })

  return (
    <div>
      <button className="back" onClick={onBack}>← Каппинги</button>
      <h1>{session.title}</h1>

      <div className="lotChips">
        {session.lots.map(l => (
          <button key={l.id} className={'chip' + (l.id === lot.id ? ' on' : '')} onClick={() => setLotId(l.id)}>
            {l.name} · {q(scaScore(l).total)}
          </button>
        ))}
      </div>

      <div className="scoreBig">{q(s.total)}</div>
      <div className="small" style={{ textAlign: 'center', margin: '0 0 12px' }}>
        качество {q(s.quality)}/70 · чашки {q(s.cups)}/30 · дефекты −{q(s.defects)}
      </div>

      {QUALITY_ATTRS.map(a => (
        <div className="attrRow" key={a.key}>
          <span className="lbl">{a.label}</span>
          <div className="stepper">
            <button onClick={() => setQ(a.key, lot.quality[a.key] - 0.25)}>−</button>
            <span className="val">{q(lot.quality[a.key])}</span>
            <button onClick={() => setQ(a.key, lot.quality[a.key] + 0.25)}>+</button>
          </div>
        </div>
      ))}

      <div className="small">По чашкам · 2 балла за чашку</div>
      {CUP_ATTRS.map(c => (
        <div className="attrRow" key={c.key}>
          <span className="lbl">{c.label}</span>
          <div className="cups">
            {lot.cups[c.key].map((on, i) => (
              <button key={i} className={'cupBtn' + (on ? ' on' : '')} onClick={() => toggleCup(c.key, i)}>
                {i + 1}
              </button>
            ))}
          </div>
        </div>
      ))}

      <div className="small">Дефекты · интенсивность (1–3) × чашки × тип (taint ×1, fault ×2)</div>
      {lot.defects.map(d => (
        <div className="attrRow" key={d.id}>
          <button className={'chip' + (d.type === 'fault' ? ' fault' : '')}
            onClick={() => setDef(d.id, { type: d.type === 'taint' ? 'fault' : 'taint' })}>
            {d.type === 'taint' ? 'Taint' : 'Fault'}
          </button>
          <div className="stepper">
            <button onClick={() => setDef(d.id, { intensity: Math.max(1, d.intensity - 1) })}>−</button>
            <span className="val">{d.intensity}</span>
            <button onClick={() => setDef(d.id, { intensity: Math.min(3, d.intensity + 1) })}>+</button>
          </div>
          <div className="stepper">
            <button onClick={() => setDef(d.id, { cups: Math.max(1, d.cups - 1) })}>−</button>
            <span className="val">{d.cups}</span>
            <button onClick={() => setDef(d.id, { cups: Math.min(5, d.cups + 1) })}>+</button>
          </div>
          <span className="lbl" style={{ textAlign: 'right' }}>−{q(defectPoints(d))}</span>
          <button className="x" onClick={() => update({ defects: lot.defects.filter(x => x.id !== d.id) })}>×</button>
        </div>
      ))}
      <button className="btn secondary"
        onClick={() => update({ defects: [...lot.defects, { id: uid(), type: 'taint', intensity: 2, cups: 1 }] })}>
        + Дефект
      </button>

      <div className="small">Заметки</div>
      <textarea value={lot.notes ?? ''} onChange={e => update({ notes: e.target.value })}
        placeholder="Заметки по лоту…" />
    </div>
  )
}