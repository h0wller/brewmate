/* Запрос к vision-модели по фото пачки. Лежит отдельным файлом без зависимостей:
   его используют и приложение (режим «свой ключ»), и серверная функция api/vision.ts,
   которая сама строит запрос и не принимает от клиента произвольный текст. */
export function buildPackagePrompt(methodLabel: string) {
  return `Ты — чемпион-бариста. На фото — пачка кофе. Извлеки данные и составь рецепт для метода ${methodLabel}, доза 15 г.
Все текстовые поля (title, note, notes) пиши на русском языке.
Верни СТРОГО JSON без markdown и пояснений:
{
  "bean": { "name": "строка", "origin": "строка", "process": "washed|natural|honey|anaerobic|other", "roastLevel": "light|medium|dark", "roastDate": "YYYY-MM-DD или null", "notes": "дескрипторы с пачки" },
  "recipe": { "title": "строка", "tempC": 88-96, "ratio": 14-17, "grindSize": "extra_fine|fine|medium_fine|medium|medium_coarse|coarse|extra_coarse", "steps": [ { "duration": секунды, "pourTo": суммарные граммы воды, "note": "строка" } ] }
}
grindSize — только одно значение из списка (уровень крупности помола), настройки конкретной кофемолки не придумывай.
Правила: светлая обжарка — вода горячее и помол мельче; тёмная — вода холоднее и помол крупнее; натуральная обработка — чуть крупнее помол.
steps: 3–5 шагов, первый — блюм (2–3 веса дозы), pourTo растёт монотонно до dose*ratio.`
}
