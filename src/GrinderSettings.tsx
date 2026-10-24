import { useState } from 'react'
import type { GrinderProfile } from './types'
import { findGrinder, searchGrinders } from './grinders/catalog'
import { GRIND_SIZES, SIZE_LABEL } from './grinders/size'
import type { GrindSize } from './grinders/size'

export function GrinderSettings({ profile, onChange, onBack }: {
  profile: GrinderProfile
  onChange: (p: GrinderProfile) => void
  onBack: () => void
}) {
  const [q, setQ] = useState('')
  const [custom, setCustom] = useState('')

  const current = profile.grinder
    ? (findGrinder(profile.grinder.id)?.label ?? profile.grinder.label ?? profile.grinder.id)
    : null
  const results = searchGrinders(q, 8)

  const setGrinder = (id: string, label: string) => {
    onChange({ ...profile, grinder: { id, label } })
    setQ(''); setCustom('')
  }

  const setCal = (size: GrindSize, value: string) => {
    const calibration = { ...profile.calibration }
    if (value.trim()) calibration[size] = value
    else delete calibration[size]
    onChange({ ...profile, calibration })
  }

  return (
    <div>
      <button className="back" onClick={onBack}>← Назад</button>
      <h1>Моя кофемолка 🔧</h1>

      <div className="card" style={{ cursor: 'default' }}>
        <div className="grow">
          <div>{current ?? 'Не выбрана'}</div>
          <div className="meta">
            {current ? 'Рецепты и рекомендации будут подставлять твои настройки' : 'Выбери из списка или добавь свою'}
          </div>
        </div>
        {current && <button className="x" aria-label="Сбросить кофемолку"
          onClick={() => onChange({ ...profile, grinder: undefined })}>×</button>}
      </div>

      <div className="small">Найти в каталоге</div>
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Comandante, Timemore, 1Zpresso…" />
      <div className="lotChips" style={{ flexWrap: 'wrap' }}>
        {results.map(g => (
          <button key={g.id} className={'chip' + (profile.grinder?.id === g.id ? ' on' : '')}
            onClick={() => setGrinder(g.id, g.label)}>{g.label}</button>
        ))}
        {results.length === 0 && <div className="small" style={{ margin: 0 }}>Такой нет в каталоге — добавь ниже.</div>}
      </div>

      <div className="small">Нет в списке? Своя кофемолка</div>
      <div className="row">
        <input value={custom} onChange={e => setCustom(e.target.value)} placeholder="Название, например Kingrinder K6" />
        <button className="btn secondary" style={{ width: 'auto', margin: 0, padding: '10px 14px' }}
          disabled={!custom.trim()} onClick={() => setGrinder('custom', custom.trim())}>Добавить</button>
      </div>

      <div className="small">Твои настройки для каждого уровня помола</div>
      <div className="small" style={{ marginTop: 0 }}>
        Универсального перевода между кофемолками нет: у разных моделей разные шкалы и жернова.
        Поэтому впиши, что ставишь на своей кофемолке для каждого уровня — BrewMate подставит это в
        рецепты и рекомендации. Заполнять все уровни не обязательно.
      </div>
      {GRIND_SIZES.map(size => (
        <div className="attrRow" key={size}>
          <span className="lbl">{SIZE_LABEL[size]}</span>
          <input style={{ width: 150 }} value={profile.calibration[size] ?? ''}
            onChange={e => setCal(size, e.target.value)} placeholder="напр. 22 клика" />
        </div>
      ))}
    </div>
  )
}
