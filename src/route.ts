/* Маршруты приложения (hash-роутер: работает без настройки сервера и в PWA).
   Чистые функции — без обращения к window, поэтому легко тестируются. */

export type Route =
  | { name: 'brew' }
  | { name: 'timer'; id: string }
  | { name: 'edit'; id?: string }
  | { name: 'settings' }
  | { name: 'grinder' }
  | { name: 'grind'; logId?: string }   // logId: проверка помола для записи журнала
  | { name: 'ai' }
  | { name: 'beans' }
  | { name: 'bean'; id: string }
  | { name: 'cupping' }
  | { name: 'session'; id: string }
  | { name: 'journal' }
  | { name: 'entry'; id: string }
  | { name: 'bench' }

export type Tab = 'brew' | 'bean' | 'cup' | 'log' | 'bench'

export const tabOf = (r: Route): Tab => {
  switch (r.name) {
    case 'beans': case 'bean': return 'bean'
    case 'cupping': case 'session': return 'cup'
    case 'journal': case 'entry': return 'log'
    case 'bench': return 'bench'
    case 'grind': return r.logId ? 'log' : 'brew'
    default: return 'brew'
  }
}

const dec = (s: string) => { try { return decodeURIComponent(s) } catch { return s } }

export function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(dec)
  const [a, b, c] = parts
  switch (a) {
    case 'settings': return { name: 'settings' }
    case 'grinder': return { name: 'grinder' }
    case 'grind': return b ? { name: 'grind', logId: b } : { name: 'grind' }
    case 'ai': return { name: 'ai' }
    case 'bench': return { name: 'bench' }
    case 'beans': return b ? { name: 'bean', id: b } : { name: 'beans' }
    case 'cupping': return b ? { name: 'session', id: b } : { name: 'cupping' }
    case 'journal': return b ? { name: 'entry', id: b } : { name: 'journal' }
    case 'brew':
      if (!b) return { name: 'brew' }
      if (b === 'new') return { name: 'edit' }
      return c === 'edit' ? { name: 'edit', id: b } : { name: 'timer', id: b }
    default: return { name: 'brew' }
  }
}

const enc = encodeURIComponent

export function formatRoute(r: Route): string {
  switch (r.name) {
    case 'brew': return '#/'
    case 'timer': return `#/brew/${enc(r.id)}`
    case 'edit': return r.id ? `#/brew/${enc(r.id)}/edit` : '#/brew/new'
    case 'settings': return '#/settings'
    case 'grinder': return '#/grinder'
    case 'grind': return r.logId ? `#/grind/${enc(r.logId)}` : '#/grind'
    case 'ai': return '#/ai'
    case 'beans': return '#/beans'
    case 'bean': return `#/beans/${enc(r.id)}`
    case 'cupping': return '#/cupping'
    case 'session': return `#/cupping/${enc(r.id)}`
    case 'journal': return '#/journal'
    case 'entry': return `#/journal/${enc(r.id)}`
    case 'bench': return '#/bench'
  }
}
