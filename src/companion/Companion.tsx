import { useState } from 'react'
import { loadAIConfig, askChat, askCompanion } from '../ai/client'

/* Плавающий «компаньон»: чат с AI по контексту. Работает со своим ключом;
   без ключа подсказывает, как его добавить. */
import type { BeanProfile, BrewLog, GrinderProfile, Recipe } from '../types'
import { loadSkillLevel } from './level'
import type { BeanRecipeSelection } from './types'
import { recipeAdvice } from './scenarios/recipeFromBean'
import { extractionAdvice } from './scenarios/extractionAdvice'
import { explainTerm } from './scenarios/termExplain'
import { waterAdvice } from './scenarios/waterSettings'
import { grinderCalibrationAdvice } from './scenarios/grinderCalibration'

export function Companion({ context = '', bean, log, profile, recipe, recipeSelection }: {
  context?: string
  bean?: BeanProfile
  log?: BrewLog
  profile?: GrinderProfile
  recipe?: Recipe
  recipeSelection?: BeanRecipeSelection
}) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [msgs, setMsgs] = useState<{ role: 'user' | 'assistant'; text: string }[]>([])
  const [busy, setBusy] = useState(false)
  const [scenario, setScenario] = useState<'recipe' | 'extract' | 'term'>('term')

  const say = (text: string) => setMsgs(m => [...m, { role: 'assistant', text }])
  const runScenario = (sc: 'recipe' | 'extract' | 'term') => {
    setScenario(sc)
    if (sc === 'recipe') {
      if (!bean) {
        say('Откройте карточку зерна, выберите метод, дозу и воду — соберу рецепт с учётом этих параметров.')
        return
      }
      const selection = recipeSelection?.beanId === bean.id ? recipeSelection : undefined
      if (!selection?.method || !selection.dose) {
        say('В карточке зерна выберите метод заваривания и дозу — тогда рекомендация будет рассчитана под ваш выбор.')
        return
      }
      say(recipeAdvice(bean, selection.method, selection.dose, selection.water ?? 'balanced', loadSkillLevel()))
    }
    else if (sc === 'extract') say(log ? extractionAdvice(log) : 'Откройте запись в журнале — разберу экстракцию.')
    else say(explainTerm('dose'))
  }

  const send = async () => {
    const q = input.trim()
    if (!q || busy) return
    setInput('')
    setMsgs(m => [...m, { role: 'user', text: q }])
    const cfg = loadAIConfig()
    if (!cfg?.apiKey || !cfg.baseUrl) {
      setBusy(true)
      try {
        const reply = await askCompanion(q, context)
        setMsgs(m => [...m, { role: 'assistant', text: reply || '…' }])
      } catch (e) {
        setMsgs(m => [...m, { role: 'assistant', text: 'Бесплатный компаньон недоступен: ' + (e as Error).message }])
      } finally {
        setBusy(false)
      }
      return
    }
    setBusy(true)
    try {
      const history = msgs.map(m => ({ role: m.role, content: m.text }))
      const system = context ? `Контекст пользователя: ${context}. Отвечай на русском, кратко и по делу.` : 'Отвечай на русском, кратко и по делу.'
      const reply = await askChat(cfg, [{ role: 'system', content: system }, ...history, { role: 'user', content: q }])
      setMsgs(m => [...m, { role: 'assistant', text: reply || '…' }])
    } catch (e) {
      setMsgs(m => [...m, { role: 'assistant', text: 'Ошибка: ' + (e as Error).message }])
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button className="companion-fab" aria-label="Открыть компаньона" onClick={() => setOpen(o => !o)}>☕?</button>
      {open && (
        <div className="companion-panel">
          <div className="companion-head">
            <strong>Компаньон</strong>
            <button className="x" aria-label="Закрыть" onClick={() => setOpen(false)}>×</button>
          </div>
          <div className="companion-scenarios">
            {(['recipe','extract','term'] as const).map(sc => (
              <button key={sc} className={'chip' + (scenario === sc ? ' on' : '')}
                onClick={() => runScenario(sc)} aria-pressed={scenario === sc}>
                {sc === 'recipe' ? 'Рецепт по зерну' : sc === 'extract' ? 'Совет по экстракции' : 'Объяснить термин'}
              </button>
            ))}
          </div>
          <div className="companion-msgs" role="log" aria-label="Сообщения компаньона" aria-live="polite" aria-relevant="additions text">
            {context && <div className="companion-context">Я вижу: {context}</div>}
            {msgs.length === 0 && <div className="small">Спроси что-нибудь про кофе, рецепт или зерно.</div>}
            {msgs.map((m, i) => (
              <div key={i} className={'companion-msg ' + m.role}>{m.text}</div>
            ))}
            {busy && <div className="companion-msg assistant">…думаю</div>}
          </div>
          <div className="companion-actions">
            <button className="chip" onClick={() => say(waterAdvice('balanced') + '\n\n' + waterAdvice('soft') + '\n\n' + waterAdvice('hard'))}>Настройка воды</button>
            <button className="chip" onClick={() => say(grinderCalibrationAdvice(profile ?? { calibration: {} }, recipe))}>Калибровка кофемолки</button>
          </div>
          <div className="companion-input">
            <input value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229) { e.preventDefault(); void send() } }}
              placeholder="Вопрос…" aria-label="Вопрос компаньону" maxLength={500} />
            <button className="btn" style={{ width: 'auto', marginTop: 0, padding: '8px 12px' }} onClick={send} disabled={busy}>→</button>
          </div>
        </div>
      )}
    </>
  )
}