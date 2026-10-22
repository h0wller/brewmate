import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { DATA_KEYS } from './storage'
import { downloadText } from './download'

interface State { error: Error | null }

/* Сырая выгрузка данных на случай, когда приложение падает из-за битых записей.
   Ключи AI и синхронизации сюда не попадают. */
const dumpRaw = () => {
  const out: Record<string, string | null> = {}
  for (const k of DATA_KEYS) {
    try { out[k] = localStorage.getItem(k) } catch { out[k] = null }
  }
  downloadText(`brewmate-raw-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(out, null, 2))
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('BrewMate: ошибка отрисовки', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div style={{ padding: 20 }}>
        <h1>Что-то пошло не так 😕</h1>
        <div className="small" style={{ wordBreak: 'break-word' }}>{this.state.error.message}</div>
        <div className="small">
          Данные хранятся на устройстве. Если ошибка повторяется после перезагрузки —
          скачай копию данных и пришли разработчику.
        </div>
        <button className="btn" onClick={() => location.reload()}>Перезагрузить</button>
        <button className="btn secondary" onClick={dumpRaw}>Скачать данные (JSON)</button>
      </div>
    )
  }
}
