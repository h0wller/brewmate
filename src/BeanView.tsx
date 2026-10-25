import { useRef, useState } from 'react'
import type { BeanProfile, BrewStep, GrinderProfile, Recipe } from './types'
import {
  LEVEL_LABEL, METHODS, WATER_PROFILES, analyzeBeanPhoto, daysSince, recommend, recipeFromBean,
} from './beans/engine'
import type { MethodKey, RoastLevel, WaterKey } from './beans/engine'
import { AIError, loadAIConfig, recognizePackage } from './ai/client'
import { prepareImage } from './ai/image'
import { fitStepsToWater } from './ai/fit'
import type { AIConfig } from './ai/client'
import { uid } from './storage'
import { SIZE_LABEL, GRIND_SIZES, isGrindSize, nudgeText } from './grinders/size'
import { grindFor, smartSettingFor } from './grinders/profile'
import { findGrinder } from './grinders/catalog'

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

export function BeanView({ bean, profile, onChange, onBack, onMakeRecipe, onOpenGrinder, onOpenAI }: {
  bean: BeanProfile
  profile: GrinderProfile
  onOpenGrinder: () => void
  onOpenAI: () => void
  onChange: (b: BeanProfile) => void
  onBack: () => void
  onMakeRecipe: (r: Recipe) => void
}) {
  const [method, setMethod] = useState<MethodKey>('v60')
  const [doseG, setDoseG] = useState(15)
  const [water, setWater] = useState<WaterKey>('balanced')
  const [busy, setBusy] = useState(false)
  const [busyAI, setBusyAI] = useState(false)
  const [err, setErr] = useState('')
  const [aiCfg] = useState<AIConfig | null>(loadAIConfig)
  const [errKind, setErrKind] = useState<AIError['kind'] | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const pkgRef = useRef<HTMLInputElement>(null)

  const set = (p: Partial<BeanProfile>) => onChange({ ...bean, ...p })
  const rec = recommend(bean, method, water, doseG)
  const mySetting = smartSettingFor(profile, rec.size, rec.coarseness)
  const grinderName = profile.grinder
    ? (findGrinder(profile.grinder.id)?.label ?? profile.grinder.label ?? profile.grinder.id)
    : null
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
    setBusyAI(true); setErr(''); setErrKind(null)
    try {
      const img = await prepareImage(f)
      const out = await recognizePackage(aiCfg, METHODS[method].label, img, { water, doseG })
      const nb = pickBean(out.bean, bean)
      onChange(nb)
      const r = out.recipe ?? {}
      /* Считаем точный coarseness для распознанного зерна, чтобы клики учитывали обжарку/обработку/воду */
      const nbRec = recommend(nb, method, water, doseG)
      const aiSize = isGrindSize(r.grindSize) ? r.grindSize : nbRec.size
      const aiCoarseness = isGrindSize(r.grindSize) ? GRIND_SIZES.indexOf(r.grindSize) + nbRec.nudge * 0.35 : nbRec.coarseness
      const recipeDose = +r.doseG || doseG
      const recipeRatio = +r.ratio || nbRec.ratio
      const waterG = Math.round(recipeDose * recipeRatio)
      onMakeRecipe({
        id: uid(),
        title: r.title || `${nb.name || 'Зерно'} · AI · ${METHODS[method].label}`,
        method,
        doseG: recipeDose,
        waterG,
        tempC: Math.max(85, Math.min(98, +r.tempC || nbRec.temp)),
        grind: grindFor(profile, aiSize, aiCoarseness),
        steps: fitStepsToWater(sanitizeSteps(r.steps), waterG),
        createdAt: Date.now(),
      })
    } catch (e) {
      setErr((e as Error).message)
      setErrKind(e instanceof AIError ? e.kind : null)
    }
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
        <div className="small" style={{ margin: '0 0 8px' }}>1. Фото зерна или пачки</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden
            onChange={e => { const f = e.target.files?.[0]; if (f) onPhoto(f); e.currentTarget.value = '' }} />
          <button className="btn secondary" style={{ marginTop: 0 }} onClick={() => fileRef.current?.click()}>
            {busy ? 'Анализирую…' : '📷 Фото зерна'}
          </button>

          <input ref={pkgRef} type="file" accept="image/*" capture="environment" hidden
            onChange={e => { const f = e.target.files?.[0]; if (f) onPackage(f); e.currentTarget.value = '' }} />
          <button className="btn" style={{ marginTop: 0 }} disabled={busyAI} onClick={() => pkgRef.current?.click()}>
            {busyAI ? '🤖 Думаю…' : '🤖 Фото пачки (AI)'}
          </button>
        </div>

        {bean.agtron !== undefined && (
          <div className="row" style={{ marginTop: 10 }}>
            {bean.photoColor && <span className="swatch" style={{ background: bean.photoColor }} />}
            <span className="swatchLabel">Agtron ≈ {bean.agtron}</span>
          </div>
        )}
        <div className="row" style={{ marginTop: 10 }}>
          <label>Обжарка</label>
          {(['light', 'medium', 'dark'] as RoastLevel[]).map(l => (
            <button key={l} className={'chip' + (bean.roastLevel === l ? ' on' : '')}
              onClick={() => set({ roastLevel: l })}>{LEVEL_LABEL[l]}</button>
          ))}
        </div>
      </div>

      <div className="small" style={{ margin: '0 0 8px' }}>
        {aiCfg
          ? `AI — свой ключ: ${aiCfg.provider} · ${aiCfg.model}`
          : 'AI по фото пачки — бесплатно, несколько раз в день. Без лимита — со своим ключом.'}{' '}
        <span style={{ color: '#4b8ef1', cursor: 'pointer' }} onClick={onOpenAI}>
          {aiCfg ? 'изменить' : 'свой ключ'}
        </span>
      </div>

      {err && <div className="small" style={{ color: '#ff6961' }}>{err}</div>}
      {(errKind === 'limit_user' || errKind === 'limit_global') && (
        <button className="btn secondary" onClick={onOpenAI}>🔑 Добавить свой ключ</button>
      )}

      <div className="small">2. Кофемолка</div>
      <div className="card" onClick={onOpenGrinder}>
        <div className="grow">
          <div>🔧 {grinderName ?? 'Выбрать кофемолку'}</div>
          <div className="meta">
            {grinderName
              ? `Помол пересчитывается под ${grinderName}`
              : 'Нажми, чтобы выбрать модель из каталога (Comandante, 1Zpresso, Timemore и др.)'}
          </div>
        </div>
        <span style={{ color: '#4b8ef1', fontSize: 14 }}>изменить →</span>
      </div>

      <div className="small">3. Метод заваривания</div>
      <div className="lotChips">
        {(Object.keys(METHODS) as MethodKey[]).map(m => (
          <button key={m} className={'chip' + (method === m ? ' on' : '')} onClick={() => setMethod(m)}>
            {METHODS[m].label}
          </button>
        ))}
      </div>

      <div className="small">4. Доза кофе</div>
      <div className="lotChips" style={{ alignItems: 'center' }}>
        {[15, 18, 30, 60].map(d => (
          <button key={d} className={'chip' + (doseG === d ? ' on' : '')} onClick={() => setDoseG(d)}>
            {d} г
          </button>
        ))}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginLeft: 4 }}>
          <input
            className="num"
            type="number"
            min={1}
            max={500}
            value={doseG || ''}
            onChange={e => setDoseG(Math.max(1, +e.target.value))}
            style={{ width: 68, padding: '6px 8px', fontSize: 14 }}
          />
          <span style={{ fontSize: 13, color: '#98989f' }}>г</span>
        </div>
      </div>

      <div className="small">5. Вода (по желанию)</div>
      <div className="lotChips">
        {(Object.keys(WATER_PROFILES) as WaterKey[]).map(w => (
          <button key={w} className={'chip' + (water === w ? ' on' : '')} onClick={() => setWater(w)}>
            {WATER_PROFILES[w].label}
          </button>
        ))}
      </div>
      <div className="small" style={{ marginTop: 0 }}>{WATER_PROFILES[water].sub}</div>

      <div className="card" style={{ display: 'block', cursor: 'default', marginTop: 12 }}>
        <div className="recBig">
          <div>
            <div className={'recVal' + (mySetting ? '' : ' sm')}>{mySetting ?? SIZE_LABEL[rec.size]}</div>
            <div className="small">
              {mySetting ? `${grinderName ?? 'помол'} · ${SIZE_LABEL[rec.size]}` : 'помол'}
              {rec.nudge ? ` (${nudgeText(rec.nudge)})` : ''}
            </div>
          </div>
          <div><div className="recVal">{rec.temp}°C</div><div className="small">вода</div></div>
          <div><div className="recVal">{Math.round(doseG * rec.ratio)} г</div><div className="small">{doseG} г · 1:{rec.ratio}</div></div>
        </div>
        {!mySetting && (
          <div className="tip">
            {profile.grinder ? 'Для своей кофемолки можно указать клики' : 'Выбери кофемолку для расчёта кликов'} —{' '}
            <span style={{ color: '#4b8ef1', cursor: 'pointer' }} onClick={onOpenGrinder}>указать</span>
          </div>
        )}
        {rec.tips.map((t, i) => <div className="tip" key={i}>• {t}</div>)}
        <button className="btn" onClick={() => onMakeRecipe(recipeFromBean(bean, method, rec, grindFor(profile, rec.size, rec.coarseness), doseG))}>
          Сделать рецепт → в таймер
        </button>
      </div>

      <div className="small">Заметки</div>
      <textarea value={bean.notes ?? ''} onChange={e => set({ notes: e.target.value })}
        placeholder="Дескрипторы, впечатления…" />
    </div>
  )
}