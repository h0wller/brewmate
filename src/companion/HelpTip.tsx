import { useState } from 'react'
import { findTerm } from './glossary'
import type { Term } from './glossary'

/* Подсказка-термин: кнопка «?», по клику показывает короткое пояснение. */
export function HelpTip({ termId }: { termId: string }) {
  const t = findTerm(termId)
  if (!t) return null
  return <HelpTipView term={t} />
}

function HelpTipView({ term }: { term: Term }) {
  const [open, setOpen] = useState(false)
  return (
    <span className="helptip">
      <button type="button" className="helptip-btn" aria-label={`Что такое ${term.title}?`}
        aria-expanded={open} onClick={() => setOpen(o => !o)}>?</button>
      {open && (
        <span className="helptip-pop" role="tooltip">
          <strong>{term.title}.</strong> {term.short}
          {term.detail && <span className="helptip-detail"> {term.detail}</span>}
        </span>
      )}
    </span>
  )
}