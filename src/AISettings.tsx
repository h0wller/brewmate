import { useState } from 'react'
import { AI_PROVIDERS, pingAI, saveAIConfig } from './ai/client'
import type { AIConfig } from './ai/client'

export function AISettings({ initial, onDone, onCancel }: {
  initial: AIConfig | null
  onDone: (c: AIConfig) => void
  onCancel: () => void
}) {
  const [c, setC] = useState<AIConfig>(
    initial ?? { provider: 'qwen', baseUrl: AI_PROVIDERS[0].baseUrl, apiKey: '', model: AI_PROVIDERS[0].model }
  )
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const pick = (id: string) => {
    const p = AI_PROVIDERS.find(x => x.id === id)!
    setC({ ...c, provider: id, baseUrl: p.baseUrl || c.baseUrl, model: p.model || c.model })
    setMsg('')
  }

  const test = async () => {
    setBusy(true); setMsg('')
    try { const r = await pingAI(c); setMsg('✅ Модель отвечает: ' + r.slice(0, 80)) }
    catch (e) { setMsg('❌ ' + (e as Error).message) }
    setBusy(false)
  }

  return (
    <div className="card" style={{ display: 'block', cursor: 'default' }}>
      <div className="small" style={{ margin: '0 0 8px' }}>AI-провайдер (любой OpenAI-совместимый API)</div>
      <div className="lotChips">
        {AI_PROVIDERS.map(p => (
          <button key={p.id} className={'chip' + (c.provider === p.id ? ' on' : '')} onClick={() => pick(p.id)}>
            {p.label}
          </button>
        ))}
      </div>
      <div className="row"><label>API-ключ</label>
        <input type="password" value={c.apiKey} onChange={e => setC({ ...c, apiKey: e.target.value })} placeholder="sk-…" /></div>
      <div className="row"><label>Base URL</label>
        <input value={c.baseUrl} onChange={e => setC({ ...c, baseUrl: e.target.value })} /></div>
      <div className="row"><label>Модель</label>
        <input value={c.model} onChange={e => setC({ ...c, model: e.target.value })} /></div>

      {msg && <div className="small" style={{ wordBreak: 'break-word' }}>{msg}</div>}

      <button className="btn" disabled={!c.apiKey || !c.baseUrl || !c.model}
        onClick={() => { saveAIConfig(c); onDone(c) }}>Сохранить</button>
      <button className="btn secondary" disabled={!c.apiKey || !c.baseUrl || !c.model || busy} onClick={test}>
        {busy ? 'Проверяю…' : 'Проверить'}
      </button>
      <button className="btn secondary" onClick={onCancel}>Отмена</button>
    </div>
  )
}