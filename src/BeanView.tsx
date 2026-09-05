import { useRef, useState } from 'react'
import type { BeanProfile, Recipe } from './types'
import {
  LEVEL_LABEL, METHODS, analyzeBeanPhoto, daysSince, recommend, recipeFromBean,
} from './beans/engine'
import type { MethodKey, RoastLevel } from './beans/engine'

export function BeanView({ bean, onChange, onBack, onMakeRecipe }: {
  bean: BeanProfile
  onChange: (b: BeanProfile) => void
  onBack: () => void
  onMakeRecipe: (r: Recipe) => void
}) {
  const [method, setMethod] = useState<MethodKey>('v60')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const set = (p: Partial<BeanProfile>) => onChange({ ...bean, ...p })
  const rec = recommend(bean, method)
  const days = daysSince(bean.roastDate)

  const onPhoto = async (f: File) => {
    setBusy(true); setErr('')
    try {
      const res = await analyzeBeanPhoto(f)
      set({ agtron: res.agtron, roastLevel: res.level, photoColor: res.color })
    } catch (e) { setErr((e as Error).message) }
    setBusy(false)
  }

  return (
    <div>
      <button className="back" onClick={onBack}>← Зерно</button>
      <h1>{bean.name || 'Новое зерно'}</h1>

      <div className="row"><label>Название</label>
        <input value={bean.name} onChange={e => set({ name: e.target.value })} placeholder="Эфиопия Иргачефф" /></div>

      <div className="row"><label>Регион</label>
        <input value={bean.origin ?? ''} onChange={e => set({ origin: e.target.value })} placeholder="Yirgacheffe" /></div>

      <div className="row"><label>Обработка</label>
        {['washed', 'natural', 'honey', 'anaerobic'].map(p => (
          <button key={p} className={'chip' + (bean.process === p ? ' on' : '')}
            onClick={() => set({ process: p })}>{p}</button>
        ))}
      </div>

      <div className="row"><label>Обжарка</label>
        <input type="date" value={bean.roastDate ?? ''} onChange={e => set({ roastDate: e.target.value })} /></div>
      {days !== null && <div className="small">Обжарке: {days} дн.</div>}

      <div className="card" style={{ display: 'block', cursor: 'default' }}>
        <div className="small" style={{ margin: '0 0 8px' }}>
          Фото зерна — на белом фоне при дневном свете
        </div>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden
          onChange={e => { const f = e.target.files?.[0]; if (f) onPhoto(f); e.currentTarget.value = '' }} />
        <button className="btn secondary" onClick={() => fileRef.current?.click()}>
          {busy ? 'Анализирую…' : '📷 Сфоткать зерно'}
        </button>
        {err && <div className="small" style={{ color: '#ff6961' }}>{err}</div>}
        {bean.agtron !== undefined && (
          <div className="row" style={{ marginTop: 10 }}>
            {bean.photoColor && <span className="swatch" style={{ background: bean.photoColor }} />}
            <span className="swatchLabel">Agtron ≈ {bean.agtron}</span>
          </div>
        )}
        <div className="row" style={{ marginTop: 10 }}>
          <label>Уровень</label>
          {(['light', 'medium', 'dark'] as RoastLevel[]).map(l => (
            <button key={l} className={'chip' + (bean.roastLevel === l ? ' on' : '')}
              onClick={() => set({ roastLevel: l })}>{LEVEL_LABEL[l]}</button>
          ))}
        </div>
      </div>

      <div className="small">Метод</div>
      <div className="lotChips">
        {(Object.keys(METHODS) as MethodKey[]).map(m => (
          <button key={m} className={'chip' + (method === m ? ' on' : '')} onClick={() => setMethod(m)}>
            {METHODS[m].label}
          </button>
        ))}
      </div>

      <div className="card" style={{ display: 'block', cursor: 'default' }}>
        <div className="recBig">
          <div><div className="recVal">{rec.clicks}</div><div className="small">кликов Comandante</div></div>
          <div><div className="recVal">{rec.temp}°C</div><div className="small">вода</div></div>
          <div><div className="recVal">1:{rec.ratio}</div><div className="small">пропорция</div></div>
        </div>
        {rec.tips.map((t, i) => <div className="tip" key={i}>• {t}</div>)}
        <button className="btn" onClick={() => onMakeRecipe(recipeFromBean(bean, method, rec))}>
          Сделать рецепт → в таймер
        </button>
      </div>

      <div className="small">Заметки</div>
      <textarea value={bean.notes ?? ''} onChange={e => set({ notes: e.target.value })}
        placeholder="Дескрипторы, впечатления…" />
    </div>
  )
}