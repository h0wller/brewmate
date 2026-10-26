/* Запросы к vision-модели (фото пачки, фото помола). Лежит отдельным файлом без зависимостей от React и браузера:
   его используют и приложение (режим «свой ключ»), и серверная функция api/vision.ts,
   которая сама строит запрос и не принимает от клиента произвольный текст. */
import { SIZE_LABEL } from '../grinders/size.js'
import type { GrindSize } from '../grinders/size.js'
import { TARGET_UM } from '../grind/target.js'

export type PromptWater = 'soft' | 'balanced' | 'hard'
export const PROMPT_WATER: Record<PromptWater, string> = {
  soft: 'мягкая (TDS < 60 мг/л)',
  balanced: 'средняя (TDS 70–120 мг/л, баланс SCA)',
  hard: 'жёсткая (TDS > 150 мг/л)',
}
export const isPromptWater = (x: unknown): x is PromptWater =>
  typeof x === 'string' && Object.prototype.hasOwnProperty.call(PROMPT_WATER, x)

export interface PromptBeanContext {
  process?: 'washed' | 'natural' | 'honey' | 'anaerobic'
  roastLevel?: 'light' | 'medium' | 'dark'
  roastDate?: string
}

export interface PromptOptions { water?: PromptWater; doseG?: number; bean?: PromptBeanContext }

export function buildPackagePrompt(methodLabel: string, opts: PromptOptions = {}) {
  const dose = opts.doseG && opts.doseG > 0 ? opts.doseG : 15
  const waterHint = opts.water ? ` Вода пользователя: ${PROMPT_WATER[opts.water]} — учти это в температуре и экстракции.` : ''
  const bean = opts.bean
  const known = bean ? [bean.process && `обработка: ${bean.process}`, bean.roastLevel && `обжарка: ${bean.roastLevel}`, bean.roastDate && `дата обжарки: ${bean.roastDate}`].filter(Boolean) : []
  const beanHint = known.length ? ` Контекст карточки зерна (если подтверждается пачкой): ${known.join('; ')}.` : ''
  const brewerHint = /moccamaster/i.test(methodLabel)
    ? ' Для Moccamaster это автоматическая капельная кофеварка: не предлагай ручные круговые вливания; шаги должны описывать подготовку корзины и машинный цикл.'
    : ''
  return `Ты — опытный бариста. На фото — пачка кофе. Извлеки данные и составь рецепт для метода ${methodLabel}, доза ${dose} г.${waterHint}${beanHint}${brewerHint}
Все текстовые поля (title, note, notes) пиши на русском языке.
Верни СТРОГО JSON без markdown и пояснений:
{
  "bean": { "name": "строка", "origin": "строка", "process": "washed|natural|honey|anaerobic|other", "roastLevel": "light|medium|dark", "roastDate": "YYYY-MM-DD или null", "notes": "дескрипторы с пачки" },
  "recipe": { "title": "строка", "tempC": 88-96, "ratio": 14-17, "grindSize": "extra_fine|fine|medium_fine|medium|medium_coarse|coarse|extra_coarse", "steps": [ { "duration": секунды, "pourTo": суммарные граммы воды, "note": "строка" } ] }
}
grindSize — только одно значение из списка (уровень крупности помола), настройки конкретной кофемолки не придумывай.
Правила: используй дату обжарки для оценки свежести, не придумывай дату если её нет. Светлая обжарка обычно требует большей энергии экстракции, тёмная — меньшей. Натуральная, honey и анаэробная обработка не гарантируют одинаковую растворимость: не делай больших поправок только по названию процесса.
Для ручных проливных методов дай 3–5 шагов, первый — блюм (2–3 веса дозы). Для Moccamaster опиши подготовку фильтра и машинный цикл без ручных вливаний. pourTo растёт монотонно до dose*ratio.`
}

/* ---------- второе мнение по помолу ---------- */

export type GrindTaste = 'sour' | 'bitter' | 'ok'
export const isGrindTaste = (x: unknown): x is GrindTaste => x === 'sour' || x === 'bitter' || x === 'ok'

/* Только числа, измеренные приложением на телефоне, и выбор пользователя. Размеры модель сама не измеряет. */
export interface GrindFacts {
  size: GrindSize
  d10: number; d50: number; d90: number    // мкм, по объёму
  n: number                                // сколько частиц посчитано
  taste?: GrindTaste
}

export const GRIND_ISSUES = ['fines', 'clumps', 'uneven', 'bad_photo'] as const
export type GrindIssue = (typeof GRIND_ISSUES)[number]

const TASTE_TEXT: Record<GrindTaste, string> = {
  sour: 'кисло (похоже на недоэкстракцию)', bitter: 'горько (похоже на переэкстракцию)', ok: 'нормально',
}

export function buildGrindPrompt(f: GrindFacts): string {
  const [lo, hi] = TARGET_UM[f.size]
  return `Ты — опытный бариста. На фото — тонкий слой кофейного помола на белой бумаге рядом с монетой.
Приложение уже измерило частицы на телефоне. Эти числа точные, ты размеры сам не измеряй и не оспаривай без явной причины на фото:
- типичный размер частиц D50: ${Math.round(f.d50)} мкм (D10 ${Math.round(f.d10)}, D90 ${Math.round(f.d90)}), посчитано частиц: ${f.n}
- пользователь хочет помол «${SIZE_LABEL[f.size]}»: ориентир D50 ${lo}–${hi} мкм (это приблизительное правило, не стандарт)
- вкус прошлой заварки: ${f.taste ? TASTE_TEXT[f.taste] : 'не указан'}
Оцени по фото то, что числа не показывают: много ли мелкой пыли, есть ли слипшиеся комки, насколько неравномерный помол, годится ли снимок для оценки.
Верни СТРОГО JSON без markdown и пояснений:
{ "verdict": "ok|finer|coarser|unsure", "comment": "1–3 предложения по-русски: что сделать с помолом и почему", "issues": ["fines","clumps","uneven","bad_photo"] }
verdict: finer — помол надо сделать мельче, coarser — крупнее, ok — оставить, unsure — по снимку судить нельзя. issues — только те пункты, которые видны на фото, или пустой список.
Не придумывай настройки конкретной кофемолки и не называй числа кликов.`
}
