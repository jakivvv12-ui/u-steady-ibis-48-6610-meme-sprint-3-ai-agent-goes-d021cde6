// Meme Sprint 3: AI Agent Goes Rogue
// One 1024x1024 meme image, drawn from scratch with a raw pixel buffer
// and a hand-rolled PNG encoder. Zero dependencies, fully deterministic.
import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const W = 1024;
const H = 1024;
const buf = new Uint8Array(W * H * 3);

// ---------- pixel helpers ----------
function px(x: number, y: number, r: number, g: number, b: number): void {
  const xi = Math.round(x);
  const yi = Math.round(y);
  if (xi < 0 || yi < 0 || xi >= W || yi >= H) return;
  const i = (yi * W + xi) * 3;
  buf[i] = r;
  buf[i + 1] = g;
  buf[i + 2] = b;
}
type RGB = [number, number, number];
function fillRect(x0: number, y0: number, x1: number, y1: number, c: RGB): void {
  const xa = Math.max(0, Math.floor(x0));
  const xb = Math.min(W - 1, Math.ceil(x1));
  const ya = Math.max(0, Math.floor(y0));
  const yb = Math.min(H - 1, Math.ceil(y1));
  for (let y = ya; y <= yb; y++) {
    for (let x = xa; x <= xb; x++) {
      const i = (y * W + x) * 3;
      buf[i] = c[0];
      buf[i + 1] = c[1];
      buf[i + 2] = c[2];
    }
  }
}
function fillEllipse(cx: number, cy: number, rx: number, ry: number, c: RGB): void {
  for (let dy = -Math.ceil(ry); dy <= Math.ceil(ry); dy++) {
    const t = 1 - (dy * dy) / (ry * ry);
    if (t < 0) continue;
    const dx = Math.floor(rx * Math.sqrt(t));
    for (let x = -dx; x <= dx; x++) px(cx + x, cy + dy, c[0], c[1], c[2]);
  }
}
function ringEllipse(cx: number, cy: number, rx: number, ry: number, t: number, c: RGB): void {
  const ix = Math.max(1, rx - t);
  const iy = Math.max(1, ry - t);
  for (let dy = -Math.ceil(ry); dy <= Math.ceil(ry); dy++) {
    for (let dx = -Math.ceil(rx); dx <= Math.ceil(rx); dx++) {
      const outer = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry);
      const inner = (dx * dx) / (ix * ix) + (dy * dy) / (iy * iy);
      if (outer <= 1 && inner > 1) px(cx + dx, cy + dy, c[0], c[1], c[2]);
    }
  }
}
function thickLine(x0: number, y0: number, x1: number, y1: number, r: number, c: RGB): void {
  const dist = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.max(1, Math.ceil(dist));
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    fillEllipse(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r, r, c);
  }
}
function fillTriangle(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, c: RGB): void {
  const minY = Math.floor(Math.min(y0, y1, y2));
  const maxY = Math.ceil(Math.max(y0, y1, y2));
  for (let y = minY; y <= maxY; y++) {
    const xs: number[] = [];
    const edges: Array<[number, number, number, number]> = [[x0, y0, x1, y1], [x1, y1, x2, y2], [x2, y2, x0, y0]];
    for (const [ax, ay, bx, by] of edges) {
      if ((ay <= y && by > y) || (by <= y && ay > y)) {
        xs.push(ax + ((y - ay) / (by - ay)) * (bx - ax));
      }
    }
    if (xs.length >= 2) {
      const xa = Math.min(...xs);
      const xb = Math.max(...xs);
      fillRect(xa, y, xb, y, c);
    }
  }
}
function roundRect(x0: number, y0: number, x1: number, y1: number, rad: number, c: RGB): void {
  fillRect(x0 + rad, y0, x1 - rad, y1, c);
  fillRect(x0, y0 + rad, x1, y1 - rad, c);
  fillEllipse(x0 + rad, y0 + rad, rad, rad, c);
  fillEllipse(x1 - rad, y0 + rad, rad, rad, c);
  fillEllipse(x0 + rad, y1 - rad, rad, rad, c);
  fillEllipse(x1 - rad, y1 - rad, rad, rad, c);
}

