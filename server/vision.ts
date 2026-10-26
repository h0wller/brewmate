/* Серверная часть бесплатного AI: фото пачки → JSON с зерном и рецептом.
   Ключи провайдеров лежат только в переменных окружения сервера. Клиент не присылает свой текст запроса
   (только метод заваривания и картинку), а число запросов ограничено на человека и на всех в день,
   чтобы бесплатные квоты не сгорели за вечер.

   Весь ввод-вывод передаётся снаружи (fetch, хранилище счётчиков, часы), поэтому логика проверяется тестами. */

import { buildGrindPrompt, buildPackagePrompt, isGrindTaste, isPromptWater } from '../src/ai/prompt.js'
import type { GrindFacts, PromptBeanContext, PromptWater } from '../src/ai/prompt.js'
import { isGrindSize } from '../src/grinders/size.js'

export type Env = Record<string, string | undefined>

export interface Provider { id: string; baseUrl: string; model: string; key: string }

/* Порядок = приоритет. Провайдер включается, если задан его ключ; модель можно сменить переменной
   <ID>_MODEL без выпуска приложения (названия моделей у бесплатных тарифов меняются). */
const KNOWN = [
  { id: 'gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-3.5-flash' },
  { id: 'groq', baseUrl: 'https://api.groq.com/openai/v1', model: 'meta-llama/llama-4-scout-17b-16e-instruct' },
  { id: 'openrouter', baseUrl: 'https://openrouter.ai/api/v1', model: 'meta-llama/llama-3.2-11b-vision-instruct:free' },
]

export function loadProviders(env: Env): Provider[] {
  const out: Provider[] = []
  for (const p of KNOWN) {
    const name = p.id.toUpperCase()
    const key = env[`${name}_API_KEY`]?.trim()
    if (key) out.push({ ...p, key, model: env[`${name}_MODEL`]?.trim() || p.model })
  }
  return out
}

export interface Limits { perUserPerDay: number; globalPerDay: number; maxImageChars: number }

export function loadLimits(env: Env): Limits {
  const n = (v: string | undefined, d: number) => {
    const x = Number(v)
    return Number.isFinite(x) && x > 0 ? Math.floor(x) : d
  }
  return {
    perUserPerDay: n(env.AI_LIMIT_PER_USER, 10),
    globalPerDay: n(env.AI_LIMIT_GLOBAL, 500),
    maxImageChars: n(env.AI_MAX_IMAGE_CHARS, 1_500_000),
  }
}

/* ---------- проверка запроса ---------- */

export type VisionRequest =
  | { task: 'package'; methodLabel: string; image: string; water?: PromptWater; doseG?: number; bean?: PromptBeanContext }
  | { task: 'grind'; image: string; grind: GrindFacts }

const promptFor = (req: VisionRequest): string =>
  req.task === 'grind'
    ? buildGrindPrompt(req.grind)
    : buildPackagePrompt(req.methodLabel, { water: req.water, doseG: req.doseG, bean: req.bean })

const inRange = (v: unknown, lo: number, hi: number): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi

/* Числа замера приходят от клиента: принимаем только правдоподобные и упорядоченные значения */
export function validateGrind(g: unknown): GrindFacts | null {
  if (!g || typeof g !== 'object') return null
  const o = g as Record<string, unknown>
  if (!isGrindSize(o.size)) return null
  if (!inRange(o.d10, 20, 5000) || !inRange(o.d50, 20, 5000) || !inRange(o.d90, 20, 5000)) return null
  if (!(o.d10 <= o.d50 && o.d50 <= o.d90)) return null
  if (!inRange(o.n, 1, 100_000) || !Number.isInteger(o.n)) return null
  if (o.taste !== undefined && !isGrindTaste(o.taste)) return null
  return {
    size: o.size, d10: o.d10, d50: o.d50, d90: o.d90, n: o.n,
    ...(o.taste !== undefined ? { taste: o.taste } : {}),
  }
}

const IMAGE_RE = /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/
const LABEL_RE = /^[\p{L}\p{N} .\-·]{1,30}$/u

