import { useEffect, useState } from 'react'
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
  const [text, setText] = useState(() => fmtNum(value))

  useEffect(() => {
    const cur = parseNum(text)
    const want = value ?? null
    if (cur !== want) setText(fmtNum(value))
  }, [value, text])

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
        setText(raw)
        onValue(parseNum(raw))
      }}
      onBlur={() => setText(fmtNum(parseNum(text)))}
    />
  )
}