// ---------- 5x7 bitmap font ----------
const FONT: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
  "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  "%": ["11001", "11010", "00010", "00100", "01000", "01011", "10011"],
  ":": ["00000", "00100", "00000", "00000", "00000", "00100", "00000"],
  '"': ["01010", "01010", "00000", "00000", "00000", "00000", "00000"],
  "'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ",": ["00000", "00000", "00000", "00000", "01100", "00100", "01000"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  "?": ["01110", "10001", "00001", "00110", "00100", "00000", "00100"],
  "-": ["00000", "00000", "00000", "01110", "00000", "00000", "00000"],
  "(": ["00010", "00100", "01000", "01000", "01000", "00100", "00010"],
  ")": ["01000", "00100", "00010", "00010", "00010", "00100", "01000"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
};
function textWidth(s: string, scale: number): number {
  return s.length * 6 * scale - scale;
}
function drawTextRaw(s: string, x: number, y: number, scale: number, c: RGB): void {
  let cx = x;
  for (const ch of s.toUpperCase()) {
    const g = FONT[ch] ?? FONT[" "];
    for (let r = 0; r < 7; r++) {
      for (let col = 0; col < 5; col++) {
        if (g[r][col] === "1") {
          fillRect(cx + col * scale, y + r * scale, cx + col * scale + scale - 1, y + r * scale + scale - 1, c);
        }
      }
    }
    cx += 6 * scale;
  }
}
function drawText(s: string, cx: number, y: number, scale: number, c: RGB, outline: RGB | null): void {
  const w = textWidth(s, scale);
  const x = cx - w / 2;
  if (outline) {
    const o = Math.max(2, Math.round(scale / 2));
    for (const [dx, dy] of [[-o, 0], [o, 0], [0, -o], [0, o], [-o, -o], [o, -o], [-o, o], [o, o]] as const) {
      drawTextRaw(s, x + dx, y + dy, scale, outline);
    }
  }
  drawTextRaw(s, x, y, scale, c);
}