export function validateRequest(
  body: unknown, maxImageChars: number,
): { ok: true; value: VisionRequest } | { ok: false; message: string } {
  if (!body || typeof body !== 'object') return { ok: false, message: 'ожидается JSON-объект' }
  const b = body as Record<string, unknown>
  if (b.task !== 'package' && b.task !== 'grind') return { ok: false, message: 'неизвестная задача' }
  if (typeof b.image !== 'string' || !IMAGE_RE.test(b.image)) {
    return { ok: false, message: 'нужна картинка jpeg, png или webp в виде data URL' }
  }
  if (b.image.length > maxImageChars) return { ok: false, message: 'картинка слишком большая' }
  if (b.task === 'grind') {
    const grind = validateGrind(b.grind)
    return grind ? { ok: true, value: { task: 'grind', image: b.image, grind } } : { ok: false, message: 'некорректные данные замера' }
  }
  if (typeof b.methodLabel !== 'string' || !LABEL_RE.test(b.methodLabel)) {
    return { ok: false, message: 'некорректный метод заваривания' }
  }
  if (b.water !== undefined && !isPromptWater(b.water)) return { ok: false, message: 'некорректная вода' }
  if (b.doseG !== undefined && !(typeof b.doseG === 'number' && b.doseG >= 3 && b.doseG <= 500)) {
    return { ok: false, message: 'некорректная доза' }
  }
  let bean: PromptBeanContext | undefined
  if (b.bean && typeof b.bean === 'object' && !Array.isArray(b.bean)) {
    const p = b.bean as Record<string, unknown>
    bean = {
      ...(p.process === 'washed' || p.process === 'natural' || p.process === 'honey' || p.process === 'anaerobic' ? { process: p.process } : {}),
      ...(p.roastLevel === 'light' || p.roastLevel === 'medium' || p.roastLevel === 'dark' ? { roastLevel: p.roastLevel } : {}),
      ...(typeof p.roastDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.roastDate) ? { roastDate: p.roastDate } : {}),
    }
    if (!Object.keys(bean).length) bean = undefined
  }
  return {
    ok: true,
    value: {
      task: 'package', methodLabel: b.methodLabel, image: b.image,
      ...(b.water !== undefined ? { water: b.water } : {}),
      ...(b.doseG !== undefined ? { doseG: b.doseG } : {}),
      ...(bean ? { bean } : {}),
    },
  }
}

/* ---------- счётчики запросов ---------- */

export interface CounterStore {
  /* увеличить счётчик и вернуть новое значение; ключ живёт ttlS секунд */
  incr(key: string, ttlS: number): Promise<number>
}

export function memoryStore(now: () => number = Date.now): CounterStore {
  const m = new Map<string, { n: number; exp: number }>()
  return {
    async incr(key, ttlS) {
      const t = now()
      for (const [k, v] of m) if (v.exp <= t) m.delete(k)   // чтобы карта не росла
      const cur = m.get(key)
      const e = cur && cur.exp > t ? cur : { n: 0, exp: t + ttlS * 1000 }
      e.n++
      m.set(key, e)
      return e.n
    },
  }
}

/* Upstash Redis по REST (бесплатный тариф, подключается в Vercel Marketplace): счётчики общие для всех
   экземпляров функции. Без него лимит считается в памяти одного экземпляра и точен лишь приблизительно. */
export function upstashStore(url: string, token: string, fetchFn: typeof fetch): CounterStore {
  return {
    async incr(key, ttlS) {
      const res = await fetchFn(url.replace(/\/$/, '') + '/pipeline', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify([['INCR', key], ['EXPIRE', key, ttlS, 'NX']]),
      })
      if (!res.ok) throw new Error(`upstash ${res.status}`)
      const out = (await res.json()) as { result?: unknown }[]
      const n = Number(out?.[0]?.result)
      if (!Number.isFinite(n)) throw new Error('upstash: неожиданный ответ')
      return n
    },
  }
}

const DAY_MS = 86_400_000
export const dayOf = (t: number) => new Date(t).toISOString().slice(0, 10)
export const nextDayAt = (t: number) => new Date(Math.floor(t / DAY_MS) * DAY_MS + DAY_MS).toISOString()

async function hashIp(ip: string, salt: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + ip))
  return Array.from(new Uint8Array(buf)).slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join('')
}

export type LimitResult = { ok: true } | { ok: false; scope: 'user' | 'global'; resetAt: string }

export async function checkLimits(
  store: CounterStore, ip: string, salt: string, limits: Limits, now: number,
): Promise<LimitResult> {
  const day = dayOf(now)
  const ttl = 2 * 86400
  const user = await store.incr(`ai:u:${day}:${await hashIp(ip, salt)}`, ttl)
  if (user > limits.perUserPerDay) return { ok: false, scope: 'user', resetAt: nextDayAt(now) }
  const all = await store.incr(`ai:g:${day}`, ttl)
  if (all > limits.globalPerDay) return { ok: false, scope: 'global', resetAt: nextDayAt(now) }
  return { ok: true }
}

/* ---------- вызов провайдеров ---------- */

