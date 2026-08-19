const fs = require('fs');
const path = require('path');

const S = 4;
const W = 256 * S;
const buf = new Float32Array(W * W * 4);

function px(x, y) { return (y * W + x) * 4; }

function blend(x0, y0, x1, y1, r, g, b, a, test) {
  for (let y = Math.max(0, y0); y < Math.min(W, y1); y++) {
    for (let x = Math.max(0, x0); x < Math.min(W, x1); x++) {
      if (!test(x, y)) continue;
      const i = px(x, y);
      const oa = buf[i + 3] / 255;
      const sa = a;
      const da = sa + oa * (1 - sa);
      buf[i] = (r * sa + buf[i] * oa * (1 - sa)) / da;
      buf[i + 1] = (g * sa + buf[i + 1] * oa * (1 - sa)) / da;
      buf[i + 2] = (b * sa + buf[i + 2] * oa * (1 - sa)) / da;
      buf[i + 3] = da * 255;
    }
  }
}

function insideRR(x, y, x0, y0, x1, y1, rad) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const dx = Math.max(x0 + rad - x, 0, x - (x1 - rad));
  const dy = Math.max(y0 + rad - y, 0, y - (y1 - rad));
  return dx * dx + dy * dy <= rad * rad;
}

function fillRR(x0, y0, x1, y1, rad, r, g, b, a) {
  blend(x0, y0, x1, y1, r, g, b, a, (x, y) => insideRR(x, y, x0, y0, x1, y1, rad));
}

function strokeRR(x0, y0, x1, y1, rad, width, r, g, b, a) {
  blend(x0 - width, y0 - width, x1 + width, y1 + width, r, g, b, a, (x, y) => {
    const big = insideRR(x, y, x0 - width, y0 - width, x1 + width, y1 + width, rad + width);
    const small = insideRR(x, y, x0, y0, x1, y1, rad);
    return big && !small;
  });
}

function fillCircle(cx, cy, rad, r, g, b, a) {
  blend(cx - rad, cy - rad, cx + rad, cy + rad, r, g, b, a, (x, y) => {
    const dx = x - cx, dy = y - cy;
    return dx * dx + dy * dy <= rad * rad;
  });
}

function ring(cx, cy, rad, width, r, g, b, a) {
  blend(cx - rad - width, cy - rad - width, cx + rad + width, cy + rad + width, r, g, b, a, (x, y) => {
    const d = Math.hypot(x - cx, y - cy);
    return d <= rad + width && d >= rad - width;
  });
}

const coverTop = [0x3d, 0x52, 0x66];
const coverBot = [0x2c, 0x3b, 0x4b];

for (let y = 0; y < W; y++) {
  const t = y / W;
  const r = coverTop[0] + (coverBot[0] - coverTop[0]) * t;
  const g = coverTop[1] + (coverBot[1] - coverTop[1]) * t;
  const b = coverTop[2] + (coverBot[2] - coverTop[2]) * t;
  for (let x = 0; x < W; x++) {
    const i = px(x, y);
    buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = 255;
  }
}

const mask = (x, y) => insideRR(x, y, 12, 12, W - 12, W - 12, 96);
blend(0, 0, W, W, 0, 0, 0, 1, (x, y) => !mask(x, y));
blend(0, 0, W, W, coverTop[0], coverTop[1], coverTop[2], 1, mask);

const GLASS = [0, 0, 0, 0];
const glowTop = 26;
const glowBot = 74;

fillRR(272, 288, 752, 868, 56, 0x7a, 0xc4, 0xd4, 0.22);
fillRR(340, 216, 684, 304, 24, 0x9b, 0xcf, 0xdb, 0.5);

