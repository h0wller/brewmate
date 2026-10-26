import { useRef, useState } from 'react'
import type { BeanProfile, BrewLog, GrinderProfile, Recipe } from './types'
import {
  LEVEL_LABEL, METHODS, WATER_PROFILES, analyzeBeanPhoto, daysSince, recommend, recipeFromBean,
} from './beans/engine'
import type { MethodKey, RoastLevel, WaterKey } from './beans/engine'
import type { GrindSize } from './grinders/size'
import { BREWING_PRINCIPLES, BREW_KNOWLEDGE } from './beans/knowledge'
import { recipeFromBestHistoricalBrew, summarizeBeanHistory } from './beans/dialIn'
import { AIError, loadAIConfig, recognizePackage } from './ai/client'
import { prepareImage } from './ai/image'
import { buildAIResult } from './ai/recipe'
import type { AIConfig } from './ai/client'
import { SIZE_LABEL, nudgeText } from './grinders/size'
import { grindFor, smartSettingFor } from './grinders/profile'
import { findGrinder } from './grinders/catalog'
import { NumField } from './NumField'
import { inRange } from './numField'
import { clickableProps } from './a11y'
import { loadDialInProfiles, findDialInProfile } from './beans/dialInProfile'
import { uid } from './storage'

const DOSES = [15, 18, 30, 60]
const PROCESS_LABEL: Record<string, string> = {
  washed: 'Мытый', natural: 'Натуральный', honey: 'Хани', anaerobic: 'Анаэробная ферментация',
}

