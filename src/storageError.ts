/* Запись в localStorage может не удаться молча: память браузера заполнена, приватный режим, запрет сайта.
   Раньше это уходило в console.warn, а пользователь считал, что данные сохранены. Теперь о сбое узнаёт экран. */

export interface StorageErrorInfo { key: string; message: string }
type Listener = (e: StorageErrorInfo) => void

const listeners = new Set<Listener>()

export const subscribeStorageError = (cb: Listener): (() => void) => {
  listeners.add(cb)
  return () => { listeners.delete(cb) }
}

export function reportStorageError(key: string, err: unknown): void {
  console.warn('storage: не удалось сохранить', key, err)
  const info = { key, message: err instanceof Error ? err.message : String(err) }
  for (const cb of [...listeners]) {
    try { cb(info) } catch (e) { console.warn('storage: подписчик упал', e) }   // один сбойный не мешает остальным
  }
}

/* true — записано; false — не записано (и подписчики уже уведомлены) */
export function safeWrite(store: Pick<Storage, 'setItem'>, key: string, value: unknown): boolean {
  try {
    store.setItem(key, JSON.stringify(value))
    return true
  } catch (e) {
    reportStorageError(key, e)
    return false
  }
}