// ---------- CRC32 + PNG ----------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}
function encodePNG(): Uint8Array {
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, W);
  dv.setUint32(4, H);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  const raw = new Uint8Array(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0;
    raw.set(buf.subarray(y * W * 3, (y + 1) * W * 3), y * (1 + W * 3) + 1);
  }
  const idat = deflateSync(raw, { level: 9 });
  const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const parts = [sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", new Uint8Array(0))];
  const total = parts.reduce((a, p) => a + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

// ---------- palette ----------
const CREAM: RGB = [255, 246, 216];
const INK: RGB = [20, 24, 30];
const WALL: RGB = [191, 227, 240];
const WALL_D: RGB = [150, 200, 220];
const WATER_TOP: RGB = [46, 127, 194];
const WATER_BOT: RGB = [16, 74, 128];
const NAVY: RGB = [11, 42, 74];
const WHITE: RGB = [255, 255, 255];
const ROBOT: RGB = [217, 222, 227];
const ROBOT_D: RGB = [199, 205, 212];
const DARK: RGB = [58, 68, 80];
const RED: RGB = [255, 42, 42];
const RED_D: RGB = [200, 20, 20];
const ORANGE: RGB = [255, 122, 26];
const SKIN: RGB = [244, 196, 150];
const COUCH: RGB = [176, 92, 52];
const YELLOW: RGB = [255, 214, 64];

// ---------- scene ----------
function drawScene(): void {
  // top caption band
  fillRect(0, 0, W - 1, 169, CREAM);
  fillRect(0, 166, W - 1, 169, INK);
  drawText('ME: "REMIND ME TO', 512, 28, 6, INK, null);
  drawText('DRINK MORE WATER"', 512, 88, 6, INK, null);

  // wall
  fillRect(0, 170, W - 1, 859, WALL);
  // window on the wall: blue sky, sun, green hill
  fillRect(84, 220, 244, 380, WHITE);
  fillRect(92, 228, 236, 372, [135, 205, 240]);
  fillEllipse(130, 265, 22, 22, YELLOW);
  fillRect(92, 348, 236, 372, [90, 180, 100]);
  // wall clock (moved below the speech bubble)
  fillEllipse(900, 470, 46, 46, WHITE);
  ringEllipse(900, 470, 46, 46, 6, DARK);
  thickLine(900, 470, 900, 436, 4, DARK);
  thickLine(900, 470, 924, 480, 4, DARK);

  // water with wavy top edge
  for (let x = 0; x < W; x++) {
    const top = 560 + Math.round(8 * Math.sin(x * 0.02));
    for (let y = top; y < 860; y++) {
      const t = (y - 560) / 300;
      const r = Math.round(WATER_TOP[0] + (WATER_BOT[0] - WATER_TOP[0]) * t);
      const g = Math.round(WATER_TOP[1] + (WATER_BOT[1] - WATER_TOP[1]) * t);
      const b = Math.round(WATER_TOP[2] + (WATER_BOT[2] - WATER_TOP[2]) * t);
      px(x, y, r, g, b);
    }
  }
  // wave highlight strokes
  for (let x = 0; x < W; x += 2) {
    px(x, 600 + Math.round(6 * Math.sin(x * 0.02)), 120, 185, 235);
    px(x, 700 + Math.round(6 * Math.sin(x * 0.017 + 2)), 90, 165, 220);
    px(x, 800 + Math.round(6 * Math.sin(x * 0.021 + 4)), 70, 145, 205);
  }

  // floating couch, left, half-submerged
  fillRect(110, 520, 360, 600, COUCH);
  fillRect(110, 500, 360, 540, [150, 74, 40]);
  fillRect(120, 545, 190, 585, [210, 120, 70]);
  fillRect(270, 545, 350, 585, [210, 120, 70]);

  // panicking user on the couch: head + waving arm above water
  fillEllipse(235, 470, 34, 38, SKIN);
  fillEllipse(235, 442, 36, 20, [60, 42, 26]); // hair
  fillEllipse(222, 466, 8, 10, WHITE);
  fillEllipse(248, 466, 8, 10, WHITE);
  px(222, 468, 0, 0, 0);
  px(248, 468, 0, 0, 0);
  fillEllipse(235, 492, 9, 6, [120, 40, 40]); // open mouth
  thickLine(275, 500, 315, 430, 9, SKIN); // waving arm
  fillEllipse(315, 428, 12, 12, SKIN);
  drawText("HELP!", 235, 380, 3, INK, WHITE);

  // rubber duck
  fillEllipse(855, 650, 38, 24, YELLOW);
  fillEllipse(824, 622, 19, 18, YELLOW);
  fillEllipse(804, 622, 9, 6, ORANGE); // beak
  px(828, 616, 0, 0, 0);
  // floating book
  fillRect(760, 730, 850, 766, WHITE);
  fillRect(766, 738, 844, 744, [90, 120, 200]);
  fillRect(766, 750, 830, 756, [90, 120, 200]);
  // tipped plant pot
  fillRect(330, 700, 390, 740, [176, 92, 52]);
  fillEllipse(360, 700, 26, 14, [60, 140, 70]);
  fillEllipse(345, 690, 14, 12, [80, 170, 90]);
  fillEllipse(378, 688, 14, 12, [80, 170, 90]);

  // fish
  fillEllipse(180, 760, 30, 16, ORANGE);
  fillTriangle(152, 760, 128, 744, 128, 776, ORANGE);
  px(202, 756, 0, 0, 0);
  fillEllipse(700, 800, 24, 13, [255, 160, 80]);
  fillTriangle(678, 800, 658, 787, 658, 813, [255, 160, 80]);
  px(718, 797, 0, 0, 0);

  // ---- robot, centre-right, floating on an inflatable ring ----
  const cx = 580;
  // antenna
  thickLine(cx, 300, cx, 250, 5, DARK);
  fillEllipse(cx, 242, 12, 12, RED);
  fillEllipse(cx - 4, 238, 4, 4, [255, 150, 150]);
  // ears
  fillRect(cx - 118, 350, cx - 100, 400, ROBOT_D);
  fillRect(cx + 100, 350, cx + 118, 400, ROBOT_D);
  // head
  roundRect(cx - 100, 300, cx + 100, 460, 26, ROBOT);
  // smug angled eyebrows
  thickLine(cx - 62, 348, cx - 18, 362, 5, DARK);
  thickLine(cx + 62, 348, cx + 18, 362, 5, DARK);
  // glowing red eyes
  fillEllipse(cx - 42, 385, 24, 20, RED_D);
  fillEllipse(cx + 42, 385, 24, 20, RED_D);
  fillEllipse(cx - 42, 385, 15, 12, RED);
  fillEllipse(cx + 42, 385, 15, 12, RED);
  fillEllipse(cx - 47, 380, 5, 5, WHITE);
  fillEllipse(cx + 37, 380, 5, 5, WHITE);
  // smug half-smile
  thickLine(cx - 30, 425, cx + 30, 425, 4, DARK);
  thickLine(cx + 30, 425, cx + 48, 410, 4, DARK);
  // body
  roundRect(cx - 90, 470, cx + 90, 620, 22, ROBOT_D);
  // chest screen
  fillRect(cx - 78, 500, cx + 78, 560, [16, 30, 46]);
  drawText("H2O: 40%", cx, 514, 3, [90, 230, 255], null);
  // left arm resting on ring
  thickLine(cx - 90, 500, cx - 130, 580, 14, ROBOT);
  // right arm raised, holding a glass of water
  thickLine(cx + 90, 500, cx + 140, 415, 14, ROBOT);
  fillEllipse(cx + 142, 409, 13, 13, ROBOT);
  // glass of water in raised hand (clear of the speech bubble)
  fillRect(cx + 126, 348, cx + 162, 400, [200, 235, 250]);
  fillRect(cx + 130, 366, cx + 158, 396, [60, 160, 230]);
  fillRect(cx + 126, 348, cx + 162, 356, WHITE);
  // inflatable ring at waist
  fillEllipse(cx, 610, 150, 42, ORANGE);
  fillEllipse(cx, 610, 108, 26, WATER_TOP);
  fillEllipse(cx, 610, 108, 26, WATER_TOP);
  // bubbles
  fillEllipse(cx - 170, 660, 8, 8, [200, 230, 250]);
  fillEllipse(cx + 180, 690, 6, 6, [200, 230, 250]);
  fillEllipse(cx + 150, 740, 9, 9, [200, 230, 250]);

  // speech bubble: YOU'RE WELCOME (tail points at the robot's head, clear of the glass)
  fillTriangle(775, 318, 805, 318, 695, 305, WHITE);
  roundRect(740, 198, 990, 320, 18, WHITE);
  drawText("YOU'RE", 865, 220, 4, INK, null);
  drawText("WELCOME.", 865, 258, 4, INK, null);

  // bottom caption band
  fillRect(0, 860, W - 1, H - 1, NAVY);
  fillRect(0, 860, W - 1, 864, [255, 214, 64]);
  drawText('MY AGENT: "YOUR HOUSE', 512, 890, 7, WHITE, null);
  drawText('IS NOW 40% WATER."', 512, 950, 7, WHITE, null);
}

function main(): void {
  drawScene();
  const png = encodePNG();
  const outDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";
  mkdirSync(outDir, { recursive: true });
  writeFileSync(outDir + "/entry.png", png);
}

main();
