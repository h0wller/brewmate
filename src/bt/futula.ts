/* Протокол FUTULA / LFSmart Scale
   Пакет 11 байт: ca 02 06 WW WW 00 00 00 U1 U2 CK
   WW — вес (little-endian, 16-бит), делим на 10 = граммы
   CK = XOR первых 10 байт */

export function parseFutula(bytes: Uint8Array): { weightG: number; stable: boolean } | null {
  if (bytes.length !== 11) return null
  if (bytes[0] !== 0xca || bytes[1] !== 0x02 || bytes[2] !== 0x06) return null

  let ck = 0
  for (let i = 0; i < 10; i++) ck ^= bytes[i]
  if (ck !== bytes[10]) return null // битая контрольная сумма

  const raw = bytes[3] | (bytes[4] << 8)
  // U1/U2: признак стабильности/единиц. Эмпирически: U2=01 обычно "готово"
  const stable = bytes[9] === 0x01
  const sign = bytes[8] === 0x00 && bytes[9] === 0x00 ? -1 : 1
  return { weightG: (raw / 10) * sign, stable }
}

/* Команда TARE — стандартная для LFSmart/FUTULA */
export const TARE_CMD = new Uint8Array([0x03, 0x0a, 0x01, 0x00, 0x00, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00, 0x10])