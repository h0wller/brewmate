import { useState } from 'react'
import { loadSkillLevel, saveSkillLevel, LEVEL_LABEL, type SkillLevel } from './level'

export function SkillLevelPicker() {
  const [level, setLevel] = useState(loadSkillLevel())
  const pick = (l: SkillLevel) => { saveSkillLevel(l); setLevel(l) }
  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div className="grow">
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Уровень знаний</div>
        <div className="small" style={{ marginBottom: 8 }}>Влияет на подсказки и плотность интерфейса.</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {(Object.keys(LEVEL_LABEL) as SkillLevel[]).map(l => (
            <button key={l} className={'chip' + (level === l ? ' on' : '')}
              onClick={() => pick(l)} aria-pressed={level === l}>
              {LEVEL_LABEL[l]}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}