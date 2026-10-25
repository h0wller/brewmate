/* Обмен рецептами в формате CoffeeJSON 1.x (https://github.com/coffeejson-org/coffeejson, спецификация CC0).
   Экспорт: наши рецепты → документ { coffeejson, generator, recipes }.
   Импорт: документ → наши рецепты + список того, что пришлось пропустить.

   Что берём из чужих документов: название, метод, дозу, воду, температуру, помол и шаги, у которых
   есть и время (at_s), и вес (to_water) — по «правилу данных» спецификации. Остальное (зерно, дегустации,
   шаги без воды, добавки) в таймер не помещается и в импорт не попадает; о пропусках сообщаем. */

import type { BrewStep, Grind, Recipe } from '../types'
import { normalizeGrind } from '../grinders/grind'
import { findGrinder, isRegistryGrinder } from '../grinders/catalog'
import { stamp } from '../sync/merge'
import { uid } from '../storage'

export const COFFEEJSON_VERSION = '1.0'
export const COFFEEJSON_MEDIA_TYPE = 'application/vnd.coffeejson+json'

/* Названия ошибок разбора — из словаря спецификации (Integration guide § Consuming) */
export type DecodeErrorKind = 'not_json' | 'not_a_document' | 'unsupported_version' | 'empty_document'

export class CoffeeJSONError extends Error {
  kind: DecodeErrorKind
  constructor(kind: DecodeErrorKind, message: string) {
    super(message)
    this.kind = kind
  }
}

/* ---------- методы: наш ключ ↔ значение CoffeeJSON ---------- */

const METHOD_OUT: Record<string, { method: string; brewer?: string }> = {
  v60: { method: 'pour_over', brewer: 'hario-v60' },
  drip: { method: 'drip' },
  french: { method: 'french_press', brewer: 'french-press' },
  aero: { method: 'aeropress', brewer: 'aeropress' },
  cupping: { method: 'immersion' },
}

const METHOD_IN: Record<string, string> = {
  pour_over: 'v60',
  drip: 'drip',
  french_press: 'french',
  aeropress: 'aero',
}

/* ---------- экспорт ---------- */

interface Measurement { value: number; unit: string }
const grams = (v: number): Measurement => ({ value: Math.round(v * 10) / 10, unit: 'gram' })

const isBloomNote = (s?: string) => !!s && /блюм|bloom/i.test(s)

export function recipeToCoffeeJSON(r: Recipe): Record<string, unknown> {
  const mapped = METHOD_OUT[r.method]
  const out: Record<string, unknown> = {
    id: r.id,
    title: r.title || 'Без названия',
    lang: 'ru',
    method: mapped?.method ?? 'other',
  }
  if (mapped?.brewer) out.brewer = { id: mapped.brewer }
  out.coffee = grams(r.doseG)
  out.water = grams(r.waterG)
  if (r.doseG > 0 && r.waterG > 0) out.ratio = Math.round((r.waterG / r.doseG) * 10) / 10
  out.water_temp = { value: r.tempC, unit: 'celsius' }

  if (r.grind) {
    const g: Record<string, unknown> = {}
    if (r.grind.grinder) {
      const { id, label } = r.grind.grinder
      const known = findGrinder(id)
      if (known && isRegistryGrinder(known.id)) {
        // из реестра: отдаём канонический id (псевдонимы поколений сводим к модели реестра)
        g.grinder = { id: known.id, ...(label ? { label } : {}) }
      } else if (known || id === 'custom') {
        // модель добавлена вручную и в реестре CoffeeJSON её id нет — другие приложения его не поймут
        g.grinder = { id: 'custom', label: label || known?.label || 'Своя кофемолка' }
      } else {
        g.grinder = { id, ...(label ? { label } : {}) }
      }
    }
    if (r.grind.setting) g.setting = r.grind.setting
    if (r.grind.size) g.size = r.grind.size
    if (Object.keys(g).length) out.grind = g
  }

  let at = 0
  const steps = r.steps.map((s, i) => {
    const step: Record<string, unknown> = {
      kind: i === 0 && isBloomNote(s.note) ? 'bloom' : 'pour',
      at_s: at,
      to_water: grams(s.pourTo),
    }
    if (s.note) step.instruction = s.note
    at += s.duration
    return step
  })
  if (steps.length) {
    out.steps = steps
    out.finish_s = at
  }
  return out
}

export function toCoffeeJSON(recipes: Recipe[], app = { name: 'BrewMate', version: '0.0.0' }): string {
  return JSON.stringify({
    coffeejson: COFFEEJSON_VERSION,
    generator: { name: app.name, version: app.version },
    recipes: recipes.map(recipeToCoffeeJSON),
  }, null, 2)
}

/* ---------- импорт ---------- */

export interface ImportResult {
  recipes: Recipe[]
  skipped: { title: string; reason: string }[]
  notes: string[]                  // что приблизили или потеряли у принятых рецептов
}

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v)
const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined)

/* Измерение → число в нужных единицах. Окно min…max даём серединой (и говорим об этом). */
function measure(
  m: unknown, convert: Record<string, (x: number) => number>,
): { value: number; approx: boolean } | undefined {
  if (!isObj(m) || typeof m.unit !== 'string') return undefined
  const f = convert[m.unit]
  if (!f) return undefined
  const v = num(m.value)
  if (v !== undefined) return { value: f(v), approx: false }
  const lo = num(m.min), hi = num(m.max)
  if (lo !== undefined && hi !== undefined) return { value: f((lo + hi) / 2), approx: true }
  return undefined
}

