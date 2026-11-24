/* Разбор текста из числового поля. Пусто или не число — null (поле можно очистить целиком,
   а не оставлять в нём последнюю цифру). Запятая — тоже десятичный разделитель. */
export function parseNum(text: string): number | null {
  const t = text.trim().replace(',', '.')
  if (t === '' || t === '.' || t === '-') return null
  if (!/^-?\d*\.?\d*$/.test(t)) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

/* Число → текст для поля: ноль и «нет значения» показываем пустым (виден placeholder) */
export const fmtNum = (v: number | null | undefined): string =>
  v === null || v === undefined || v === 0 || !Number.isFinite(v) ? '' : String(v)

/* Число подходит для поля с границами */
export const inRange = (n: number | null, min: number, max: number): n is number =>
  n !== null && n >= min && n <= max
