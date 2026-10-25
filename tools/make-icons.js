// ホーム画面用アイコン（青い地に、上が赤い白の暦の紙）を app/icons/ に PNG で書き出す。
// 使い方: node tools/make-icons.js
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const OUT = path.join(__dirname, "..", "app", "icons");
fs.mkdirSync(OUT, { recursive: true });
const BG = [0x2a, 0x78, 0xd6]; // 地（アプリの強調色と同じ青）
const PAGE = [0xff, 0xff, 0xff]; // 暦の紙
const HEAD = [0xe5, 0x48, 0x4d]; // 紙の上の帯
const CELL = [0xd5, 0xdb, 0xe3]; // 日のます
const MARK = [0x2a, 0x78, 0xd6]; // 印を付けた日（「今日」）

// 角の丸い四角の中か（0〜1 の座標）
function inRRect(x, y, x0, y0, x1, y1, r) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  return Math.hypot(x - cx, y - cy) <= r;
}

// 0〜1 の座標の色。紙の下の部分に 4列×3段 の日のますを並べ、1つだけ青くする
function colorAt(x, y) {
  if (!inRRect(x, y, 0.18, 0.2, 0.82, 0.82, 0.08)) return BG;
  if (y < 0.36) return HEAD;
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 4; col++) {
      const x0 = 0.25 + col * 0.13, y0 = 0.44 + row * 0.12;
      if (inRRect(x, y, x0, y0, x0 + 0.1, y0 + 0.08, 0.02)) return row === 1 && col === 2 ? MARK : CELL;
    }
  }
  return PAGE;
}

function png(size) {
  const SS = 4; // 縁をなめらかにするため 4x4 で色を混ぜる
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let j = 0; j < size; j++) {
    raw[j * (size * 3 + 1)] = 0;
    for (let i = 0; i < size; i++) {
      const sum = [0, 0, 0];
      for (let a = 0; a < SS; a++)
        for (let b = 0; b < SS; b++) {
          const c = colorAt((i + (a + 0.5) / SS) / size, (j + (b + 0.5) / SS) / size);
          for (let k = 0; k < 3; k++) sum[k] += c[k];
        }
      const o = j * (size * 3 + 1) + 1 + i * 3;
      for (let k = 0; k < 3; k++) raw[o + k] = Math.round(sum[k] / (SS * SS));
    }
  }
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const x of buf) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, body) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(body.length);
    const tb = Buffer.concat([Buffer.from(type), body]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(tb));
    return Buffer.concat([len, tb, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8bit RGB（アルファ無し。iPhone アプリに包むときもそのまま使える）
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

for (const s of [180, 192, 512]) {
  fs.writeFileSync(path.join(OUT, `icon-${s}.png`), png(s));
  console.log(`icon-${s}.png`);
}
