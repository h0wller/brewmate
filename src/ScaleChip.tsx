import { useEffect, useRef, useState } from 'react'
import { btSupported, connectScale, hex } from './bt/bt'
import { parseFutula } from './bt/futula'

export function ScaleChip({ onWeight }: { onWeight?: (g: number) => void }) {
  const [on, setOn] = useState(false)
  const [name, setName] = useState('')
  const [raw, setRawG] = useState<number | null>(null)   // сырой вес с весов
  const [stable, setStable] = useState(false)
  const [offset, setOffset] = useState(0)               // программный тар
  const [debug, setDebug] = useState(false)
  const [log, setLog] = useState<string[]>([])
  const handle = useRef<any>(null)
  const cbRef = useRef(onWeight)
  useEffect(() => { cbRef.current = onWeight }, [onWeight])

  const push = (line: string) => setLog(r => [...r.slice(-60), line])

  const connect = async () => {
    if (!btSupported()) { alert('Web Bluetooth недоступен (iOS).'); return }
    try {
      const h = await connectScale(
        (uuid, bytes) => {
          const short = uuid.replace(/-/g, '').slice(4, 8)
          if (short === 'fff4') {
            const p = parseFutula(bytes)
            if (p) { setRawG(p.rawG); setStable(p.stable) }
          } else {
            push(`${short} | ${hex(bytes)}`)
          }
        },
        line => push(line),
      )
      handle.current = h
      setName(h.name)
      setOn(true)
      setOffset(0)
    } catch (e) { alert((e as Error).message) }
  }

  const disconnect = () => {
    handle.current?.disconnect(); handle.current = null
    setOn(false); setRawG(null); setOffset(0); setLog([])
  }

  // net = raw − offset; отправляем в таймер
  const net = raw === null ? null : raw - offset
  useEffect(() => { cbRef.current?.(net ?? 0) }, [net])

  const tare = () => { if (raw !== null) setOffset(raw) }

  return (
    <div className="scaleBox">
      <div className="scaleRow">
        <button className={'chip' + (on ? ' on' : '')}
          onClick={() => (on ? disconnect() : connect())}>
          {on ? `⚖️ ${name}` : '⚖️ Подключить весы'}
        </button>
        {on && (
          <>
            <button className="chip" onClick={tare}>Tare</button>
            <button className="chip" onClick={() => setDebug(d => !d)}>
              {debug ? 'скрыть лог' : 'лог'}
            </button>
          </>
        )}
      </div>
      {on && net !== null && (
        <div className="scaleWeight">
          <span className="val">{net.toFixed(1)}</span>
          <span className="unit"> г</span>
          <span className={'stab' + (stable ? ' ok' : '')}>{stable ? 'стабильно' : '…'}</span>
          {offset !== 0 && <div className="small">тар: {offset.toFixed(1)} г</div>}
        </div>
      )}
      {on && debug && (
        <div className="rawLog">
          <div>raw: {raw?.toFixed(1) ?? '—'} г · net: {net?.toFixed(1) ?? '—'} г · offset: {offset.toFixed(1)} г</div>
          {log.length === 0 && '—'}
          {log.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      )}
    </div>
  )
}