/* масса: граммы и унции; вода — ещё миллилитры (1 мл ≈ 1 г, для воды при brew-температуре это допущение приложения) */
const MASS = { gram: (x: number) => x, ounce: (x: number) => x * 28.3495 }
const WATER = { ...MASS, milliliter: (x: number) => x }
const TEMP = { celsius: (x: number) => x, fahrenheit: (x: number) => ((x - 32) * 5) / 9 }

const round1 = (x: number) => Math.round(x * 10) / 10
const DEFAULT_TEMP = 93
const DEFAULT_LAST_STEP_S = 30

function importGrind(g: unknown): Grind | undefined {
  if (!isObj(g)) return undefined
  const gear = isObj(g.grinder) ? g.grinder : undefined
  const id = gear ? str(gear.id) : undefined
  const label = gear ? str(gear.label) ?? [str(gear.brand), str(gear.model)].filter(Boolean).join(' ') : undefined
  return normalizeGrind({
    grinder: id ? { id, label: label || undefined } : undefined,
    setting: str(g.setting),
    size: g.size,
  })
}

function importRecipe(raw: unknown, notes: string[]): { recipe?: Recipe; skip?: { title: string; reason: string } } {
  if (!isObj(raw)) return { skip: { title: '?', reason: 'это не объект рецепта' } }
  const title = str(raw.title)
  const skip = (reason: string) => ({ skip: { title: title ?? '?', reason } })
  if (!title) return skip('нет названия')
  if (raw.basis === 'yield') return skip('рецепт задан по выходу (эспрессо) — такие BrewMate пока не поддерживает')

  const coffee = measure(raw.coffee, MASS)
  if (!coffee || coffee.value <= 0) return skip('нет дозы кофе в граммах или унциях')

  let water = measure(raw.water, WATER)
  if (!water) {
    const ratio = num(raw.ratio)
    if (ratio && ratio > 0) water = { value: coffee.value * ratio, approx: false }
  }
  if (!water || water.value <= 0) return skip('нет воды (ни количества, ни пропорции)')
  const temp = measure(raw.water_temp, TEMP)
  if (coffee.approx || water.approx || temp?.approx) notes.push(`«${title}»: доза, вода или температура были заданы диапазоном — взята середина`)

  /* шаги: только «водные» — у которых есть и время, и вес (правило данных); порядок не меняем */
  const rawSteps = Array.isArray(raw.steps) ? raw.steps : []
  const wet: { at: number; to: number; note?: string }[] = []
  for (const s of rawSteps) {
    if (!isObj(s)) continue
    const at = num(s.at_s)
    const to = measure(s.to_water, WATER)
    if (at !== undefined && at >= 0 && to) wet.push({ at, to: to.value, note: str(s.instruction) })
  }
  if (rawSteps.length > wet.length) {
    notes.push(`«${title}»: шагов без времени или веса пропущено ${rawSteps.length - wet.length} (в таймер они не входят)`)
  }

  const finish = num(raw.finish_s)
  const steps: BrewStep[] = wet.map((w, i) => {
    const end = i + 1 < wet.length ? wet[i + 1].at : finish !== undefined && finish > w.at ? finish : w.at + DEFAULT_LAST_STEP_S
    return { duration: Math.max(1, Math.round(end - w.at)), pourTo: round1(w.to), ...(w.note ? { note: w.note } : {}) }
  })
  if (!steps.length) {
    steps.push({ duration: finish !== undefined && finish > 0 ? Math.round(finish) : 180, pourTo: round1(water.value) })
  }

  const method = str(raw.method)
  const recipe: Recipe = stamp({
    id: uid(),
    title,
    method: method ? METHOD_IN[method] ?? method : 'v60',
    doseG: round1(coffee.value),
    waterG: round1(water.value),
    tempC: temp ? Math.round(temp.value) : DEFAULT_TEMP,
    grind: importGrind(raw.grind),
    steps,
    createdAt: Date.now(),
  })
  if (!recipe.grind) delete recipe.grind
  return { recipe }
}

export function parseCoffeeJSON(text: string): ImportResult {
  let doc: unknown
  try { doc = JSON.parse(text) } catch { throw new CoffeeJSONError('not_json', 'файл — не JSON') }
  if (!isObj(doc) || typeof doc.coffeejson !== 'string') {
    throw new CoffeeJSONError('not_a_document', 'это не документ CoffeeJSON (нет поля coffeejson)')
  }
  const major = Number(doc.coffeejson.split('.')[0])
  if (major !== 1) throw new CoffeeJSONError('unsupported_version', `версия формата ${doc.coffeejson} не поддерживается (нужна 1.x)`)

  const list = Array.isArray(doc.recipes) ? doc.recipes : []
  if (!list.length) {
    const hasBeans = Array.isArray(doc.beans) && doc.beans.length > 0
    throw new CoffeeJSONError('empty_document', hasBeans
      ? 'в документе только зерно — BrewMate пока импортирует рецепты'
      : 'в документе нет рецептов')
  }

  const out: ImportResult = { recipes: [], skipped: [], notes: [] }
  for (const raw of list) {
    const r = importRecipe(raw, out.notes)
    if (r.recipe) out.recipes.push(r.recipe)
    else if (r.skip) out.skipped.push(r.skip)
  }
  return out
}
