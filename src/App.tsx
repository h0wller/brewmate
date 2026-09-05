import { useEffect, useState } from 'react'
import type { BeanProfile, CuppingSession, Recipe } from './types'
import {
  loadBeans, loadRecipes, loadSessions,
  saveBeans, saveRecipes, saveSessions, uid,
} from './storage'
import { BrewTimer } from './BrewTimer'
import { RecipeEditor } from './RecipeEditor'
import { CuppingList } from './CuppingList'
import { CuppingSessionView } from './CuppingSession'
import { BeansList } from './BeansList'
import { BeanView } from './BeanView'
import { SyncSettings } from './SyncSettings'
import { loadSyncConfig } from './sync/sync'

type BrewView =
  | { name: 'list' }
  | { name: 'timer'; id: string }
  | { name: 'edit'; id?: string }
  | { name: 'settings' }
type CupView = { name: 'list' } | { name: 'session'; id: string }
type BeanNav = { name: 'list' } | { name: 'detail'; id: string }

export default function App() {
  const [tab, setTab] = useState<'brew' | 'bean' | 'cup'>('brew')

  const [recipes, setRecipes] = useState<Recipe[]>(loadRecipes)
  const [brew, setBrew] = useState<BrewView>({ name: 'list' })
  useEffect(() => saveRecipes(recipes), [recipes])

  const [sessions, setSessions] = useState<CuppingSession[]>(loadSessions)
  const [cup, setCup] = useState<CupView>({ name: 'list' })
  useEffect(() => saveSessions(sessions), [sessions])

  const [beans, setBeans] = useState<BeanProfile[]>(loadBeans)
  const [beanNav, setBeanNav] = useState<BeanNav>({ name: 'list' })
  useEffect(() => saveBeans(beans), [beans])

  const upsertRecipe = (r: Recipe) => {
    setRecipes(rs => rs.some(x => x.id === r.id) ? rs.map(x => x.id === r.id ? r : x) : [r, ...rs])
    setBrew({ name: 'list' })
  }
  const delRecipe = (id: string) => {
    setRecipes(rs => rs.filter(x => x.id !== id))
    setBrew({ name: 'list' })
  }

  const brewContent = () => {
    /* ⚙️ Синхронизация — отдельный экран внутри таба «Заваривание» */
    if (brew.name === 'settings') return (
      <SyncSettings
        initial={loadSyncConfig()}
        local={{ recipes, sessions, beans }}
        onMerged={d => { setRecipes(d.recipes); setSessions(d.sessions); setBeans(d.beans) }}
        onClose={() => setBrew({ name: 'list' })}
      />
    )
    if (brew.name === 'timer') {
      const r = recipes.find(x => x.id === brew.id)
      return r ? (
        <div>
          <button className="back" onClick={() => setBrew({ name: 'list' })}>← Рецепты</button>
          <h1>{r.title}</h1>
          <BrewTimer key={r.id} recipe={r} />
        </div>
      ) : null
    }
    if (brew.name === 'edit') return (
      <RecipeEditor
        initial={recipes.find(x => x.id === brew.id)}
        onSave={upsertRecipe}
        onCancel={() => setBrew({ name: 'list' })}
        onDelete={delRecipe}
      />
    )
    return (
      <div>
        <div className="header">
          <h1>BrewMate ☕</h1>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" style={{ width: 'auto', marginTop: 0, padding: '10px 14px' }}
              onClick={() => setBrew({ name: 'settings' })}>⚙️</button>
            <button className="btn" style={{ width: 'auto', marginTop: 0, padding: '10px 18px' }}
              onClick={() => setBrew({ name: 'edit' })}>+</button>
          </div>
        </div>
        {recipes.length === 0 && <div className="small">Пока пусто — создай первый рецепт ☕️</div>}
        {recipes.map(r => (
          <div className="card" key={r.id} onClick={() => setBrew({ name: 'timer', id: r.id })}>
            <div className="grow">
              <div>{r.title}</div>
              <div className="meta">{r.doseG} г · {r.waterG} г воды · {r.tempC}°C{r.grind ? ` · ${r.grind}` : ''}</div>
            </div>
            <button className={'heart' + (r.favorite ? ' on' : '')}
              onClick={e => {
                e.stopPropagation()
                setRecipes(rs => rs.map(x => x.id === r.id ? { ...x, favorite: !x.favorite } : x))
              }}>
              {r.favorite ? '♥' : '♡'}
            </button>
          </div>
        ))}
      </div>
    )
  }

  const beanContent = () => {
    if (beanNav.name === 'detail') {
      const b = beans.find(x => x.id === beanNav.id)
      return b ? (
        <BeanView
          key={b.id}
          bean={b}
          onChange={nb => setBeans(bs => bs.map(x => x.id === nb.id ? nb : x))}
          onBack={() => setBeanNav({ name: 'list' })}
          onMakeRecipe={r => {
            setRecipes(rs => [r, ...rs])
            setTab('brew')
            setBrew({ name: 'edit', id: r.id })
          }}
        />
      ) : null
    }
    return (
      <BeansList
        beans={beans}
        onOpen={id => setBeanNav({ name: 'detail', id })}
        onCreate={() => {
          const b: BeanProfile = { id: uid(), name: '', createdAt: Date.now() }
          setBeans(bs => [b, ...bs])
          setBeanNav({ name: 'detail', id: b.id })
        }}
        onDelete={id => setBeans(bs => bs.filter(x => x.id !== id))}
      />
    )
  }

  const cupContent = () => {
    if (cup.name === 'session') {
      const s = sessions.find(x => x.id === cup.id)
      return s ? (
        <CuppingSessionView
          key={s.id}
          session={s}
          onBack={() => setCup({ name: 'list' })}
          onChange={ns => setSessions(ss => ss.map(x => x.id === ns.id ? ns : x))}
        />
      ) : null
    }
    return (
      <CuppingList
        sessions={sessions}
        onOpen={id => setCup({ name: 'session', id })}
        onCreate={s => { setSessions(ss => [s, ...ss]); setCup({ name: 'session', id: s.id }) }}
        onDelete={id => setSessions(ss => ss.filter(x => x.id !== id))}
      />
    )
  }

  return (
    <div>
      {tab === 'brew' ? brewContent() : tab === 'bean' ? beanContent() : cupContent()}
      <nav className="tabs">
        <button className={tab === 'brew' ? 'on' : ''} onClick={() => setTab('brew')}>☕ Заваривание</button>
        <button className={tab === 'bean' ? 'on' : ''} onClick={() => setTab('bean')}>🫘 Зерно</button>
        <button className={tab === 'cup' ? 'on' : ''} onClick={() => setTab('cup')}>🧪 Каппинг</button>
      </nav>
    </div>
  )
}