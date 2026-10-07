/**
 * Generates placeholder PWA icons (no image deps — raw PNG via zlib).
 * Draws a simple dumbbell mark in the app accent on the dark app background.
 * Run: node scripts/generate-icons.mjs
 */
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { Buffer } from 'node:buffer'

const BG = [10, 10, 11] // #0a0a0b  app background
const FG = [122, 240, 110] // #7af06e accent green
const MASK_BG = [18, 18, 20] // slightly lifted so maskable crop reads well

function crc32(buf) {
  let c
  const table = []
  for (let n = 0; n < 256; n++) {
    c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  let crc = 0xffffffff
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function png(size, pixel) {
  // raw scanlines: 1 filter byte (0 = none) + RGB triplets
  const raw = Buffer.alloc(size * (1 + size * 3))
  let o = 0
  for (let y = 0; y < size; y++) {
    raw[o++] = 0
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixel(x, y)
      raw[o++] = r
      raw[o++] = g
      raw[o++] = b
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // color type: truecolor
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/** Rounded-rect hit test in 0..1 normalized space. */
function rrect(x, y, cx, cy, hw, hh, r) {
  const dx = Math.abs(x - cx) - (hw - r)
  const dy = Math.abs(y - cy) - (hh - r)
  if (dx <= 0 || dy <= 0) return Math.abs(x - cx) <= hw && Math.abs(y - cy) <= hh
  return dx * dx + dy * dy <= r * r
}

/** The dumbbell glyph: two end plates + a connecting bar. */
function glyph(u, v) {
  const bar = rrect(u, v, 0.5, 0.5, 0.34, 0.052, 0.05)
  const plateL = rrect(u, v, 0.215, 0.5, 0.075, 0.185, 0.07)
  const plateR = rrect(u, v, 0.785, 0.5, 0.075, 0.185, 0.07)
  return bar || plateL || plateR
}

function make(size, { bg, inset = 1, rounded = false }) {
  return png(size, (x, y) => {
    const u = (x + 0.5) / size
    const v = (y + 0.5) / size
    // Squeeze the glyph toward the center for maskable safe-zone.
    const cu = 0.5 + (u - 0.5) / inset
    const cv = 0.5 + (v - 0.5) / inset
    if (rounded && !rrect(u, v, 0.5, 0.5, 0.5, 0.5, 0.22)) return [0, 0, 0]
    return glyph(cu, cv) ? FG : bg
  })
}

mkdirSync('public/icons', { recursive: true })
const out = {
  'public/icons/icon-192.png': make(192, { bg: BG }),
  'public/icons/icon-512.png': make(512, { bg: BG }),
  // maskable: glyph scaled into the ~80% safe zone so OS cropping can't clip it
  'public/icons/icon-maskable-512.png': make(512, { bg: MASK_BG, inset: 1.45 }),
  'public/icons/apple-touch-icon.png': make(180, { bg: BG }),
  'public/icons/favicon.png': make(64, { bg: BG }),
}
for (const [path, buf] of Object.entries(out)) {
  writeFileSync(path, buf)
  console.log(`wrote ${path} (${buf.length} bytes)`)
}
