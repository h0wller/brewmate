import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'

/* --- минимальный PNG-энкодер --- */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
const crc32 = (buf) => {
  let c = 0xffffffff
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}
function png(size, pixelFn) {
  const raw = Buffer.alloc(size * (size * 4 + 1))
  let o = 0
  for (let y = 0; y < size; y++) {
    raw[o++] = 0
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixelFn(x, y)
      raw[o++] = r; raw[o++] = g; raw[o++] = b; raw[o++] = a
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 6
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/* --- рисунок: чашка с паром на тёмном фоне --- */
const BG = [23, 23, 26, 255], W = [242, 242, 247, 255], BLUE = [75, 142, 241, 255]
const pixel = () => (x, y, ) => {
  const u = (x + 0.5) / SIZE, v = (y + 0.5) / SIZE
  const steam = (cx) => Math.abs(u - cx - 0.02 * Math.sin(v * 18)) < 0.018 && v > 0.14 && v < 0.36
  if (steam(0.42) || steam(0.56)) return W
  const inCup = (u > 0.26 && u < 0.72 && v > 0.42 && v < 0.66) ||
    (((u - 0.49) / 0.23) ** 2 + ((v - 0.66) / 0.09) ** 2 < 1 && v >= 0.66 && v < 0.76)
  if (inCup) return W
  const hx = u - 0.78, hy = v - 0.55
  const d = Math.sqrt(hx * hx + hy * hy)
  if (d < 0.11 && d > 0.06 && v > 0.45 && v < 0.66) return W
  if (v > 0.78 && v < 0.82 && u > 0.2 && u < 0.78) return BLUE
  return BG
}

let SIZE = 192
mkdirSync('public/icons', { recursive: true })
for (const s of [192, 512, 180]) {
  SIZE = s
  const name = s === 180 ? 'apple-180.png' : `icon-${s}.png`
  writeFileSync(`public/icons/${name}`, png(s, pixel()))
}
console.log('✅ иконки в public/icons')