import { useRef, useState } from 'react'
import { btSupported, connectScale, hex } from './bt/bt'

export function ScaleChip() {
  const [on, setOn] = useState(false)
  const [name, setName] = useState('')
  const [raw, setRaw] = useState<string[]>([])
  const [debug, setDebug] = useState(false)
  const disc = useRef<() => void>(() => {})

  const push = (line: string) => setRaw(r => [...r.slice(-80), line])

  const connect = async () => {
    if (!btSupported()) {
      alert('Web Bluetooth недоступен на этом устройстве (iOS). Нужен Android/Chrome.')
      return
    }
    try {
      const s = await connectScale(
        (uuid, bytes) => push(`${uuid.slice(4, 8)} | ${hex(bytes)}`),
        line => push(line),
      )
      setName(s.name)
      disc.current = s.disconnect
      setOn(true)
      setDebug(true)
    } catch (e) {
      alert((e as Error).message)
    }
  }

  const disconnect = () => {
    disc.current()
    setOn(false); setRaw([]); setDebug(false)
  }

  return (
    <div style={{ margin: '0 0 10px' }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className={'chip' + (on ? ' on' : '')} onClick={() => (on ? disconnect() : connect())}>
          {on ? `⚖️ ${name}` : '⚖️ Подключить весы'}
        </button>
        {on && (
          <button className="chip" onClick={() => setDebug(d => !d)}>
            {debug ? 'скрыть лог' : 'лог'}
          </button>
        )}
      </div>
      {on && debug && (
        <div className="rawLog" style={{ marginTop: 8 }}>
          {raw.length === 0 && 'Жду пакеты…'}
          {raw.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      )}
    </div>
  )
}