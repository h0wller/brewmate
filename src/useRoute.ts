import { useMemo, useSyncExternalStore } from 'react'
import { formatRoute, parseRoute } from './route'
import type { Route } from './route'

const subscribe = (cb: () => void) => {
  window.addEventListener('hashchange', cb)
  return () => window.removeEventListener('hashchange', cb)
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => location.hash, () => '')
  return useMemo(() => parseRoute(hash), [hash])
}

/* «Назад»: шаг по истории, а если приложение открыли сразу на этом экране
   (истории нет) — переход на запасной маршрут, а не выход из приложения */
export function goBack(fallback: Route) {
  if (history.length > 1) history.back()
  else navigate(fallback, { replace: true })
}

/* replace: true — заменить текущую запись истории (после сохранения/удаления),
   чтобы «Назад» не возвращал на уже недействительный экран */
export function navigate(r: Route, opts: { replace?: boolean } = {}) {
  const h = formatRoute(r)
  if (location.hash === h) return
  if (opts.replace) {
    history.replaceState(null, '', h)
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  } else {
    location.hash = h
  }
}