const waterTop = 600;
blend(272, waterTop, 752, 868, 0, 0, 0, 0.04, () => true);
fillRR(272, waterTop, 752, 868, 56, 0, 0, 0, 0, (x, y) => {
  const t = (y - waterTop) / (868 - waterTop);
  return t > 0;
});
for (let y = 0; y < W; y++) {
  for (let x = 0; x < W; x++) {
    if (x < 272 || x > 752 || y < waterTop || y > 868) continue;
    const t = (y - waterTop) / (868 - waterTop);
    const r = 0x6f + (0x2f - 0x6f) * t;
    const g = 0xbf + (0x8f - 0xbf) * t;
    const b = 0xd0 + (0xa8 - 0xd0) * t;
    const i = px(x, y);
    const sa = 0.97;
    const oa = buf[i + 3] / 255;
    const da = sa + oa * (1 - sa);
    buf[i] = (r * sa + buf[i] * oa * (1 - sa)) / da;
    buf[i + 1] = (g * sa + buf[i + 1] * oa * (1 - sa)) / da;
    buf[i + 2] = (b * sa + buf[i + 2] * oa * (1 - sa)) / da;
    buf[i + 3] = da * 255;
  }
}

fillCircle(512, 738, 114, 0xc6, 0x9a, 0x4e, 1);
fillCircle(512, 738, 88, 0xe8, 0xd2, 0x95, 1);
ring(512, 738, 88, 10, 0xa9, 0x7c, 0x3c, 1);

const bubbles = [
  [470, 470, 24], [548, 420, 15], [600, 492, 10], [420, 540, 13], [520, 536, 9]
];
for (const [bx, by, br] of bubbles) fillCircle(bx, by, br, 255, 255, 255, 0.55);

strokeRR(272, 288, 752, 868, 56, 18, 255, 255, 255, 0.92);
strokeRR(340, 216, 684, 304, 24, 18, 255, 255, 255, 0.92);

for (let y = 0; y < W; y++) {
  for (let x = 0; x < W; x++) {
    if (x < 300 || x > 324 || y < 360 || y > 820) continue;
    const i = px(x, y);
    const sa = 0.4;
    const oa = buf[i + 3] / 255;
    const da = sa + oa * (1 - sa);
    buf[i] = (255 * sa + buf[i] * oa * (1 - sa)) / da;
    buf[i + 1] = (255 * sa + buf[i + 1] * oa * (1 - sa)) / da;
    buf[i + 2] = (255 * sa + buf[i + 2] * oa * (1 - sa)) / da;
    buf[i + 3] = da * 255;
  }
}

const out = Buffer.alloc(256 * 256 * 4);
for (let y = 0; y < 256; y++) {
  for (let x = 0; x < 256; x++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let sy = 0; sy < S; sy++) {
      for (let sx = 0; sx < S; sx++) {
        const i = px(x * S + sx, y * S + sy);
        r += buf[i]; g += buf[i + 1]; b += buf[i + 2]; a += buf[i + 3];
      }
    }
    const n = S * S;
    const oi = ((255 - y) * 256 + x) * 4;
    out[oi] = Math.round(b / n);
    out[oi + 1] = Math.round(g / n);
    out[oi + 2] = Math.round(r / n);
    out[oi + 3] = Math.round(a / n);
  }
}

const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(1, 4);
const entry = Buffer.alloc(16);
entry[0] = 0; entry[1] = 0;
entry[2] = 0; entry[3] = 0;
entry.writeUInt16LE(1, 4);
entry.writeUInt16LE(32, 6);
entry.writeUInt32LE(40 + out.length, 8);
entry.writeUInt32LE(22, 12);
const info = Buffer.alloc(40);
info.writeUInt32LE(40, 0);
info.writeInt32LE(256, 4);
info.writeInt32LE(256 * 2, 8);
info.writeUInt16LE(1, 12);
info.writeUInt16LE(32, 14);
info.writeUInt32LE(out.length, 20);

const ico = Buffer.concat([header, entry, info, out]);
const target = path.join(__dirname, 'icon.ico');
fs.writeFileSync(target, ico);
console.log('icon.ico written:', target, ico.length, 'bytes');