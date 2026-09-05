/* FUTULA / LFSmart Scale
   Пакет 11 байт: ca 02 06 WW WW 00 00 00 U1 U2 CK
   WW — сырой вес, little-endian, делим на 10 = граммы
   CK = XOR первых 10 байт */

export function parseFutula(bytes: Uint8Array): { rawG: number; stable: boolean } | null {
  if (bytes.length !== 11) return null
  if (bytes[0] !== 0xca || bytes[1] !== 0x02 || bytes[2] !== 0x06) return null
  let ck = 0
  for (let i = 0; i < 10; i++) ck ^= bytes[i]
  if (ck !== bytes[10]) return null
  const raw = bytes[3] | (bytes[4] << 8)
  const stable = bytes[9] === 0x01
  return { rawG: raw / 10, stable }
}