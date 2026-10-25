/* Запрос к vision-модели по фото пачки. Лежит отдельным файлом без зависимостей:
   его используют и приложение (режим «свой ключ»), и серверная функция api/vision.ts,
   которая сама строит запрос и не принимает от клиента произвольный текст. */
export type PromptWater = 'soft' | 'balanced' | 'hard'
export const PROMPT_WATER: Record<PromptWater, string> = {
  soft: 'мягкая (TDS < 60 мг/л)',
  balanced: 'средняя (TDS 70–120 мг/л, баланс SCA)',
  hard: 'жёсткая (TDS > 150 мг/л)',
}
export const isPromptWater = (x: unknown): x is PromptWater =>
  typeof x === 'string' && Object.prototype.hasOwnProperty.call(PROMPT_WATER, x)

export interface PromptOptions { water?: PromptWater; doseG?: number }

export function buildPackagePrompt(methodLabel: string, opts: PromptOptions = {}) {
  const dose = opts.doseG && opts.doseG > 0 ? opts.doseG : 15
  const waterHint = opts.water ? ` Вода пользователя: ${PROMPT_WATER[opts.water]} — учти это в температуре, помоле и числе вливаний.` : ''
  return `Ты — чемпион-бариста. На фото — пачка кофе. Извлеки данные и составь рецепт для метода ${methodLabel}, доза ${dose} г.${waterHint}
Все текстовые поля (title, note, notes) пиши на русском языке.
Верни СТРОГО JSON без markdown и пояснений:
{
  "bean": { "name": "строка", "origin": "строка", "process": "washed|natural|honey|anaerobic|other", "roastLevel": "light|medium|dark", "roastDate": "YYYY-MM-DD или null", "notes": "дескрипторы с пачки" },
  "recipe": { "title": "строка", "tempC": 88-96, "ratio": 14-17, "grindSize": "extra_fine|fine|medium_fine|medium|medium_coarse|coarse|extra_coarse", "steps": [ { "duration": секунды, "pourTo": суммарные граммы воды, "note": "строка" } ] }
}
grindSize — только одно значение из списка (уровень крупности помола), настройки конкретной кофемолки не придумывай.
Правила: светлая обжарка — вода горячее и помол мельче; тёмная — вода холоднее и помол крупнее; натуральная и анаэробная обработка — чуть крупнее помол.
steps: 3–5 шагов, первый — блюм (2–3 веса дозы), pourTo растёт монотонно до dose*ratio.`
}
