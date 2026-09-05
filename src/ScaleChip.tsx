import { useEffect, useRef, useState } from 'react'
import { btSupported, connectScale, hex } from './bt/bt'
import { parseFutula, unitCmd } from './bt/futula'

export function ScaleChip({ onWeight }: { onWeight?: (g: number) => void }) {
  const [on, setOn] = useState(false)
  const [name, setName] = useState('')
  const [raw, setRawG] = useState<number | null>(null)
  const [unit, setUnit] = useState('г')
  const [stable, setStable] = useState(false)
  const [offset, setOffset] = useState(0)
  const [debug, setDebug] = useState(false)
  const [log, setLog] = useState<string[]>([])
  const [cmdHex, setCmdHex] = useState('')
  const handle = useRef<any>(null)
  const cbRef = useRef(onWeight)
  useEffect(() => { cbRef.current = onWeight }, [onWeight])

  const push = (line: string) => setLog(r => [...r.slice(-80), line])

  const send = async (bytes: number[], label: string) => {
    if (!handle.current?.write) return
    try {
      await handle.current.write(new Uint8Array(bytes))
      push(`→ ${label}: ${bytes.map(x => x.toString(16).padStart(2, '0')).join(' ')}`)
    } catch (e) {
      push(`✖ ${label}: ${(e as Error).message}`)
    }
  }

  const handshake = () => setTimeout(() => send([0x06, 0x0f, 0x00, 0x00], 'handshake'), 600)

  const connect = async () => {
    if (!btSupported()) { alert('Web Bluetooth недоступен (iOS).'); return }
    try {
      const h = await connectScale(
        (uuid, bytes) => {
          const short = uuid.replace(/-/g, '').slice(4, 8)
          if (short === 'fff4') {
            const p = parseFutula(bytes)
            if (p) { setRawG(p.rawG); setStable(p.stable); setUnit(p.unit) }
          }
          push(`${short} | ${hex(bytes)}`)
        },
        line => push(line),
        () => handshake(),
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

  const net = raw === null ? null : raw - offset
  useEffect(() => { cbRef.current?.(net ?? 0) }, [net])

  const sendManual = () => {
    const bytes = cmdHex.trim().split(/[\s,]+/).filter(Boolean)
      .map(s => parseInt(s, 16)).filter(n => !isNaN(n) && n >= 0 && n <= 255)
    if (bytes.length) send(bytes, 'manual')
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
            <button className="chip" onClick={() => send([0xf2, 0x01], 'tare (весы)')}>Tare (весы)</button>
            <button className="chip" onClick={() => setOffset(raw ?? 0)}>Tare (сайт)</button>
            <button className="chip" onClick={() => send(unitCmd(0x04), 'unit')}>г</button>
            <button className="chip" onClick={() => send(unitCmd(0x07), 'unit')}>мл</button>
            <button className="chip" onClick={() => setDebug(d => !d)}>
              {debug ? 'скрыть лог' : 'лог'}
            </button>
          </>
        )}
      </div>
      {on && net !== null && (
        <div className="scaleWeight">
          <span className="val">{net.toFixed(1)}</span>
          <span className="unit"> {unit}</span>
          <span className={'stab' + (stable ? ' ok' : '')}>{stable ? 'стабильно' : '…'}</span>
          {offset !== 0 && <div className="small">тар: {offset.toFixed(1)} {unit}</div>}
        </div>
      )}
      {on && debug && (
        <>
          <div className="scaleRow" style={{ marginTop: 8 }}>
            <input value={cmdHex} onChange={e => setCmdHex(e.target.value)}
              placeholder="hex, напр: f2 00" style={{ flex: 1 }} />
            <button className="chip" onClick={sendManual}>Отпр.</button>
          </div>
          <div className="rawLog">
            <div>raw: {raw?.toFixed(1) ?? '—'} {unit} · net: {net?.toFixed(1) ?? '—'} {unit} · offset: {offset.toFixed(1)}</div>
            {log.length === 0 && '—'}
            {log.map((l, i) => <div key={i}>{l}</div>)}
          </div>
        </>
      )}
    </div>
  )
}