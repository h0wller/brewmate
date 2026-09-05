/* FUTULA / LFSmart Scale (протокол 20, реверс из родного APK)
   Пакет 11 байт: ca 02 06 WW WW NEG 00 00 U1 U2 CK
   NEG — байт 5: != 0 → вес отрицательный
   U1  — единицы: 0x04 г, 0x07 мл, 0x06 oz, 0x08 lb
   U2  — байт 9: 0x00 = стабильно, 0x01 = процесс
   CK  — XOR первых 10 байт
   Команды: ck = XOR ВСЕХ байтов команды (проверено на fd 00 07 … fa) */

const UNIT_MAP: Record<number, string> = { 0x04: 'г', 0x07: 'мл', 0x06: 'oz', 0x08: 'lb' }

export function parseFutula(bytes: Uint8Array): { rawG: number; stable: boolean; unit: string } | null {
  if (bytes.length !== 11) return null
  if (bytes[0] !== 0xca || bytes[2] !== 0x06) return null
  let ck = 0
  for (let i = 0; i < 10; i++) ck ^= bytes[i]
  if (ck !== bytes[10]) return null
  const raw = (bytes[3] | (bytes[4] << 8)) / 10
  const neg = bytes[5] !== 0
  const stable = bytes[9] === 0x00
  const unit = UNIT_MAP[bytes[8]] ?? `0x${bytes[8].toString(16)}`
  return { rawG: neg ? -raw : raw, stable, unit }
}

const xorAll = (b: number[]) => b.reduce((a, x) => a ^ x, 0)

/* FD-команда: FD TT 00… + ck (XOR всех) */
export const fdCmd = (type: number): number[] => {
  const b = [0xfd, type, 0, 0, 0, 0, 0, 0, 0, 0]
  return [...b, xorAll(b)]
}

export const unitCmd = (code: number) => fdCmd(code) // FD 00 UU… — единицы из ik.h()