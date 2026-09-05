import { useEffect, useState } from 'react'
import type { CuppingSession, Recipe } from './types'
import { loadRecipes, loadSessions, saveRecipes, saveSessions } from './storage'
import { BrewTimer } from './BrewTimer'
import { RecipeEditor } from './RecipeEditor'
import { CuppingList } from './CuppingList'
import { CuppingSessionView } from './CuppingSession'

type BrewView = { name: 'list' } | { name: 'timer'; id: string } | { name: 'edit'; id?: string }
type CupView = { name: 'list' } | { name: 'session'; id: string }

export default function App() {
  const [tab, setTab] = useState<'brew' | 'cup'>('brew')

  const [recipes, setRecipes] = useState<Recipe[]>(loadRecipes)
  const [brew, setBrew] = useState<BrewView>({ name: 'list' })
  useEffect(() => saveRecipes(recipes), [recipes])

  const [sessions, setSessions] = useState<CuppingSession[]>(loadSessions)
  const [cup, setCup] = useState<CupView>({ name: 'list' })
  useEffect(() => saveSessions(sessions), [sessions])

  const upsertRecipe = (r: Recipe) => {
    setRecipes(rs => rs.some(x => x.id === r.id) ? rs.map(x => x.id === r.id ? r : x) : [r, ...rs])
    setBrew({ name: 'list' })
  }
  const delRecipe = (id: string) => {
    setRecipes(rs => rs.filter(x => x.id !== id))
    setBrew({ name: 'list' })
  }

  const brewContent = () => {
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
          <button className="btn" style={{ width: 'auto', marginTop: 0, padding: '10px 18px' }}
            onClick={() => setBrew({ name: 'edit' })}>+</button>
        </div>
        {recipes.length === 0 && <div className="small">Пока пусто — создай первый рецепт ☕️</div>}
        {recipes.map(r => (
          <div className="card" key={r.id} onClick={() => setBrew({ name: 'timer', id: r.id })}>
            <div className="grow">
              <div>{r.title}</div>
              <div className="meta">{r.doseG} г · {r.waterG} г воды · {r.tempC}°C</div>
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
      {tab === 'brew' ? brewContent() : cupContent()}
      <nav className="tabs">
        <button className={tab === 'brew' ? 'on' : ''} onClick={() => setTab('brew')}>☕ Заваривание</button>
        <button className={tab === 'cup' ? 'on' : ''} onClick={() => setTab('cup')}>🧪 Каппинг</button>
      </nav>
    </div>
  )
}