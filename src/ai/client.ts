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

export function fileToBase64(f: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(String(r.result)) // data:image/...;base64,...
    r.onerror = rej
    r.readAsDataURL(f)
  })
}

/* Универсальный вызов vision-модели в OpenAI-формате */
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

export function buildPackagePrompt(methodLabel: string) {
  return `Ты — чемпион-бариста. На фото — пачка кофе. Извлеки данные и составь рецепт для метода ${methodLabel}, доза 15 г.
  Все текстовые поля (title, note, notes) пиши на русском языке.
  Верни СТРОГО JSON без markdown и пояснений:
{
  "bean": { "name": "строка", "origin": "строка", "process": "washed|natural|honey|anaerobic|other", "roastLevel": "light|medium|dark", "roastDate": "YYYY-MM-DD или null", "notes": "дескрипторы с пачки" },
  "recipe": { "title": "строка", "tempC": 88-96, "ratio": 14-17, "grind": "например: Comandante 24 клика", "steps": [ { "duration": секунды, "pourTo": суммарные граммы воды, "note": "строка" } ] }
}
Правила: светлая обжарка — вода горячее и помол мельче; тёмная — вода холоднее и помол крупнее; натуральная обработка — чуть крупнее помол.
steps: 3–5 шагов, первый — блюм (2–3 веса дозы), pourTo растёт монотонно до dose*ratio.`
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