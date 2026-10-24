import { useState } from 'react'
import type { BrewStep, Grind, GrinderProfile, Recipe } from './types'
import { uid } from './storage'
import { GRIND_SIZES, SIZE_LABEL } from './grinders/size'
import type { GrindSize } from './grinders/size'
import { normalizeGrind } from './grinders/grind'
import { settingFor } from './grinders/profile'

export function RecipeEditor({
  initial,
  profile,
  onSave,
  onCancel,
  onDelete,
}: {
  initial?: Recipe
  profile: GrinderProfile
  onSave: (r: Recipe) => void
  onCancel: () => void
  onDelete?: (id: string) => void
}) {
  /* ленивая инициализация: новый id и время считаются один раз, а не на каждый рендер */
  const [r, setR] = useState<Recipe>(
    () => initial ?? {
      id: uid(),
      title: '',
      method: 'v60',
      doseG: 15,
      waterG: 250,
      tempC: 92,
      steps: [{ duration: 45, pourTo: 60, note: 'блюм' }],
      createdAt: Date.now(),
    }
  )

  const set = (p: Partial<Recipe>) => setR({ ...r, ...p })

  const grind: Grind = r.grind ?? {}

  /* выбор уровня: если настройка не вводилась руками (пусто или взята из калибровки
     прежнего уровня) — подставляем настройку пользователя для нового уровня */
  const pickSize = (size: GrindSize | undefined) => {
    const prevCal = grind.size ? settingFor(profile, grind.size) : undefined
    const auto = !grind.setting || grind.setting === prevCal
    const next: Grind = { ...grind, size }
    if (auto) next.setting = size ? settingFor(profile, size) : undefined
    set({ grind: next })
  }

  const setStep = (i: number, p: Partial<BrewStep>) =>
    set({ steps: r.steps.map((s, j) => (j === i ? { ...s, ...p } : s)) })

  const save = () => {
    const steps = r.steps.filter((s) => s.duration > 0)
    if (!r.title.trim() || !steps.length) {
      alert('Нужны название и хотя бы один шаг')
      return
    }
    /* кофемолка рецепта: уже указанная, иначе «моя» из профиля */
    const finalGrind = normalizeGrind({ ...r.grind, grinder: r.grind?.grinder ?? profile.grinder })
    onSave({ ...r, title: r.title.trim(), steps, grind: finalGrind })
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

      <div className="small">Помол</div>
      <div className="lotChips">
        {GRIND_SIZES.map(size => (
          <button key={size} className={'chip' + (grind.size === size ? ' on' : '')}
            onClick={() => pickSize(grind.size === size ? undefined : size)}>{SIZE_LABEL[size]}</button>
        ))}
      </div>
      <div className="row">
        <label>Настройка</label>
        <input value={grind.setting ?? ''}
          onChange={(e) => set({ grind: { ...grind, setting: e.target.value } })}
          placeholder={profile.grinder ? 'на твоей кофемолке, напр. 22 клика' : 'напр. 22 клика'} />
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