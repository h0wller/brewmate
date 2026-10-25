import { useRef, useState } from 'react'
import type { BrewStep, Grind, GrinderProfile, Recipe } from './types'
import { uid } from './storage'
import { GRIND_SIZES, SIZE_LABEL } from './grinders/size'
import type { GrindSize } from './grinders/size'
import { normalizeGrind } from './grinders/grind'
import { settingFor } from './grinders/profile'
import { fromDose, fromWater, ratioOf } from './recipeScale'
import type { Base } from './recipeScale'
import { GrinderConverter } from './GrinderConverter'
import { NumField } from './NumField'

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

  const [errorMsg, setErrorMsg] = useState('')
  const [showConverter, setShowConverter] = useState(false)

  const set = (p: Partial<Recipe>) => {
    setErrorMsg('')
    setR({ ...r, ...p })
  }

  /* Пропорция воды к кофе. Включена по умолчанию: меняешь кофе — вода пересчитывается по ней
     (и шаги вместе с водой), меняешь воду — пересчитывается кофе. 🔓 — править числа независимо. */
  const [locked, setLocked] = useState(true)
  const [lockedRatio, setLockedRatio] = useState(() => ratioOf(r.doseG, r.waterG) ?? 16)
  const ratio = locked ? lockedRatio : ratioOf(r.doseG, r.waterG)
  /* снимок воды и шагов до правок: пересчёт идёт от него, чтобы не копить округление */
  const baseRef = useRef<Base>({ water: r.waterG, steps: r.steps })
  const rebase = (next: Recipe) => { baseRef.current = { water: next.waterG, steps: next.steps } }
  const update = (next: Recipe, rebaseToo = true) => { setR(next); if (rebaseToo) rebase(next) }

  const setDose = (doseG: number) => {
    if (locked && doseG > 0 && lockedRatio > 0) setR({ ...r, ...fromDose(baseRef.current, lockedRatio, doseG) })
    else update({ ...r, doseG })
  }
  const setWater = (waterG: number) => {
    if (locked && waterG > 0 && lockedRatio > 0) setR({ ...r, ...fromWater(baseRef.current, lockedRatio, waterG) })
    else update({ ...r, waterG })
  }
  const setRatio = (x: number) => {
    if (!(x > 0)) return
    setLockedRatio(x)
    setLocked(true)
    if (r.doseG > 0) setR({ ...r, ...fromDose(baseRef.current, x, r.doseG) })
  }
  const toggleLock = () => {
    if (!locked) setLockedRatio(ratioOf(r.doseG, r.waterG) ?? lockedRatio)
    rebase(r)
    setLocked(!locked)
  }

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
    update({ ...r, steps: r.steps.map((s, j) => (j === i ? { ...s, ...p } : s)) })

  const save = () => {
    const steps = r.steps.filter((s) => s.duration > 0)
    if (!r.title.trim() || !steps.length) {
      setErrorMsg('Нужны название и хотя бы один шаг')
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

      <div className="numGrid">
        <label>
          <span>Кофе, г</span>
          <NumField value={r.doseG} decimal onValue={n => setDose(n ?? 0)} label="Кофе, г" />
        </label>
        <label>
          <span>Вода, г</span>
          <NumField value={r.waterG} decimal onValue={n => setWater(n ?? 0)} label="Вода, г" />
        </label>
        <label>
          <span>t°, C</span>
          <NumField value={r.tempC} onValue={n => set({ tempC: n ?? 0 })} label="Температура, °C" />
        </label>
      </div>

      <div className="row">
        <label>Пропорция 1:</label>
        <NumField value={ratio === undefined ? undefined : Math.round(ratio * 10) / 10} decimal
          onValue={n => setRatio(n ?? 0)} label="Пропорция воды к кофе" />
        <button className={'chip' + (locked ? ' on' : '')} onClick={toggleLock}>
          {locked ? '🔗 связаны' : '🔓 независимо'}
        </button>
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

      <div style={{ marginBottom: 10 }}>
        <button
          type="button"
          className="chip"
          style={{ background: '#2c2c31', color: '#4b8ef1', fontSize: 13, padding: '5px 12px' }}
          onClick={() => setShowConverter(s => !s)}
        >
          {showConverter ? '▲ Скрыть конвертер помола' : '🔄 Перевести из другой кофемолки'}
        </button>
      </div>

      {showConverter && (
        <div style={{ marginBottom: 12 }}>
          <GrinderConverter
            defaultFrom="comandante-c40"
            defaultTo={grind.grinder?.id ?? profile.grinder?.id}
            targetRedClix={profile.redClix}
            onApply={(setting, targetGId) => {
              set({
                grind: {
                  ...grind,
                  setting,
                  grinder: targetGId ? { id: targetGId } : grind.grinder,
                },
              })
              setShowConverter(false)
            }}
            onClose={() => setShowConverter(false)}
          />
        </div>
      )}

      <div className="small">
        Шаги: длительность (сек) · суммарный вес (г) · заметка
      </div>

      {r.steps.map((s, i) => (
        <div className="stepRow" key={i}>
          <NumField className="dur" value={s.duration} label={`Шаг ${i + 1}: секунды`}
            onValue={n => setStep(i, { duration: n ?? 0 })} />
          <NumField className="pour" value={s.pourTo} decimal label={`Шаг ${i + 1}: вес, г`}
            onValue={n => setStep(i, { pourTo: n ?? 0 })} />
          <input className="note" value={s.note ?? ''}
            onChange={(e) => setStep(i, { note: e.target.value })} />
          <button className="x"
            onClick={() => update({ ...r, steps: r.steps.filter((_, j) => j !== i) })}>
            ×
          </button>
        </div>
      ))}

      <button className="btn secondary"
        onClick={() =>
          update({
            ...r,
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

      {errorMsg && (
        <div className="small" style={{ color: '#ff6961', margin: '8px 0' }}>
          {errorMsg}
        </div>
      )}

      <button className="btn" onClick={save}>Сохранить</button>

      {initial && onDelete && (
        <button className="btn danger" onClick={() => onDelete(r.id)}>
          Удалить рецепт
        </button>
      )}
    </div>
  )
}