import { useRef, useState } from 'react'
import type { BeanProfile, BrewStep, GrinderProfile, Recipe } from './types'
import {
  LEVEL_LABEL, METHODS, analyzeBeanPhoto, daysSince, recommend, recipeFromBean,
} from './beans/engine'
import type { MethodKey, RoastLevel } from './beans/engine'
import { askVision, buildPackagePrompt, fileToBase64, loadAIConfig } from './ai/client'
import type { AIConfig } from './ai/client'
import { AISettings } from './AISettings'
import { uid } from './storage'
import { SIZE_LABEL, isGrindSize, nudgeText } from './grinders/size'
import { grindFor, settingFor } from './grinders/profile'

const sanitizeSteps = (raw: any): BrewStep[] => {
  const arr = Array.isArray(raw) ? raw : []
  const steps = arr
    .map((s: any) => ({ duration: +s?.duration || 0, pourTo: +s?.pourTo || 0, note: String(s?.note ?? '') }))
    .filter((s: BrewStep) => s.duration > 0 && s.pourTo > 0)
  return steps.length
    ? steps
    : [{ duration: 45, pourTo: 45, note: 'блюм' }, { duration: 60, pourTo: 240, note: 'долить' }]
}

const pickBean = (b: any, base: BeanProfile): BeanProfile => ({
  ...base,
  name: typeof b?.name === 'string' && b.name ? b.name : base.name,
  origin: typeof b?.origin === 'string' ? b.origin : base.origin,
  process: typeof b?.process === 'string' ? b.process : base.process,
  roastLevel: ['light', 'medium', 'dark'].includes(b?.roastLevel) ? b.roastLevel as RoastLevel : base.roastLevel,
  roastDate: typeof b?.roastDate === 'string' ? b.roastDate : base.roastDate,
  notes: typeof b?.notes === 'string' && b.notes ? b.notes : base.notes,
})

export function BeanView({ bean, profile, onChange, onBack, onMakeRecipe, onOpenGrinder }: {
  bean: BeanProfile
  profile: GrinderProfile
  onOpenGrinder: () => void
  onChange: (b: BeanProfile) => void
  onBack: () => void
  onMakeRecipe: (r: Recipe) => void
}) {
  const [method, setMethod] = useState<MethodKey>('v60')
  const [busy, setBusy] = useState(false)
  const [busyAI, setBusyAI] = useState(false)
  const [err, setErr] = useState('')
  const [aiCfg, setAiCfg] = useState<AIConfig | null>(loadAIConfig)
  const [showSettings, setShowSettings] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const pkgRef = useRef<HTMLInputElement>(null)

  const set = (p: Partial<BeanProfile>) => onChange({ ...bean, ...p })
  const rec = recommend(bean, method)
  const mySetting = settingFor(profile, rec.size)
  const days = daysSince(bean.roastDate)

  const onPhoto = async (f: File) => {
    setBusy(true); setErr('')
    try {
      const res = await analyzeBeanPhoto(f)
      set({ agtron: res.agtron, roastLevel: res.level, photoColor: res.color })
    } catch (e) { setErr((e as Error).message) }
    setBusy(false)
  }

  const onPackage = async (f: File) => {
    if (!aiCfg) return
    setBusyAI(true); setErr('')
    try {
      const img = await fileToBase64(f)
      const out = await askVision(aiCfg, img, buildPackagePrompt(METHODS[method].label))
      const nb = pickBean(out.bean, bean)
      onChange(nb)
      const r = out.recipe ?? {}
      onMakeRecipe({
        id: uid(),
        title: r.title || `${nb.name || 'Зерно'} · AI · ${METHODS[method].label}`,
        method,
        doseG: 15,
        waterG: Math.round(15 * (+r.ratio || rec.ratio)),
        tempC: Math.max(85, Math.min(98, +r.tempC || rec.temp)),
        /* от AI берём только уровень крупности; настройку подставляем из калибровки пользователя,
           чтобы модель не выдумывала клики для чужой кофемолки */
        grind: grindFor(profile, isGrindSize(r.grindSize) ? r.grindSize : rec.size),
        steps: sanitizeSteps(r.steps),
        createdAt: Date.now(),
      })
    } catch (e) { setErr((e as Error).message) }
    setBusyAI(false)
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
        <div className="small" style={{ margin: '0 0 8px' }}>Фото зерна — на белом фоне при дневном свете</div>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden
          onChange={e => { const f = e.target.files?.[0]; if (f) onPhoto(f); e.currentTarget.value = '' }} />
        <button className="btn secondary" onClick={() => fileRef.current?.click()}>
          {busy ? 'Анализирую…' : '📷 Сфоткать зерно'}
        </button>
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

      <div className="small">AI</div>
      {showSettings ? (
        <AISettings
          initial={aiCfg}
          onDone={c => { setAiCfg(c); setShowSettings(false) }}
          onCancel={() => setShowSettings(false)}
        />
      ) : (
        <div className="card" style={{ display: 'block', cursor: 'default' }}>
          <input ref={pkgRef} type="file" accept="image/*" capture="environment" hidden
            onChange={e => { const f = e.target.files?.[0]; if (f) onPackage(f); e.currentTarget.value = '' }} />
          <button className="btn" onClick={() => aiCfg ? pkgRef.current?.click() : setShowSettings(true)}>
            {busyAI ? '🤖 Думаю…' : '🤖 Сфоткать пачку → AI-рецепт'}
          </button>
          <div className="small" style={{ margin: '8px 0 0' }}>
            {aiCfg ? `${aiCfg.provider} · ${aiCfg.model}` : 'AI не настроен'} ·{' '}
            <span style={{ color: '#4b8ef1', cursor: 'pointer' }} onClick={() => setShowSettings(true)}>настроить</span>
          </div>
        </div>
      )}

      {err && <div className="small" style={{ color: '#ff6961' }}>{err}</div>}

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
          <div>
            <div className={'recVal' + (mySetting ? '' : ' sm')}>{mySetting ?? SIZE_LABEL[rec.size]}</div>
            <div className="small">{mySetting ? SIZE_LABEL[rec.size] : 'помол'}{rec.nudge ? ` · ${nudgeText(rec.nudge)}` : ''}</div>
          </div>
          <div><div className="recVal">{rec.temp}°C</div><div className="small">вода</div></div>
          <div><div className="recVal">1:{rec.ratio}</div><div className="small">пропорция</div></div>
        </div>
        {!mySetting && (
          <div className="tip">
            {profile.grinder ? 'Для этого уровня нет твоей настройки' : 'Кофемолка не выбрана'} —{' '}
            <span style={{ color: '#4b8ef1', cursor: 'pointer' }} onClick={onOpenGrinder}>указать</span>
          </div>
        )}
        {rec.tips.map((t, i) => <div className="tip" key={i}>• {t}</div>)}
        <button className="btn" onClick={() => onMakeRecipe(recipeFromBean(bean, method, rec, grindFor(profile, rec.size)))}>
          Сделать рецепт → в таймер
        </button>
      </div>

      <div className="small">Заметки</div>
      <textarea value={bean.notes ?? ''} onChange={e => set({ notes: e.target.value })}
        placeholder="Дескрипторы, впечатления…" />
    </div>
  )
}