export function BeanView({ bean, profile, history, onChange, onBack, onMakeRecipe, onOpenGrinder, onOpenGrindHelp, onOpenAI }: {
  bean: BeanProfile
  profile: GrinderProfile
  history: BrewLog[]
  onOpenGrinder: () => void
  onOpenGrindHelp: () => void
  onOpenAI: () => void
  onChange: (b: BeanProfile) => void
  onBack: () => void
  onMakeRecipe: (r: Recipe) => void
}) {
  /* ничего не выбрано заранее: метод, доза и вода — осознанный выбор пользователя */
  const [method, setMethod] = useState<MethodKey | null>(null)
  const [dose, setDose] = useState<number | null>(null)
  const [water, setWater] = useState<WaterKey | null>(null)
  const [busy, setBusy] = useState(false)
  const [busyAI, setBusyAI] = useState(false)
  const [err, setErr] = useState('')
  const [aiCfg] = useState<AIConfig | null>(loadAIConfig)
  const [errKind, setErrKind] = useState<AIError['kind'] | null>(null)
  /* результат AI показываем на этом экране и не уводим пользователя в редактор без спроса */
  const [aiResult, setAiResult] = useState<{ recipe: Recipe; bean: BeanProfile } | null>(null)
  const [dialInProfiles] = useState(loadDialInProfiles)
  const fileRef = useRef<HTMLInputElement>(null)
  const pkgRef = useRef<HTMLInputElement>(null)

  const set = (p: Partial<BeanProfile>) => onChange({ ...bean, ...p })
  const doseOk = inRange(dose, 1, 500)
  const ready = method !== null && doseOk
  const rec = ready ? recommend(bean, method, water ?? 'balanced', dose) : null
  const mySetting = rec ? smartSettingFor(profile, rec.size, rec.coarseness) : undefined
  const historicalRecipe = method !== null && doseOk && dose !== null
    ? recipeFromBestHistoricalBrew(bean, method, dose, history, { grinderId: profile.grinder?.id, roastDate: bean.roastDate })
    : undefined
  const historyEvidence = method !== null
    ? summarizeBeanHistory(bean, method, profile.grinder?.id, history)
    : null
  const savedDialIn = method !== null
    ? findDialInProfile(dialInProfiles, profile.grinder?.id, method, { matchBean: true, beanId: bean.id, matchRoastDate: true, roastDate: bean.roastDate })
    : undefined
  const applicableDialIn = savedDialIn && savedDialIn.beanId === bean.id && savedDialIn.roastDate === bean.roastDate
    ? savedDialIn
    : undefined
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
    if (!ready) return
    setBusyAI(true); setErr(''); setErrKind(null); setAiResult(null)
    try {
      const img = await prepareImage(f)
      const out = await recognizePackage(aiCfg, METHODS[method].label, img, {
        water: water ?? undefined, doseG: dose,
        bean: {
          ...(bean.process === 'washed' || bean.process === 'natural' || bean.process === 'honey' || bean.process === 'anaerobic' ? { process: bean.process } : {}),
          ...(bean.roastLevel ? { roastLevel: bean.roastLevel } : {}),
          ...(bean.roastDate ? { roastDate: bean.roastDate } : {}),
        },
      })
      const res = buildAIResult(out, { bean, method, doseG: dose, water: water ?? 'balanced', profile })
      onChange(res.bean)
      setAiResult(res)
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

      <div className="row" style={{ flexWrap: 'wrap' }}><label>Обработка</label>
        {['washed', 'natural', 'honey', 'anaerobic'].map(p => (
          <button key={p} className={'chip' + (bean.process === p ? ' on' : '')}
            onClick={() => set({ process: p })}>{PROCESS_LABEL[p] ?? p}</button>
        ))}
      </div>

      <div className="row"><label>Обжарка</label>
        <input type="date" value={bean.roastDate ?? ''} onChange={e => set({ roastDate: e.target.value })} /></div>
      {days !== null && <div className="small">Обжарке: {days} дн.</div>}

      <div className="small">1. Метод заваривания</div>
      <div className="lotChips">
        {(Object.keys(METHODS) as MethodKey[]).map(m => (
          <button key={m} className={'chip' + (method === m ? ' on' : '')} onClick={() => setMethod(method === m ? null : m)}>
            {METHODS[m].label}
          </button>
        ))}
      </div>

      <div className="small">2. Доза кофе</div>
      <div className="doseRow">
        {DOSES.map(d => (
          <button key={d} className={'chip' + (dose === d ? ' on' : '')} onClick={() => setDose(dose === d ? null : d)}>
            {d} г
          </button>
        ))}
        <span className="doseOwn">
          <NumField value={dose} onValue={setDose} decimal label="Своя доза, г" placeholder="своя" />
          <span className="unit">г</span>
        </span>
      </div>
      {dose !== null && !doseOk && <div className="small" style={{ color: '#ff6961', marginTop: 0 }}>Доза от 1 до 500 г</div>}

      <div className="small">3. Вода (по желанию)</div>
      <div className="lotChips">
        {(Object.keys(WATER_PROFILES) as WaterKey[]).map(w => (
          <button key={w} className={'chip' + (water === w ? ' on' : '')} onClick={() => setWater(water === w ? null : w)}>
            {WATER_PROFILES[w].label}
          </button>
        ))}
      </div>
      {water && <div className="small" style={{ marginTop: 0 }}>{WATER_PROFILES[water].sub}</div>}

      <div className="small">4. Кофемолка</div>
      <div className="card" {...clickableProps(onOpenGrinder)}>
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

      <div className="small">5. Фото</div>
      <div className="card" style={{ display: 'block', cursor: 'default' }}>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden
          onChange={e => { const f = e.target.files?.[0]; if (f) onPhoto(f); e.currentTarget.value = '' }} />
        <input ref={pkgRef} type="file" accept="image/*" capture="environment" hidden
          onChange={e => { const f = e.target.files?.[0]; if (f) onPackage(f); e.currentTarget.value = '' }} />
        <button className="btn" style={{ marginTop: 0 }} disabled={busyAI || !ready} onClick={() => pkgRef.current?.click()}>
          {busyAI ? '🤖 Думаю…' : '🤖 Фото пачки → AI-рецепт'}
        </button>
        <div className="small" style={{ margin: '6px 0 0' }}>
          {ready
            ? `Рецепт будет под: ${METHODS[method].label}, ${dose} г кофе${water ? `, вода: ${WATER_PROFILES[water].label.replace(/^\S+\s/, '').toLowerCase()}` : ''}.`
            : 'Сначала выбери метод и дозу — рецепт по фото пачки собирается именно под них.'}
        </div>
        <button className="btn secondary" onClick={() => fileRef.current?.click()}>
          {busy ? 'Анализирую…' : '📷 Фото зерна — определить обжарку'}
        </button>
        {bean.agtron !== undefined && (
          <div className="row" style={{ marginTop: 10 }}>
            {bean.photoColor && <span className="swatch" style={{ background: bean.photoColor }} />}
            <span className="swatchLabel">Agtron ≈ {bean.agtron}</span>
          </div>
        )}
        <div className="row" style={{ marginTop: 10, flexWrap: 'wrap' }}>
          <label>Обжарка</label>
          {(['light', 'medium', 'dark'] as RoastLevel[]).map(l => (
            <button key={l} className={'chip' + (bean.roastLevel === l ? ' on' : '')}
              onClick={() => set({ roastLevel: bean.roastLevel === l ? undefined : l })}>{LEVEL_LABEL[l]}</button>
          ))}
        </div>
        <div className="small" style={{ margin: '8px 0 0' }}>
          {aiCfg
            ? `AI — свой ключ: ${aiCfg.provider} · ${aiCfg.model}`
            : 'AI по фото пачки — бесплатно, несколько раз в день. Без лимита — со своим ключом.'}{' '}
          <button type="button" className="linkBtn" onClick={onOpenAI}>
            {aiCfg ? 'изменить' : 'свой ключ'}
          </button>
        </div>
      </div>

      {err && <div className="small" style={{ color: '#ff6961' }}>{err}</div>}
      {(errKind === 'limit_user' || errKind === 'limit_global') && (
        <button className="btn secondary" onClick={onOpenAI}>🔑 Добавить свой ключ</button>
      )}

      {aiResult && (
        <div className="card aiResult" style={{ display: 'block', cursor: 'default' }}>
          <div style={{ fontWeight: 600 }}>🤖 Пачка распознана</div>
          <div className="meta">
            {[aiResult.bean.name, aiResult.bean.origin, aiResult.bean.process ? PROCESS_LABEL[aiResult.bean.process] ?? aiResult.bean.process : undefined,
              aiResult.bean.roastLevel && LEVEL_LABEL[aiResult.bean.roastLevel]].filter(Boolean).join(' · ') || 'данные с пачки не нашлись'}
            {' — записано в карточку зерна выше'}
          </div>
          <div style={{ marginTop: 10 }}>Рецепт: <b>{aiResult.recipe.title}</b></div>
          <div className="meta">
            {aiResult.recipe.doseG} г кофе · {aiResult.recipe.waterG} г воды · {aiResult.recipe.tempC}°C
            {aiResult.recipe.grind?.size ? ` · помол: ${SIZE_LABEL[aiResult.recipe.grind.size]}` : ''}
            {aiResult.recipe.grind?.setting ? ` (${aiResult.recipe.grind.setting})` : ''}
            {` · шагов: ${aiResult.recipe.steps.length}`}
          </div>
          <div className="small" style={{ marginTop: 8 }}>
            Расчётные числа здесь берёт тот же локальный движок, что и в подсказке ниже: AI помогает распознать данные пачки, но не угадывает клики или параметры заваривания. Так сохраняется единая логика рекомендаций.
          </div>
          <button className="btn" onClick={() => onMakeRecipe(aiResult.recipe)}>Открыть рецепт →</button>
          <button className="btn secondary" onClick={() => setAiResult(null)}>Не нужен</button>
        </div>
      )}

      {rec && ready ? (
        <div className="card" style={{ display: 'block', cursor: 'default', marginTop: 12 }}>
          <div className="small" style={{ margin: '0 0 6px' }}>Подсказка без фото: {METHODS[method].label}, {dose} г</div>
          <div className="recBig">
            <div>
              <div className={'recVal sm'}>{mySetting ?? SIZE_LABEL[rec.size]}</div>
              <div className="small">
                {mySetting ? `${grinderName ?? 'помол'} · ${SIZE_LABEL[rec.size]}` : 'помол'}
                {rec.nudge ? ` (${nudgeText(rec.nudge)})` : ''}
              </div>
            </div>
            <div><div className="recVal">{rec.temp}<span className="u">°C</span></div><div className="small">вода</div></div>
            <div>
              <div className="recVal">{Math.round(dose * rec.ratio)}<span className="u"> г</span></div>
              <div className="small">воды · 1:{rec.ratio}</div>
            </div>
          </div>
          {!mySetting && (
            <div className="tip">
              {profile.grinder ? 'Для своей кофемолки можно указать клики' : 'Выбери кофемолку для расчёта кликов'} —{' '}
              <button type="button" className="linkBtn" onClick={onOpenGrinder}>указать</button>
            </div>
          )}
          {rec.tips.map((t, i) => <div className="tip" key={i}>• {t}</div>)}
          <div className="tip">
            <b>Принципы и источники:</b>
            {BREWING_PRINCIPLES.map(principle => (
              <div key={principle.id}>
                {principle.rule}
                {principle.sources.map(source => (
                  <div key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.publisher}: {source.title}</a></div>
                ))}
              </div>
            ))}
          </div>
          {method === 'moccamaster' && (
            <div className="tip">
              <b>Источники профиля Moccamaster:</b>
              {BREW_KNOWLEDGE.moccamaster.sources.map(source => (
                <div key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.publisher}: {source.title}</a></div>
              ))}
              <div>Предсмачивание показано как опциональный эксперимент, а не требование производителя.</div>
            </div>
          )}
          <div className="tip">
            Не уверен в помоле? <button type="button" className="linkBtn" onClick={onOpenGrindHelp}>Проверить по фото</button>
          </div>
          <button className="btn" onClick={() => onMakeRecipe(recipeFromBean(bean, method, rec, grindFor(profile, rec.size, rec.coarseness), dose))}>
            Сделать рецепт → в таймер
          </button>
          {savedDialIn && (
            <div className="card" style={{ display: 'block', cursor: 'default', marginTop: 12 }}>
              <b>Сохранённый профиль · {METHODS[method!].label}</b>
              <div className="small">
                {savedDialIn.positiveTrials}/{savedDialIn.totalTrials} положительных проб · зерно: {savedDialIn.beanName ?? savedDialIn.beanId ?? 'не указано'} · обжарка: {savedDialIn.roastDate ?? 'не указана'}.
              </div>
              <div>
                {savedDialIn.doseG} г / {savedDialIn.waterG} г · {savedDialIn.tempC} °C
                {savedDialIn.grindSize ? ` · ${SIZE_LABEL[savedDialIn.grindSize] ?? savedDialIn.grindSize}` : ''}
                {savedDialIn.grinderSetting ? ` · ${savedDialIn.grinderSetting}` : ''}
              </div>
              {applicableDialIn ? (
                <button className="btn" onClick={() => {
                  const scale = doseOk && dose !== null ? dose / applicableDialIn.doseG : 1
                  onMakeRecipe({
                    id: uid(),
                    title: `${bean.name || 'Зерно'} · личный подтверждённый профиль`,
                    method: applicableDialIn.method,
                    beanId: bean.id,
                    beanRoastDate: bean.roastDate,
                    doseG: doseOk && dose !== null ? dose : applicableDialIn.doseG,
                    waterG: Math.round(applicableDialIn.waterG * scale),
                    tempC: applicableDialIn.tempC,
                    grind: profile.grinder ? {
                      grinder: profile.grinder,
                      size: applicableDialIn.grindSize as GrindSize | undefined,
                      setting: applicableDialIn.grinderSetting,
                    } : undefined,
                    steps: applicableDialIn.steps.map(step => ({ ...step, pourTo: Math.round(step.pourTo * scale) })),
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                  })
                }}>Использовать этот профиль для рецепта</button>
              ) : (
                <div className="small">Профиль сохранён для другой партии или даты обжарки. Он не будет автоматически применён к этому зерну.</div>
              )}
              <div className="small">Профиль хранится отдельно от ручной калибровки и не переносит настройку на другие кофемолки.</div>
            </div>
          )}

          {historyEvidence && historyEvidence.brews > 0 && (
            <div className="card" style={{ display: 'block', cursor: 'default', marginTop: 12 }}>
              <b>Данные твоих завариваний</b>
              <div className="small">
                Сопоставимых чашек: {historyEvidence.brews}
                {historyEvidence.roastDate ? ` · обжарка ${historyEvidence.roastDate}` : ' · дата обжарки не указана'}.
                Учитываются только то же зерно, метод, кофемолка и совпадающая дата обжарки.
              </div>
              <div>
                {historyEvidence.meanRatio !== undefined ? `Среднее соотношение: 1:${historyEvidence.meanRatio}` : ''}
                {historyEvidence.ratioRange ? ` (наблюдалось 1:${historyEvidence.ratioRange[0].toFixed(1)}–1:${historyEvidence.ratioRange[1].toFixed(1)})` : ''}
                {historyEvidence.medianTempC !== undefined ? ` · медианная температура: ${historyEvidence.medianTempC} °C` : ''}
                {historyEvidence.tempRange ? ` (диапазон ${historyEvidence.tempRange[0]}–${historyEvidence.tempRange[1]} °C)` : ''}
              </div>
              <div className="small">
                <b>{historyEvidence.confidence === 'repeatable' ? 'Повторяющийся положительный сигнал' : historyEvidence.confidence === 'early-signal' ? 'Предварительный сигнал' : 'Пока нет надёжного сигнала'}</b>
                {' · '}{historyEvidence.confidenceNote}
              </div>
              <div className="small">
                {historyEvidence.ratedBrews
                  ? `Средняя оценка: ${historyEvidence.meanRating}/5 по ${historyEvidence.ratedBrews} чашкам`
                  : 'Оценки чашек пока не записаны'}
                {` · отмечен баланс: ${historyEvidence.balancedBrews}`}
              </div>
              {historyEvidence.grindSizes.length > 0 && (
                <div className="small">Уровни помола в истории: {historyEvidence.grindSizes.map(size => SIZE_LABEL[size as keyof typeof SIZE_LABEL] ?? size).join(', ')}. Это записи шкалы крупности, а не конвертация кликов между кофемолками.</div>
              )}
            </div>
          )}

          {historicalRecipe && (
            <div className="tip" style={{ marginTop: 10 }}>
              <b>Есть удачная чашка из истории</b>
              <div>Для этого зерна и метода есть запись с оценкой не ниже 4/5 и отмеченным балансом. Можно использовать её как альтернативную стартовую точку.</div>
              <div className="small">Сохраняются температура и настройка помола из той чашки; доза и вода масштабируются пропорционально. Проверь, что помол по-прежнему подходит текущей партии.</div>
              <button className="btn secondary" onClick={() => onMakeRecipe(historicalRecipe)}>Использовать исторический рецепт</button>
            </div>
          )}
      ) : (
        <div className="small">Выбери метод и дозу — покажу помол, температуру и воду.</div>
      )}

      <div className="small">Заметки</div>
      <textarea value={bean.notes ?? ''} onChange={e => set({ notes: e.target.value })}
        placeholder="Дескрипторы, впечатления…" />
    </div>
  )
}