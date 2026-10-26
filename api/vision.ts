/* Бесплатный AI для обычных пользователей: приложение шлёт фото пачки сюда, ключи провайдеров
   (GEMINI_API_KEY, GROQ_API_KEY, OPENROUTER_API_KEY) лежат в переменных окружения Vercel.
   Логика — в server/vision.ts. */
import { handle, memoryStore, newHealth, upstashProviderStateStore, upstashStore } from '../server/vision.js'
import type { CounterStore, Deps } from '../server/vision.js'

const env = process.env
const url = env.UPSTASH_REDIS_REST_URL ?? env.KV_REST_API_URL
const token = env.UPSTASH_REDIS_REST_TOKEN ?? env.KV_REST_API_TOKEN
const store: CounterStore = url && token ? upstashStore(url, token, fetch) : memoryStore()
const health = newHealth()\nconst providerState = url && token ? upstashProviderStateStore(url, token, fetch) : undefined

export default {
  fetch(request: Request) {
    const deps: Deps = { env, fetch, store, health, providerState, now: Date.now, log: m => console.error(m) }
    return handle(request, deps)
  },
}