export class ProviderError extends Error {
  status: number
  retryAfterS?: number
  constructor(status: number, message: string, retryAfterS?: number) {
    super(message)
    this.status = status
    this.retryAfterS = retryAfterS
  }
}

export function extractJson(text: string): unknown {
  const m = text.match(/\{[\s\S]*\}/)
  if (!m) throw new ProviderError(502, 'модель не вернула JSON')
  try { return JSON.parse(m[0]) } catch { throw new ProviderError(502, 'модель вернула битый JSON') }
}

/* Контракт ответа модели: некорректный результат не отдаём клиенту, а пробуем следующего провайдера. */
const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v)

const boundedText = (v: unknown, max: number): v is string =>
  typeof v === 'string' && v.trim().length > 0 && v.length <= max

const PROCESSES = ['washed', 'natural', 'honey', 'anaerobic', 'other'] as const
const ROASTS = ['light', 'medium', 'dark'] as const
const GRIND_VERDICTS = ['ok', 'finer', 'coarser', 'unsure'] as const
const GRIND_ISSUES = ['fines', 'clumps', 'uneven', 'bad_photo'] as const

function validIsoDate(value: unknown): boolean {
  if (value === null) return true
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

/** Проверяет и нормализует недоверенный JSON модели по задаче. */
export function normalizeVisionResult(task: VisionRequest['task'], value: unknown): unknown {
  if (!isRecord(value)) throw new ProviderError(502, 'модель вернула JSON не того формата')

  if (task === 'package') {
    const bean = value.bean
    const recipe = value.recipe
    if (!isRecord(bean) || !isRecord(recipe)) {
      throw new ProviderError(502, 'модель не вернула данные зерна и рецепта')
    }
    if (!boundedText(bean.name, 120) || !boundedText(bean.origin, 160) ||
        !boundedText(bean.notes, 400) || !boundedText(recipe.title, 120)) {
      throw new ProviderError(502, 'модель вернула неполные данные пачки')
    }
    if (bean.process !== undefined && !PROCESSES.includes(bean.process as typeof PROCESSES[number])) {
      throw new ProviderError(502, 'модель вернула неизвестный способ обработки')
    }
    if (bean.roastLevel !== undefined && !ROASTS.includes(bean.roastLevel as typeof ROASTS[number])) {
      throw new ProviderError(502, 'модель вернула неизвестный уровень обжарки')
    }
    if (bean.roastDate !== undefined && !validIsoDate(bean.roastDate)) {
      throw new ProviderError(502, 'модель вернула некорректную дату обжарки')
    }
    return {
      bean: {
        name: bean.name.trim(),
        origin: bean.origin.trim(),
        notes: bean.notes.trim(),
        ...(bean.process !== undefined ? { process: bean.process } : {}),
        ...(bean.roastLevel !== undefined ? { roastLevel: bean.roastLevel } : {}),
        ...(bean.roastDate !== undefined ? { roastDate: bean.roastDate } : {}),
      },
      recipe: { title: recipe.title.trim() },
    }
  }

  if (!GRIND_VERDICTS.includes(value.verdict as typeof GRIND_VERDICTS[number]) ||
      !boundedText(value.comment, 400) ||
      !Array.isArray(value.issues) ||
      value.issues.length > GRIND_ISSUES.length ||
      value.issues.some(issue => !GRIND_ISSUES.includes(issue as typeof GRIND_ISSUES[number]))) {
    throw new ProviderError(502, 'модель вернула некорректную оценку помола')
  }
  return {
    verdict: value.verdict,
    comment: value.comment.trim(),
    issues: [...new Set(value.issues)],
  }
}

async function callProvider(
  fetchFn: typeof fetch, p: Provider, req: VisionRequest, timeoutMs: number,
): Promise<unknown> {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), timeoutMs)
  try {
    const res = await fetchFn(p.baseUrl + '/chat/completions', {
      method: 'POST',
      signal: ctl.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${p.key}` },
      body: JSON.stringify({
        model: p.model,
        temperature: 0.3,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: promptFor(req) },
            { type: 'image_url', image_url: { url: req.image } },
          ],
        }],
      }),
    })
    if (!res.ok) {
      const ra = Number(res.headers.get('retry-after'))
      throw new ProviderError(res.status, (await res.text()).slice(0, 200), Number.isFinite(ra) && ra > 0 ? ra : undefined)
    }
    const data = (await res.json()) as { choices?: { message?: { content?: unknown } }[] }
    const text = data.choices?.[0]?.message?.content
    if (typeof text !== 'string') throw new ProviderError(502, 'пустой ответ модели')
    return normalizeVisionResult(req.task, extractJson(text))
  } catch (e) {
    if (e instanceof ProviderError) throw e
    throw new ProviderError(ctl.signal.aborted ? 504 : 502, (e as Error).message)
  } finally {
    clearTimeout(timer)
  }
}

/* Сколько секунд провайдера не трогаем после ошибки. 429 — обычно минутный лимит;
   401/403 — ключ не принят (это ошибка настройки, а не «лимит»), и о ней нужно узнать из логов. */
export function cooldownS(e: ProviderError): number {
  if (e.status === 429) return Math.min(e.retryAfterS ?? 60, 300)
  if (e.status === 401 || e.status === 403) return 600
  if (e.status === 400) return 0          // скорее всего, картинка; другому провайдеру может подойти
  return 30
}

export interface Health { until: Map<string, number>; lastGood?: string }
export const newHealth = (): Health => ({ until: new Map() })

export type VisionOutcome =
  | { ok: true; result: unknown; provider: string }
  | { ok: false; reason: 'busy'; retryAfterS: number }

export async function runVision(
  fetchFn: typeof fetch, providers: Provider[], req: VisionRequest, health: Health,
  now: number, timeoutMs = 25_000, log: (m: string) => void = () => {},
): Promise<VisionOutcome> {
  const free = providers.filter(p => (health.until.get(p.id) ?? 0) <= now)
  if (!free.length) {
    const soon = Math.min(...providers.map(p => health.until.get(p.id) ?? 0))
    return { ok: false, reason: 'busy', retryAfterS: Math.max(1, Math.ceil((soon - now) / 1000)) }
  }
  const ordered = [...free.filter(p => p.id === health.lastGood), ...free.filter(p => p.id !== health.lastGood)]
  for (const p of ordered) {
    try {
      const result = await callProvider(fetchFn, p, req, timeoutMs)
      health.lastGood = p.id
      return { ok: true, result, provider: p.id }
    } catch (e) {
      const err = e as ProviderError
      const cd = cooldownS(err)
      if (cd > 0) health.until.set(p.id, now + cd * 1000)
      log(`vision: ${p.id} ${err.status} ${err.message.slice(0, 120)}`)
    }
  }
  return { ok: false, reason: 'busy', retryAfterS: 30 }
}

/* ---------- обработчик запроса ---------- */

export interface Deps {
  env: Env
  fetch: typeof fetch
  store: CounterStore
  health: Health
  now: () => number
  log?: (m: string) => void
}

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers },
  })

export function clientIp(req: Request): string {
  return req.headers.get('x-real-ip')?.trim()
    || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || 'unknown'
}

export async function handle(req: Request, deps: Deps): Promise<Response> {
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' }, { Allow: 'POST' })

  /* только со страниц самого приложения: чужие сайты не должны гонять наш бесплатный лимит */
  const origin = req.headers.get('origin')
  if (origin) {
    let host = ''
    try { host = new URL(origin).host } catch { /* пустой host ниже даст отказ */ }
    if (host !== new URL(req.url).host) return json(403, { error: 'forbidden_origin' })
  }

  const limits = loadLimits(deps.env)
  const len = Number(req.headers.get('content-length'))
  if (Number.isFinite(len) && len > limits.maxImageChars + 2000) return json(413, { error: 'too_large' })

  let body: unknown
  try { body = await req.json() } catch { return json(400, { error: 'bad_request', message: 'не JSON' }) }
  const v = validateRequest(body, limits.maxImageChars)
  if (!v.ok) return json(v.message.includes('большая') ? 413 : 400, { error: 'bad_request', message: v.message })

  const providers = loadProviders(deps.env)
  if (!providers.length) return json(503, { error: 'not_configured' })

  const now = deps.now()
  let lim: LimitResult
  try {
    lim = await checkLimits(deps.store, clientIp(req), deps.env.AI_RATE_SALT ?? '', limits, now)
  } catch (e) {
    /* сбой общего хранилища не должен отключать AI: считаем лимит в памяти этого экземпляра */
    deps.log?.(`vision: счётчики недоступны: ${(e as Error).message}`)
    lim = await checkLimits(fallbackStore, clientIp(req), deps.env.AI_RATE_SALT ?? '', limits, now)
  }
  if (!lim.ok) return json(429, { error: 'limit', scope: lim.scope, resetAt: lim.resetAt })

  const out = await runVision(deps.fetch, providers, v.value, deps.health, now, 25_000, deps.log)
  if (!out.ok) return json(503, { error: 'busy', retryAfterS: out.retryAfterS }, { 'Retry-After': String(out.retryAfterS) })
  return json(200, { result: out.result })
}

const fallbackStore = memoryStore()
