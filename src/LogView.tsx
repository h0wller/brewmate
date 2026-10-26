import type { BeanProfile, BrewLog, Recipe } from './types'
import { loadDialInProfiles, saveDialInProfile, profileFromConfirmedLog, findDialInProfile } from './beans/dialInProfile'
import type { GrindCheck } from './grind/store'
import { BREW_TASTES, TASTE_LABEL } from './brewlog/taste'
import { CurveChart } from './CurveChart'
import { fmtDate } from './brewlog/format'
import { formatGrind } from './grinders/grind'
import { fmt } from './useBrewTimer'
import { stepStats } from './brewlog/curve'
import { assessTrialOutcome, assessTrialRepeatability, diagnoseNextCup, findBestComparableBrew, makeTrialRecipe } from './beans/dialIn'
import { useState } from 'react'

export function LogView({ log, sourceLog, history, beans, canRepeat, check, onChange, onBack, onRepeat, onCheckGrind, onDelete, onMakeTrial }: {
  log: BrewLog
  sourceLog?: BrewLog
  history: BrewLog[]
  beans: BeanProfile[]
  canRepeat: boolean         // исходный рецепт ещё существует
  check?: GrindCheck         // последний замер помола, привязанный к этой записи
  onChange: (l: BrewLog) => void
  onBack: () => void
  onRepeat: () => void
  onCheckGrind: () => void
  onDelete: (id: string) => void
  onMakeTrial: (recipe: Recipe) => void
}) {
  const set = (p: Partial<BrewLog>) => onChange({ ...log, ...p })
  const dialIn = diagnoseNextCup(log)
  const trial = makeTrialRecipe(log)
  const trialAssessment = log.trial ? assessTrialOutcome(sourceLog, log) : undefined
  const referenceAssessment = log.reference ? assessTrialOutcome(sourceLog, log) : undefined
  const comparable = findBestComparableBrew(log, history, { grinderId: log.grind?.grinder?.id, roastDate: log.beanRoastDate })
  const repeatabilitySource = log.trial && sourceLog ? sourceLog : log
  const repeatability = assessTrialRepeatability(repeatabilitySource, history)
  const profileAssessment = assessTrialRepeatability(repeatabilitySource, history, log.trial ? log : undefined)
  const candidateProfile = profileFromConfirmedLog(log, profileAssessment)
  const [profiles, setProfiles] = useState(loadDialInProfiles)
  const savedProfile = findDialInProfile(profiles, log.grind?.grinder?.id, log.method, log.beanId, log.beanRoastDate)
  const relatedTrials = history.filter(item => item.trial?.sourceLogId === log.id && item.method === log.method)

  const pickBean = (id: string) => {
    const b = beans.find(x => x.id === id)
    set({ beanId: b?.id, beanName: b ? (b.name || 'Без названия') : undefined })
  }

  /* если зерно удалили, запись всё равно показывает сохранённое имя */
  const beanKnown = !log.beanId || beans.some(b => b.id === log.beanId)

  return (
    <div>
      <button className="back" onClick={onBack}>← Журнал</button>
      <h1>{log.title}</h1>
      <div className="small" style={{ marginTop: 0 }}>{fmtDate(log.startedAt)}</div>

      <div className="card statGrid" style={{ cursor: 'default' }}>
        <div><div className="recVal">{fmt(log.durationS)}</div><div className="small">время</div></div>
        <div>
          <div className="recVal">{log.finalG !== undefined ? Math.round(log.finalG) : '—'}</div>
          <div className="small">г в итоге (план {log.waterG})</div>
        </div>
        <div><div className="recVal">{log.tempC}°</div><div className="small">вода</div></div>
      </div>
      <div className="small" style={{ marginTop: 0 }}>
        {log.doseG} г кофе{log.grind ? ` · ${formatGrind(log.grind, { withGrinder: true })}` : ''}
      </div>

      {!log.trial && !log.reference && relatedTrials.length > 0 && (
        <div className="card" style={{ display: 'block', cursor: 'default', marginTop: 12 }}>
          <b>Повторяемость настройки</b>
          <div className="small">
            {repeatability.trials} проб с сенсорными отметками · положительных {repeatability.positive} · ухудшений {repeatability.worse} · без ясного сигнала {repeatability.unchanged}.
          </div>
          <div><b>{repeatability.status === 'confirmed' ? 'Воспроизводимый результат' : repeatability.status === 'promising' ? 'Перспективный, но не окончательный' : repeatability.status === 'inconsistent' ? 'Результат пока нестабилен' : 'Недостаточно проб'}</b></div>
          <div>{repeatability.summary}</div>
        </div>
      )}

      {comparable && (
        <div className="card" style={{ display: 'block', cursor: 'default', marginTop: 12 }}>
          <b>Удачная чашка для этого зерна и метода</b>
          <div className="small">
            Исторический ориентир: {fmtDate(comparable.startedAt)} · оценка {comparable.rating}/5 · отмечен баланс.
          </div>
          <div>
            {comparable.doseG} г кофе / {comparable.waterG} г воды · {comparable.tempC} °C
            {comparable.grind ? ` · ${formatGrind(comparable.grind, { withGrinder: true })}` : ''}
          </div>
          <div className="small">
            Время {fmt(comparable.durationS)}
            {comparable.finalG !== undefined ? ` · выход ${comparable.finalG.toFixed(1)} г` : ''}.
            Это прошлый удачный результат, а не гарантия для другой партии или степени свежести.
          </div>
        </div>
      )}

      {log.curve && log.curve.length > 1
        ? <CurveChart curve={log.curve} steps={log.steps} durationS={log.durationS} />
        : <div className="small">Кривой нет: весы не были подключены.</div>}

      {log.curve && log.curve.length > 1 && (
        <>
          <div className="small">Шаги: план → факт</div>
          <ul className="steps stats">
            {stepStats(log.curve, log.steps).map(st => (
              <li key={st.index}>
                <span className="t">{fmt(st.end)}</span>
                <span className="n">{st.note || `Шаг ${st.index + 1}`}</span>
                <span className="w">
                  {st.actualG === null ? '—' : `${Math.round(st.actualG)}/${Math.round(st.planG)} г`}
                </span>
                <span className="w">
                  {st.actualRate === null ? '' : `${Math.max(0, st.actualRate).toFixed(1)}/${st.planRate.toFixed(1)}`}
                </span>
              </li>
            ))}
          </ul>
          <div className="small" style={{ marginTop: 0 }}>налито факт/план, г · скорость факт/план, г/с</div>
        </>
      )}

      {log.reference && (
        <div className="card" style={{ display: 'block', cursor: 'default', marginTop: 12 }}>
          <b>Рецепт на основе исторической чашки</b>
          <div className="small">
            Исходная чашка: {sourceLog?.title ?? 'запись недоступна'} · оценка при выборе: {log.reference.sourceRating}/5.
          </div>
          {sourceLog && (
            <div>
              Ориентир: {sourceLog.doseG} г / {sourceLog.waterG} г · {sourceLog.tempC} °C
              {' → '}
              Сейчас: {log.doseG} г / {log.waterG} г · {log.tempC} °C
            </div>
          )}
          {referenceAssessment && (
            <div style={{ marginTop: 8 }}>
              <b>{referenceAssessment.verdict === 'promising' ? 'Положительный сигнал' : referenceAssessment.verdict === 'worse' ? 'Возможное ухудшение' : referenceAssessment.verdict === 'mixed' ? 'Нет заметного изменения' : 'Пока недостаточно данных'}</b>
              <div>{referenceAssessment.summary}</div>
              {referenceAssessment.evidence.map((item, i) => <div className="small" key={i}>• {item}</div>)}
            </div>
          )}
        </div>
      )}

      {candidateProfile && (
        <div className="card" style={{ display: 'block', cursor: 'default', marginTop: 12 }}>
          <b>Повторяемая настройка подтверждена для этой пробы</b>
          <div className="small">
            Подтверждение основано на {candidateProfile.positiveTrials} положительных пробах из {candidateProfile.totalTrials}.
            Профиль сохраняется отдельно от ручной калибровки и привязан к зерну «{candidateProfile.beanName ?? candidateProfile.beanId}» и дате обжарки {candidateProfile.roastDate}.
          </div>
          <div>
            {candidateProfile.doseG} г кофе / {candidateProfile.waterG} г воды · {candidateProfile.tempC} °C
            {candidateProfile.grindSize ? ` · ${candidateProfile.grindSize}` : ''}
            {candidateProfile.grinderSetting ? ` · ${candidateProfile.grinderSetting}` : ''}
          </div>
          <button className="btn" onClick={() => {
            saveDialInProfile(candidateProfile)
            setProfiles(loadDialInProfiles())
          }}>
            {savedProfile?.sourceLogId === log.id ? 'Обновить сохранённый профиль' : 'Сохранить как профиль кофемолка × метод'}
          </button>
          <div className="small">Это подтверждённый снимок конкретной чашки, а не универсальный рецепт для любого зерна. Он не изменяет ручную калибровку кофемолки и не применяется автоматически к другим партиям.</div>
        </div>
      )}

      {log.trial && (
        <div className="card" style={{ display: 'block', cursor: 'default', marginTop: 12 }}>
          <b>Контролируемая проба</b>
          <div className="small">
            Проверяемый параметр: {log.trial.variable === 'dose' ? 'доза кофе' : 'крупность помола'}.
            Исходная чашка: {sourceLog?.title ?? 'запись недоступна'}.
          </div>
          {sourceLog && (
            <div>
              Было: {sourceLog.taste ? TASTE_LABEL[sourceLog.taste] : 'вкус не отмечен'}
              {sourceLog.rating !== undefined ? ` · оценка ${sourceLog.rating}/5` : ''}
              {' → '}
              Сейчас: {log.taste ? TASTE_LABEL[log.taste] : 'отметь вкус ниже'}
              {log.rating !== undefined ? ` · оценка ${log.rating}/5` : ''}
            </div>
          )}
          {trialAssessment && (
            <div style={{ marginTop: 8 }}>
              <b>{trialAssessment.verdict === 'promising' ? 'Положительный сигнал' : trialAssessment.verdict === 'worse' ? 'Возможное ухудшение' : trialAssessment.verdict === 'mixed' ? 'Нет заметного изменения' : 'Пока недостаточно данных'}</b>
              <div>{trialAssessment.summary}</div>
              {trialAssessment.evidence.map((item, i) => <div className="small" key={i}>• {item}</div>)}
            </div>
          )}
          <div className="small">Время и выход фиксируются как контекст, а не как оценка вкуса. Повтори удачную пробу, прежде чем считать настройку устойчивой.</div>
        </div>
      )}

      <div className="small">Оценка</div>
      <div className="lotChips">
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n} className={'chip' + (log.rating === n ? ' on' : '')}
            aria-pressed={log.rating === n} aria-label={`Оценка: ${n} из 5`}
            onClick={() => set({ rating: log.rating === n ? undefined : n })}>
            {'★'.repeat(n)}
          </button>
        ))}
      </div>

      <div className="small">Как на вкус</div>
      <div className="lotChips">
        {BREW_TASTES.map(t => (
          <button key={t} className={'chip' + (log.taste === t ? ' on' : '')} aria-pressed={log.taste === t}
            onClick={() => set({ taste: log.taste === t ? undefined : t })}>
            {TASTE_LABEL[t]}
          </button>
        ))}
      </div>

      {log.taste && (
        <div className="card" style={{ display: 'block', cursor: 'default', marginTop: 12 }}>
          <div><b>Следующая проба: {dialIn.title}</b></div>
          <div className="small">{dialIn.reason}</div>
          <div>{dialIn.action}</div>
          <div className="small">
            Методика: <a href={dialIn.sourceUrl} target="_blank" rel="noreferrer">Barista Hustle — Coffee Compass</a>.
            Это проверяемая гипотеза, не диагноз: вкус зависит также от зерна, обжарки, воды и равномерности экстракции.
          </div>
          {trial && <button className="btn" onClick={() => onMakeTrial(trial)}>Создать отдельный пробный рецепт</button>}
        </div>
      )}

      <div className="small">Зерно</div>
      <select className="select" value={log.beanId ?? ''} onChange={e => pickBean(e.target.value)}>
        <option value="">— не выбрано —</option>
        {!beanKnown && <option value={log.beanId}>{log.beanName ?? 'удалённое зерно'} (удалено)</option>}
        {beans.map(b => <option key={b.id} value={b.id}>{b.name || 'Без названия'}</option>)}
      </select>

      <div className="small">Заметки: вкус, что поменять в следующий раз</div>
      <textarea value={log.notes ?? ''} onChange={e => set({ notes: e.target.value })}
        placeholder="Кисло — помол мельче; горчит — вода холоднее…" />

      <button className="btn secondary" onClick={onCheckGrind}>📷 Проверить помол по фото</button>
      {check && (
        <div className="small" style={{ marginTop: 0 }}>
          Замер помола: настройка {check.setting}, типичный размер ≈ {check.d50} мкм
        </div>
      )}
      {canRepeat && <button className="btn" onClick={onRepeat}>☕ Сварить ещё раз по этому рецепту</button>}
      <button className="btn danger" onClick={() => onDelete(log.id)}>Удалить запись</button>
    </div>
  )
}
