import { useState } from 'react'
import type { CSSProperties } from 'react'
import { fmtNum, parseNum } from './numField'

/* Числовое поле, которое можно стереть целиком. Текст живёт в поле сам, наружу уходит число или null;
   снаружи значение подтягивается, только если оно изменилось не из этого поля (пересчёт, сброс). */
export function NumField({
  value, onValue, decimal = false, className = 'num', placeholder, label, style,
}: {
  value: number | null | undefined
  onValue: (n: number | null) => void
  decimal?: boolean
  className?: string
  placeholder?: string
  label?: string
  style?: CSSProperties
}) {
  const [draft, setDraft] = useState(() => ({ value: value ?? null, text: fmtNum(value) }))
  const currentValue = value ?? null
  const text = draft.value === currentValue ? draft.text : fmtNum(value)

  return (
    <input
      className={className}
      style={style}
      type="text"
      inputMode={decimal ? 'decimal' : 'numeric'}
      autoComplete="off"
      aria-label={label}
      placeholder={placeholder}
      value={text}
      onChange={e => {
        const raw = e.target.value
        if (raw !== '' && !/^-?\d*[.,]?\d*$/.test(raw)) return // буквы и мусор не пускаем
        if (!decimal && /[.,]/.test(raw)) return
        const parsed = parseNum(raw)
        setDraft({ value: parsed, text: raw })
        onValue(parsed)
      }}
      onBlur={() => {
        const parsed = parseNum(text)
        setDraft({ value: parsed, text: fmtNum(parsed) })
      }}
    />
  )
}
