import { useEffect, useState } from 'react'
import type { BeanProfile, BrewLog, CuppingSession, LogDraft, Recipe } from './types'
import {
  loadBeans, loadDeleted, loadLogs, loadRecipes, loadSessions,
  saveBeans, saveDeleted, saveLogs, saveRecipes, saveSessions, uid,
} from './storage'
import { stamp } from './sync/merge'
import type { Tombstones } from './sync/merge'
import { BrewTimer } from './BrewTimer'
import { RecipeEditor } from './RecipeEditor'
import { CuppingList } from './CuppingList'
import { CuppingSessionView } from './CuppingSession'
import { BeansList } from './BeansList'
import { BeanView } from './BeanView'
import { SyncSettings } from './SyncSettings'
import { JournalList } from './JournalList'
import { LogView } from './LogView'
import { loadSyncConfig } from './sync/sync'
import { GrinderSettings } from './GrinderSettings'
import { AISettings } from './AISettings'
import { loadAIConfig } from './ai/client'
import { formatGrind } from './grinders/grind'
import { loadProfile, saveProfile } from './grinders/profile'
import { tabOf } from './route'
import type { Route } from './route'
import { goBack, navigate, useRoute } from './useRoute'
import { clickableProps } from './a11y'

/* Запись по ссылке не найдена (удалена или ссылка устарела) */
function NotFound({ to, label }: { to: Route; label: string }) {
  return (
    <div>
      <button className="back" onClick={() => navigate(to, { replace: true })}>← {label}</button>
      <div className="small">Такой записи нет — возможно, она удалена.</div>
    </div>
  )
}

