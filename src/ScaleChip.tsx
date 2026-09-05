import { useEffect, useRef, useState } from 'react'
import { btSupported, connectScale, hex } from './bt/bt'
import { parseFutula } from './bt/futula'

const xorCk = (b: number[]) => b.reduce((a, x) => a ^ x, 0)
const caCmd = (type: number, unit = 0x04) => {
  const b = [0xca, 0x02, type, 0, 0, 0, 0, 0, unit, 0x01]
  return [...b, xorCk(b)]
}
const TARE_CANDIDATES: number[][] = [
  ...[0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07,
      0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f].map(t => caCmd(t)),
  [0x03, 0x0a, 0x01, 0, 0, 0, 0, 0x02, 0, 0, 0, 0x10],
  [0x02, 0x01],
  [0x05],
]
/* Диагностик: пытаемся переключить единицы в мл командой с телефона */
const UNIT_TEST: number[][] = [
  caCmd(0x02, 0x07),
  caCmd(0x07, 0x07),
  caCmd(0x04, 0x07),
  caCmd(0x09, 0x07),
]

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

  const send = async (bytes: number[], label: string) => {
    if (!handle.current?.write) return
    try {
      await handle.current.write(new Uint8Array(bytes))
      push(`→ ${label}: ${bytes.map(x => x.toString(16).padStart(2, '0')).join(' ')}`)
    } catch (e) {
      push(`✖ ${label}: ${(e as Error).message}`)
    }
  }

  const autoTare = async () => {
    push('=== авто-подбор tare: СМОТРИ НА ДИСПЛЕЙ (~30 сек) ===')
    for (let i = 0; i < TARE_CANDIDATES.length; i++) {
      await send(TARE_CANDIDATES[i], `cand#${i}`)
      await new Promise(r => setTimeout(r, 1500))
    }
    push('=== конец ===')
  }

  const unitTest = async () => {
    push('=== тест write-канала: пытаюсь включить «мл» ===')
    for (let i = 0; i < UNIT_TEST.length; i++) {
      await send(UNIT_TEST[i], `ml#${i}`)
      await new Promise(r => setTimeout(r, 1200))
    }
    push('=== если дисплей НЕ переключился в мл — write-канал мёртвый ===')
  }

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
            <button className="chip" onClick={() => setOffset(raw ?? 0)}>Tare</button>
            <button className="chip" onClick={autoTare}>🔍 tare (весы)</button>
            <button className="chip" onClick={unitTest}>🧪 мл-тест</button>
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
              placeholder="hex, напр: ca 02 05 00 …" style={{ flex: 1 }} />
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