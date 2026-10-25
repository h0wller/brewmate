export type TimerStatus = 'idle' | 'run' | 'pause' | 'done'

/**
 * Нужна ли блокировка гашения экрана прямо сейчас: только пока таймер идёт
 * и вкладка видна. В скрытой вкладке браузер сам снимает блокировку, а запрос
 * новой завершается ошибкой — поэтому берём заново, когда вкладка снова видима.
 */
export function needsWakeLock(status: TimerStatus, visibility: DocumentVisibilityState): boolean {
  return status === 'run' && visibility === 'visible'
}
