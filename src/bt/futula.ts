/* FUTULA / LFSmart Scale
   Пакет 11 байт: ca 02 06 WW WW 00 00 00 U1 U2 CK
   WW — сырой вес, little-endian, /10 = граммы
   U1 — единицы: 0x04 = г, 0x07 = мл, 0x06/0x08 = др. режимы
   CK = XOR первых 10 байт */

const UNIT_MAP: Record<number, string> = {
  0x04: 'г',
  0x07: 'мл',
  0x06: 'oz',
  0x08: 'lb',
}

export function parseFutula(bytes: Uint8Array): { rawG: number; stable: boolean; unit: string } | null {
  if (bytes.length !== 11) return null
  if (bytes[0] !== 0xca || bytes[1] !== 0x02 || bytes[2] !== 0x06) return null
  let ck = 0
  for (let i = 0; i < 10; i++) ck ^= bytes[i]
  if (ck !== bytes[10]) return null
  const raw = bytes[3] | (bytes[4] << 8)
  const stable = bytes[9] === 0x01
  const unit = UNIT_MAP[bytes[8]] ?? `0x${bytes[8].toString(16)}`
  return { rawG: raw / 10, stable, unit }
}