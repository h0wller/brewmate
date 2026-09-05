import { useEffect, useState } from 'react'
import type { Recipe } from './types'
import { loadRecipes, saveRecipes } from './storage'
import { BrewTimer } from './BrewTimer'
import { RecipeEditor } from './RecipeEditor'

type View =
  | { name: 'list' }
  | { name: 'timer'; id: string }
  | { name: 'edit'; id?: string }

export default function App() {
  const [recipes, setRecipes] = useState<Recipe[]>(loadRecipes)
  const [view, setView] = useState<View>({ name: 'list' })

  useEffect(() => saveRecipes(recipes), [recipes])

  const upsert = (r: Recipe) => {
    setRecipes((rs) =>
      rs.some((x) => x.id === r.id)
        ? rs.map((x) => (x.id === r.id ? r : x))
        : [r, ...rs]
    )
    setView({ name: 'list' })
  }

  const del = (id: string) => {
    setRecipes((rs) => rs.filter((x) => x.id !== id))
    setView({ name: 'list' })
  }

  /* ---------- Timer ---------- */
  if (view.name === 'timer') {
    const r = recipes.find((x) => x.id === view.id)
    return r ? (
      <div>
        <button className="back" onClick={() => setView({ name: 'list' })}>
          ← Рецепты
        </button>
        <h1>{r.title}</h1>
        <BrewTimer key={r.id} recipe={r} />
      </div>
    ) : null
  }

  /* ---------- Editor ---------- */
  if (view.name === 'edit')
    return (
      <RecipeEditor
        initial={recipes.find((x) => x.id === view.id)}
        onSave={upsert}
        onCancel={() => setView({ name: 'list' })}
        onDelete={del}
      />
    )

  /* ---------- List ---------- */
  return (
    <div>
      <div className="header">
        <h1>BrewMate ☕</h1>
        <button
          className="btn"
          style={{ width: 'auto', marginTop: 0, padding: '10px 18px' }}
          onClick={() => setView({ name: 'edit' })}
        >
          +
        </button>
      </div>

      {recipes.length === 0 && (
        <div className="small">Пока пусто — создай первый рецепт ☕️</div>
      )}

      {recipes.map((r) => (
        <div
          className="card"
          key={r.id}
          onClick={() => setView({ name: 'timer', id: r.id })}
        >
          <div className="grow">
            <div>{r.title}</div>
            <div className="meta">
              {r.doseG} г · {r.waterG} г воды · {r.tempC}°C
            </div>
          </div>
          <button
            className={'heart' + (r.favorite ? ' on' : '')}
            onClick={(e) => {
              e.stopPropagation()
              setRecipes((rs) =>
                rs.map((x) =>
                  x.id === r.id ? { ...x, favorite: !x.favorite } : x
                )
              )
            }}
          >
            {r.favorite ? '♥' : '♡'}
          </button>
        </div>
      ))}
    </div>
  )
}