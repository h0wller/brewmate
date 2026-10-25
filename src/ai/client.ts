import { buildPackagePrompt } from './prompt'
import type { PromptOptions } from './prompt'
export { buildPackagePrompt }

export interface AIConfig {
  provider: string
  baseUrl: string
  apiKey: string
  model: string
}

export const AI_PROVIDERS = [
  { id: 'qwen', label: 'Qwen · DashScope', baseUrl: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1', model: 'qwen-vl-max' },
  { id: 'gemini', label: 'Gemini · free', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-3.5-flash' },
  { id: 'groq', label: 'Groq · free', baseUrl: 'https://api.groq.com/openai/v1', model: 'meta-llama/llama-4-scout-17b-16e-instruct' },
  { id: 'openrouter', label: 'OpenRouter · free', baseUrl: 'https://openrouter.ai/api/v1', model: 'meta-llama/llama-3.2-11b-vision-instruct:free' },
  { id: 'custom', label: 'Свой (OpenAI-формат)', baseUrl: '', model: '' },
]

const KEY = 'brewmate.ai.v1'

export const loadAIConfig = (): AIConfig | null => {
  try { return JSON.parse(localStorage.getItem(KEY) ?? 'null') } catch { return null }
}
export const saveAIConfig = (c: AIConfig) => localStorage.setItem(KEY, JSON.stringify(c))
export const clearAIConfig = () => localStorage.removeItem(KEY)

export function fileToBase64(f: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(String(r.result)) // data:image/...;base64,...
    r.onerror = rej
    r.readAsDataURL(f)
  })
}

/* Прямой вызов vision-модели в OpenAI-формате — режим «свой ключ» (⚙️ → Расширенные настройки AI) */
export async function askVision(cfg: AIConfig, image: string, prompt: string): Promise<any> {
  const res = await fetch(cfg.baseUrl.replace(/\/$/, '') + '/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      temperature: 0.3,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: image } },
        ],
      }],
    }),
  })
  if (!res.ok) throw new Error(`AI ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const data = await res.json()
  const text: string = data.choices?.[0]?.message?.content ?? ''
  const m = text.match(/\{[\s\S]*\}/)
  if (!m) throw new Error('AI не вернул JSON: ' + text.slice(0, 200))
  return JSON.parse(m[0])
}

/* ---------- бесплатный AI через сервер BrewMate (/api/vision) ---------- */

export type AIErrorKind = 'limit_user' | 'limit_global' | 'busy' | 'unavailable' | 'network' | 'bad'

export class AIError extends Error {
  kind: AIErrorKind
  constructor(kind: AIErrorKind, message: string) {
    super(message)
    this.kind = kind
  }
}

const OWN_KEY_HINT = 'Или добавь свой ключ: ⚙️ → Расширенные настройки AI.'
const fail = (e: AIError): never => { throw e }

/* Ответ сервера → результат или понятная пользователю ошибка (чистая функция, проверяется тестами) */
export function parseProxyResponse(status: number, body: unknown): unknown {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
  if (status === 200) {
    if (b.result && typeof b.result === 'object') return b.result
    return fail(new AIError('bad', 'AI вернул пустой ответ. Попробуй ещё раз.'))
  }
  if (status === 429 && b.error === 'limit') {
    const when = typeof b.resetAt === 'string' ? new Date(b.resetAt) : null
    const at = when && !isNaN(+when)
      ? ` Обновится в ${when.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}.`
      : ''
    return fail(b.scope === 'global'
      ? new AIError('limit_global', `Бесплатные AI-запросы на сегодня закончились у всех пользователей.${at} ${OWN_KEY_HINT}`)
      : new AIError('limit_user', `Ты использовал(а) все бесплатные AI-запросы на сегодня.${at} ${OWN_KEY_HINT}`))
  }
  if (status === 503 && b.error === 'busy') {
    return fail(new AIError('busy', 'AI сейчас перегружен. Попробуй через минуту.'))
  }
  if (status === 503 && b.error === 'not_configured') {
    return fail(new AIError('unavailable', `Бесплатный AI на сервере ещё не включён. ${OWN_KEY_HINT}`))
  }
  if (status === 404 || status === 405) {
    return fail(new AIError('unavailable', `Сервер AI недоступен (в режиме разработки запускай через «vercel dev»). ${OWN_KEY_HINT}`))
  }
  if (status === 413) return fail(new AIError('bad', 'Фото слишком большое. Попробуй сфотографировать ещё раз.'))
  if (status === 400) {
    return fail(new AIError('bad', `Не удалось отправить фото: ${typeof b.message === 'string' ? b.message : 'неверный запрос'}.`))
  }
  return fail(new AIError('busy', `AI временно недоступен (${status}). Попробуй позже.`))
}

/* Распознать пачку: со своим ключом — напрямую, иначе через бесплатный сервер BrewMate */
export async function recognizePackage(
  cfg: AIConfig | null, methodLabel: string, image: string, opts: PromptOptions = {},
): Promise<any> {
  if (cfg?.apiKey && cfg.baseUrl) return askVision(cfg, image, buildPackagePrompt(methodLabel, opts))
  let res: Response
  try {
    res = await fetch('/api/vision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task: 'package', methodLabel, image, ...opts }),
    })
  } catch {
    throw new AIError('network', 'Нет связи с сервером. Проверь интернет и попробуй ещё раз.')
  }
  let body: unknown = null
  try { body = await res.json() } catch { /* не JSON — parseProxyResponse разберёт по статусу */ }
  return parseProxyResponse(res.status, body)
}

/* Быстрая проверка ключа/модели текстовым запросом */
export async function pingAI(cfg: AIConfig): Promise<string> {
  const res = await fetch(cfg.baseUrl.replace(/\/$/, '') + '/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      messages: [{ role: 'user', content: 'Ответь одним словом: кофе' }],
    }),
  })
  if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 300)}`)
  const d = await res.json()
  return d.choices?.[0]?.message?.content ?? 'OK'
}