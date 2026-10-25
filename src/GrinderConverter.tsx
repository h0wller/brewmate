import { useState } from 'react'
import { CATALOG, findGrinder, searchGrinders } from './grinders/catalog'
import { convertGrindSetting, getGrinderScale } from './grinders/presets'
import { SIZE_LABEL } from './grinders/size'

export function GrinderConverter({
  defaultFrom = 'comandante-c40',
  defaultTo,
  targetRedClix = false,
  onApply,
  onClose,
}: {
  defaultFrom?: string
  defaultTo?: string
  targetRedClix?: boolean
  onApply?: (setting: string, grinderId: string) => void
  onClose?: () => void
}) {
  const [fromId, setFromId] = useState(defaultFrom)
  const [fromValue, setFromValue] = useState('24')
  const [fromRedClix, setFromRedClix] = useState(false)

  const [toId, setToId] = useState(defaultTo ?? (defaultFrom === 'comandante-c40' ? 'timemore-c3' : 'comandante-c40'))
  const [toRedClix, setToRedClix] = useState(targetRedClix)

  const [searchFrom, setSearchFrom] = useState('')
  const [searchTo, setSearchTo] = useState('')
  const [showSearchFrom, setShowSearchFrom] = useState(false)
  const [showSearchTo, setShowSearchTo] = useState(false)

  const fromGrinder = findGrinder(fromId)
  const toGrinder = findGrinder(toId)
  const fromScale = getGrinderScale(fromId)
  const toScale = getGrinderScale(toId)

  const conversion = convertGrindSetting(fromId, fromValue, toId, fromRedClix, toRedClix)

  const filteredFrom = searchFrom.trim() ? searchGrinders(searchFrom, 6) : CATALOG.slice(0, 6)
  const filteredTo = searchTo.trim() ? searchGrinders(searchTo, 6) : CATALOG.slice(0, 6)

  return (
    <div className="card" style={{ display: 'block', cursor: 'default', background: '#1e1e24', border: '1px solid #3a3a44' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontWeight: 600, fontSize: 16 }}>🔄 Конвертер помола</div>
        {onClose && (
          <button className="x" onClick={onClose} aria-label="Закрыть конвертер">×</button>
        )}
      </div>
      <div className="small" style={{ margin: '0 0 12px' }}>
        Ориентировочно переводит клики и деления между моделями по усреднённым шкалам. Это не замер:
        жернова, обжарка и износ сдвигают результат, поэтому ориентируйся на вкус и свою калибровку.
      </div>

      {/* Кофемолка рецепта (ИСТОЧНИК) */}
      <div style={{ background: '#242428', borderRadius: 12, padding: 10, marginBottom: 10 }}>
        <div className="small" style={{ margin: '0 0 6px', color: '#4b8ef1' }}>Откуда (из рецепта):</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
          <button
            type="button"
            className="chip on"
            style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis' }}
            onClick={() => setShowSearchFrom(s => !s)}
          >
            {fromGrinder?.label ?? fromId} {showSearchFrom ? '▲' : '▼'}
          </button>
          <input
            style={{ width: 100, textAlign: 'center', fontWeight: 'bold' }}
            value={fromValue}
            onChange={e => setFromValue(e.target.value)}
            placeholder="24"
          />
          <span style={{ fontSize: 13, color: '#98989f' }}>{fromScale?.unit ?? 'кл.'}</span>
        </div>

        {fromId === 'comandante-c40' && (
          <div style={{ margin: '4px 0 6px' }}>
            <button
              type="button"
              className={'chip' + (fromRedClix ? ' on' : '')}
              style={{ fontSize: 12, padding: '3px 8px' }}
              onClick={() => setFromRedClix(r => !r)}
            >
              {fromRedClix ? '🔴 Red Clix рецепта (×2)' : '⚪️ Обычная ось C40'}
            </button>
          </div>
        )}

        {showSearchFrom && (
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #333' }}>
            <input
              value={searchFrom}
              onChange={e => setSearchFrom(e.target.value)}
              placeholder="Поиск исходной кофемолки…"
              style={{ marginBottom: 6, padding: '8px 10px' }}
            />
            <div className="lotChips" style={{ flexWrap: 'wrap', maxHeight: 120, overflowY: 'auto' }}>
              {filteredFrom.map(g => (
                <button
                  key={g.id}
                  type="button"
                  className={'chip' + (fromId === g.id ? ' on' : '')}
                  style={{ fontSize: 12, padding: '4px 8px' }}
                  onClick={() => { setFromId(g.id); setShowSearchFrom(false); setSearchFrom('') }}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Кофемолка пользователя (ЦЕЛЬ) */}
      <div style={{ background: '#242428', borderRadius: 12, padding: 10, marginBottom: 12 }}>
        <div className="small" style={{ margin: '0 0 6px', color: '#9ff59f' }}>Куда (твоя кофемолка):</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
          <button
            type="button"
            className="chip on"
            style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis' }}
            onClick={() => setShowSearchTo(s => !s)}
          >
            {toGrinder?.label ?? toId} {showSearchTo ? '▲' : '▼'}
          </button>
          <button
            type="button"
            className="chip"
            style={{ background: '#2c2c31', fontSize: 12, padding: '6px 10px' }}
            onClick={() => {
              // Swap grinders
              const tmpId = fromId
              const tmpVal = conversion ? String(conversion.targetValue) : fromValue
              setFromId(toId)
              setToId(tmpId)
              setFromValue(tmpVal)
              // режим Red Clix относится к кофемолке, а не к стороне — переносим вместе с ней
              setFromRedClix(toRedClix)
              setToRedClix(fromRedClix)
            }}
          >
            ⇅ поменять
          </button>
        </div>

        {toId === 'comandante-c40' && (
          <div style={{ margin: '4px 0 6px' }}>
            <button
              type="button"
              className={'chip' + (toRedClix ? ' on' : '')}
              style={{ fontSize: 12, padding: '3px 8px' }}
              onClick={() => setToRedClix(r => !r)}
            >
              {toRedClix ? '🔴 Мой Red Clix (×2)' : '⚪️ Моя C40 обычная'}
            </button>
          </div>
        )}

        {showSearchTo && (
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #333' }}>
            <input
              value={searchTo}
              onChange={e => setSearchTo(e.target.value)}
              placeholder="Поиск целевой кофемолки…"
              style={{ marginBottom: 6, padding: '8px 10px' }}
            />
            <div className="lotChips" style={{ flexWrap: 'wrap', maxHeight: 120, overflowY: 'auto' }}>
              {filteredTo.map(g => (
                <button
                  key={g.id}
                  type="button"
                  className={'chip' + (toId === g.id ? ' on' : '')}
                  style={{ fontSize: 12, padding: '4px 8px' }}
                  onClick={() => { setToId(g.id); setShowSearchTo(false); setSearchTo('') }}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* РЕЗУЛЬТАТ */}
      {conversion ? (
        <div style={{ textAlign: 'center', background: '#0a3d91', borderRadius: 12, padding: '14px 10px', marginTop: 8 }}>
          <div className="small" style={{ color: '#cfd6e4', margin: '0 0 4px' }}>
            {fromGrinder?.label} ({fromValue} {fromScale?.unit}) ≈
          </div>
          <div style={{ fontSize: 32, fontWeight: 700, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>
            {conversion.targetSetting}
          </div>
          <div style={{ fontSize: 14, color: '#e0e7ff', marginTop: 4 }}>
            на {toGrinder?.label} · уровень {SIZE_LABEL[conversion.size]}
          </div>
          {toScale?.dialRange && (
            <div className="small" style={{ color: '#a5b4fc', margin: '4px 0 0' }}>
              Шкала модели: {toScale.dialRange}
              {toScale.burrs ? ` (${toScale.burrs === 'flat' ? 'плоские' : 'конические'} жернова)` : ''}
            </div>
          )}

          {onApply && (
            <button
              type="button"
              className="btn"
              style={{ marginTop: 10, background: '#fff', color: '#0a3d91' }}
              onClick={() => onApply(`≈ ${conversion.targetSetting}`, toId)}
            >
              Использовать в рецепте
            </button>
          )}
        </div>
      ) : (
        <div className="small" style={{ textAlign: 'center', color: '#ff6961' }}>
          Не удалось рассчитать: введите корректное число кликов или делений.
        </div>
      )}
    </div>
  )
}
