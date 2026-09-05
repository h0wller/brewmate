import { useState } from 'react'
import type { BrewStep, Recipe } from './types'
import { uid } from './storage'

export function RecipeEditor({
  initial,
  onSave,
  onCancel,
  onDelete,
}: {
  initial?: Recipe
  onSave: (r: Recipe) => void
  onCancel: () => void
  onDelete?: (id: string) => void
}) {
  const [r, setR] = useState<Recipe>(
    initial ?? {
      id: uid(),
      title: '',
      method: 'v60',
      doseG: 15,
      waterG: 250,
      tempC: 92,
      grind: '',
      steps: [{ duration: 45, pourTo: 60, note: 'блюм' }],
      createdAt: Date.now(),
    }
  )

  const set = (p: Partial<Recipe>) => setR({ ...r, ...p })

  const setStep = (i: number, p: Partial<BrewStep>) =>
    set({ steps: r.steps.map((s, j) => (j === i ? { ...s, ...p } : s)) })

  const save = () => {
    const steps = r.steps.filter((s) => s.duration > 0)
    if (!r.title.trim() || !steps.length) {
      alert('Нужны название и хотя бы один шаг')
      return
    }
    onSave({ ...r, title: r.title.trim(), steps })
  }

  return (
    <div>
      <button className="back" onClick={onCancel}>← Назад</button>

      <div className="row">
        <label>Название</label>
        <input
          value={r.title}
          onChange={(e) => set({ title: e.target.value })}
          placeholder="V60 15 г"
        />
      </div>

      <div className="row">
        <label>Кофе, г</label>
        <input className="num" type="number" value={r.doseG}
          onChange={(e) => set({ doseG: +e.target.value })} />
        <label>Вода, г</label>
        <input className="num" type="number" value={r.waterG}
          onChange={(e) => set({ waterG: +e.target.value })} />
        <label>t°, C</label>
        <input className="num" type="number" value={r.tempC}
          onChange={(e) => set({ tempC: +e.target.value })} />
      </div>

      <div className="row">
        <label>Помол</label>
        <input value={r.grind ?? ''}
          onChange={(e) => set({ grind: e.target.value })}
          placeholder="Comandante 24 клика" />
      </div>

      <div className="small">
        Шаги: длительность (сек) · суммарный вес (г) · заметка
      </div>

      {r.steps.map((s, i) => (
        <div className="stepRow" key={i}>
          <input className="dur" type="number" value={s.duration}
            onChange={(e) => setStep(i, { duration: +e.target.value })} />
          <input className="pour" type="number" value={s.pourTo}
            onChange={(e) => setStep(i, { pourTo: +e.target.value })} />
          <input className="note" value={s.note ?? ''}
            onChange={(e) => setStep(i, { note: e.target.value })} />
          <button className="x"
            onClick={() => set({ steps: r.steps.filter((_, j) => j !== i) })}>
            ×
          </button>
        </div>
      ))}

      <button className="btn secondary"
        onClick={() =>
          set({
            steps: [
              ...r.steps,
              {
                duration: 30,
                pourTo: (r.steps.at(-1)?.pourTo ?? 0) + 50,
                note: '',
              },
            ],
          })
        }>
        + Шаг
      </button>

      <button className="btn" onClick={save}>Сохранить</button>

      {initial && onDelete && (
        <button className="btn danger" onClick={() => onDelete(r.id)}>
          Удалить рецепт
        </button>
      )}
    </div>
  )
}