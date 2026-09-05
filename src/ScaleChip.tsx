import { useEffect, useRef, useState } from 'react'
import { btSupported, connectScale, hex } from './bt/bt'
import type { ScaleHandle } from './bt/bt'
import { parseFutula } from './bt/futula'

export function ScaleChip({ onWeight }: { onWeight?: (g: number) => void }) {
  const [on, setOn] = useState(false)
  const [name, setName] = useState('')
  const [weight, setWeight] = useState<number | null>(null)
  const [stable, setStable] = useState(false)
  const [debug, setDebug] = useState(false)
  const [raw, setRaw] = useState<string[]>([])
  const handle = useRef<ScaleHandle | null>(null)
  const cbRef = useRef(onWeight)
  useEffect(() => { cbRef.current = onWeight }, [onWeight])

  const push = (line: string) => setRaw(r => [...r.slice(-60), line])

  const connect = async () => {
    if (!btSupported()) {
      alert('Web Bluetooth недоступен (iOS). Нужен Android/Chrome.')
      return
    }
    try {
      const h = await connectScale(
        (uuid, bytes) => {
          const shortUuid = uuid.replace(/-/g, '').slice(4, 8)
          if (shortUuid === 'fff4') {
            const p = parseFutula(bytes)
            if (p) {
              setWeight(p.weightG)
              setStable(p.stable)
              cbRef.current?.(p.weightG)
            }
          } else {
            push(`${shortUuid} | ${hex(bytes)}`)
          }
        },
        line => push(line),
      )
      handle.current = h
      setName(h.name)
      setOn(true)
    } catch (e) {
      alert((e as Error).message)
    }
  }

  const disconnect = () => {
    handle.current?.disconnect()
    handle.current = null
    setOn(false); setWeight(null); setRaw([])
  }

  return (
    <div className="scaleBox">
      <div className="scaleRow">
        <button className={'chip' + (on ? ' on' : '')}
          onClick={() => (on ? disconnect() : connect())}>
          {on ? `⚖️ ${name}` : '⚖️ Подключить весы'}
        </button>
        {on && (
          <>
            <button className="chip" onClick={() => handle.current?.tare()}>Tare</button>
            <button className="chip" onClick={() => setDebug(d => !d)}>
              {debug ? 'лог' : 'лог'}
            </button>
          </>
        )}
      </div>
      {on && weight !== null && (
        <div className="scaleWeight">
          <span className="val">{weight.toFixed(1)}</span>
          <span className="unit"> г</span>
          <span className={'stab' + (stable ? ' ok' : '')}>{stable ? 'стабильно' : '…'}</span>
        </div>
      )}
      {on && debug && (
        <div className="rawLog">
          {raw.length === 0 && '—'}
          {raw.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      )}
    </div>
  )
}