export default function App() {
  const route = useRoute()
  const tab = tabOf(route)

  const [recipes, setRecipes] = useState<Recipe[]>(loadRecipes)
  useEffect(() => saveRecipes(recipes), [recipes])

  const [sessions, setSessions] = useState<CuppingSession[]>(loadSessions)
  useEffect(() => saveSessions(sessions), [sessions])

  const [beans, setBeans] = useState<BeanProfile[]>(loadBeans)
  useEffect(() => saveBeans(beans), [beans])

  /* «Моя кофемолка» — настройка этого устройства, в синхронизацию пока не входит */
  const [profile, setProfile] = useState(loadProfile)
  useEffect(() => saveProfile(profile), [profile])

  const [logs, setLogs] = useState<BrewLog[]>(loadLogs)
  useEffect(() => saveLogs(logs), [logs])

  /* метки удалений: без них синхронизация вернёт удалённое обратно */
  const [deleted, setDeleted] = useState<Tombstones>(loadDeleted)
  useEffect(() => saveDeleted(deleted), [deleted])
  const markDeleted = (id: string) => setDeleted(d => ({ ...d, [id]: Date.now() }))

  const upsertRecipe = (r: Recipe) => {
    const s = stamp(r)
    setRecipes(rs => rs.some(x => x.id === s.id) ? rs.map(x => x.id === s.id ? s : x) : [s, ...rs])
    navigate({ name: 'brew' }, { replace: true })
  }
  const delRecipe = (id: string) => {
    markDeleted(id)
    setRecipes(rs => rs.filter(x => x.id !== id))
    navigate({ name: 'brew' }, { replace: true })
  }

  /* таймер → запись в журнал → экран записи (там оценка, зерно, заметки) */
  const addLog = (d: LogDraft) => {
    const now = Date.now()
    const l: BrewLog = stamp({ ...d, id: uid(), startedAt: now - d.durationS * 1000, createdAt: now })
    setLogs(ls => [l, ...ls])
    navigate({ name: 'entry', id: l.id })
  }
  const delLog = (id: string) => {
    markDeleted(id)
    setLogs(ls => ls.filter(x => x.id !== id))
    navigate({ name: 'journal' }, { replace: true })
  }

  const content = () => {
    switch (route.name) {
      /* ⚙️ Данные и синхронизация — отдельный экран внутри вкладки «Заваривание» */
      case 'settings': return (
        <SyncSettings
          initial={loadSyncConfig()}
          local={{ recipes, sessions, beans, logs, deleted }}
          onMerged={d => {
            setRecipes(d.recipes); setSessions(d.sessions); setBeans(d.beans)
            setLogs(d.logs); setDeleted(d.deleted)
          }}
          onClose={() => goBack({ name: 'brew' })}
          onOpenGrinder={() => navigate({ name: 'grinder' })}
          onOpenAI={() => navigate({ name: 'ai' })}
        />
      )

      case 'grinder': return (
        <GrinderSettings profile={profile} onChange={setProfile} onBack={() => goBack({ name: 'settings' })} />
      )

      case 'ai': return (
        <div>
          <button className="back" onClick={() => goBack({ name: 'settings' })}>← Настройки</button>
          <h1>Расширенные настройки AI</h1>
          <div className="small">
            Обычно это не нужно: «Сфоткать пачку» работает бесплатно без настройки, но несколько раз в день.
            Свой ключ снимает дневной лимит, и запросы идут напрямую в выбранный сервис.
          </div>
          <AISettings
            initial={loadAIConfig()}
            onDone={() => goBack({ name: 'settings' })}
            onCancel={() => goBack({ name: 'settings' })}
          />
        </div>
      )

      case 'timer': {
        const r = recipes.find(x => x.id === route.id)
        return r ? (
          <div>
            <button className="back" onClick={() => navigate({ name: 'brew' })}>← Рецепты</button>
            <h1>{r.title}</h1>
            <button className="chip" onClick={() => navigate({ name: 'edit', id: r.id })}>✏️ Изменить рецепт</button>
            <BrewTimer key={r.id} recipe={r} onLog={addLog} />
          </div>
        ) : <NotFound to={{ name: 'brew' }} label="Рецепты" />
      }

      case 'edit': {
        const r = route.id ? recipes.find(x => x.id === route.id) : undefined
        if (route.id && !r) return <NotFound to={{ name: 'brew' }} label="Рецепты" />
        return (
          <RecipeEditor
            key={route.id ?? 'new'}
            initial={r}
            profile={profile}
            onSave={upsertRecipe}
            onCancel={() => goBack({ name: 'brew' })}
            onDelete={delRecipe}
          />
        )
      }

      case 'beans': return (
        <BeansList
          beans={beans}
          onOpen={id => navigate({ name: 'bean', id })}
          onCreate={() => {
            const b: BeanProfile = stamp({ id: uid(), name: '', createdAt: Date.now() })
            setBeans(bs => [b, ...bs])
            navigate({ name: 'bean', id: b.id })
          }}
          onDelete={id => { markDeleted(id); setBeans(bs => bs.filter(x => x.id !== id)) }}
        />
      )

      case 'bean': {
        const b = beans.find(x => x.id === route.id)
        return b ? (
          <BeanView
            key={b.id}
            bean={b}
            profile={profile}
            onOpenGrinder={() => navigate({ name: 'grinder' })}
            onOpenAI={() => navigate({ name: 'ai' })}
            onChange={nb => setBeans(bs => bs.map(x => x.id === nb.id ? stamp(nb) : x))}
            onBack={() => navigate({ name: 'beans' })}
            onMakeRecipe={r => {
              setRecipes(rs => [stamp(r), ...rs])
              navigate({ name: 'edit', id: r.id })
            }}
          />
        ) : <NotFound to={{ name: 'beans' }} label="Зерно" />
      }

      case 'cupping': return (
        <CuppingList
          sessions={sessions}
          onOpen={id => navigate({ name: 'session', id })}
          onCreate={s => { setSessions(ss => [stamp(s), ...ss]); navigate({ name: 'session', id: s.id }) }}
          onDelete={id => { markDeleted(id); setSessions(ss => ss.filter(x => x.id !== id)) }}
        />
      )

      case 'session': {
        const s = sessions.find(x => x.id === route.id)
        return s ? (
          <CuppingSessionView
            key={s.id}
            session={s}
            onBack={() => navigate({ name: 'cupping' })}
            onChange={ns => setSessions(ss => ss.map(x => x.id === ns.id ? stamp(ns) : x))}
          />
        ) : <NotFound to={{ name: 'cupping' }} label="Каппинги" />
      }

      case 'journal': return (
        <JournalList logs={logs} onOpen={id => navigate({ name: 'entry', id })} />
      )

      case 'entry': {
        const l = logs.find(x => x.id === route.id)
        return l ? (
          <LogView
            key={l.id}
            log={l}
            beans={beans}
            canRepeat={!!l.recipeId && recipes.some(r => r.id === l.recipeId)}
            onChange={nl => setLogs(ls => ls.map(x => x.id === nl.id ? stamp(nl) : x))}
            onBack={() => navigate({ name: 'journal' })}
            onRepeat={() => l.recipeId && navigate({ name: 'timer', id: l.recipeId })}
            onDelete={delLog}
          />
        ) : <NotFound to={{ name: 'journal' }} label="Журнал" />
      }

      case 'brew': return (
        <div>
          <div className="header">
            <h1>BrewMate ☕</h1>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn" style={{ width: 'auto', marginTop: 0, padding: '10px 14px' }}
                aria-label="Настройки" onClick={() => navigate({ name: 'settings' })}>⚙️</button>
              <button className="btn" style={{ width: 'auto', marginTop: 0, padding: '10px 18px' }}
                aria-label="Новый рецепт" onClick={() => navigate({ name: 'edit' })}>+</button>
            </div>
          </div>
          {recipes.length === 0 && <div className="small">Пока пусто — создай первый рецепт ☕️</div>}
          {recipes.map(r => (
            <div className="card" key={r.id} {...clickableProps(() => navigate({ name: 'timer', id: r.id }))}>
              <div className="grow">
                <div>{r.title}</div>
                <div className="meta">{r.doseG} г · {r.waterG} г воды · {r.tempC}°C{r.grind ? ` · ${formatGrind(r.grind)}` : ''}</div>
              </div>
              <button className={'heart' + (r.favorite ? ' on' : '')}
                aria-label={r.favorite ? 'Убрать из избранного' : 'В избранное'} aria-pressed={!!r.favorite}
                onClick={e => {
                  e.stopPropagation()
                  setRecipes(rs => rs.map(x => x.id === r.id ? stamp({ ...x, favorite: !x.favorite }) : x))
                }}>
                {r.favorite ? '♥' : '♡'}
              </button>
            </div>
          ))}
        </div>
      )
    }
  }

  return (
    <div>
      {content()}
      <nav className="tabs">
        <button className={tab === 'brew' ? 'on' : ''} onClick={() => navigate({ name: 'brew' })}>☕ Заваривание</button>
        <button className={tab === 'bean' ? 'on' : ''} onClick={() => navigate({ name: 'beans' })}>🫘 Зерно</button>
        <button className={tab === 'cup' ? 'on' : ''} onClick={() => navigate({ name: 'cupping' })}>🧪 Каппинг</button>
        <button className={tab === 'log' ? 'on' : ''} onClick={() => navigate({ name: 'journal' })}>📓 Журнал</button>
      </nav>
    </div>
  )
}
