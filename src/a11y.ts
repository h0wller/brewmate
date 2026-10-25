import type { KeyboardEvent } from 'react'

/* Enter и пробел — стандартные клавиши «нажатия» у role="button". */
export const isActivationKey = (key: string) => key === 'Enter' || key === ' ' || key === 'Spacebar'

/**
 * Props для кликабельного блока (карточка в списке), который по смыслу — кнопка.
 * Настоящий <button> тут не подходит: внутри карточки лежат свои кнопки («×», ♥),
 * а вложенные <button> в HTML недопустимы.
 */
export function clickableProps(onActivate: () => void) {
  return {
    role: 'button' as const,
    tabIndex: 0,
    onClick: onActivate,
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
      // клавиши во вложенных кнопках («×», ♥) не должны открывать карточку
      if (e.target !== e.currentTarget || !isActivationKey(e.key)) return
      e.preventDefault() // пробел иначе прокрутил бы страницу
      onActivate()
    },
  }
}
