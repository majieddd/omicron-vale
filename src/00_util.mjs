// Shared utilities: RNG, palette (measured from reference art), canvas texture helpers.
import * as THREE from 'three';
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const easeOut = t => 1 - (1 - t) * (1 - t);

// Palette extracted from the reference diorama (sage/cream/warm grey).
export const PAL = {
  skyTop:    0xcdc8b4,
  skyMid:    0xdcd6bd,
  skyHorizon:0xeee8cd,
  cloud:     0xf0ead2,
  mist:      0xe8e2c6,
  grassHi:   0x9aa563,
  grass:     0x8a9558,
  grassLo:   0x6e7a46,
  dirt:      0xcdbb8b,
  dirtDark:  0xa48e5f,
  stone:     0xd3cfc0,
  stoneLo:   0xa19d8c,
  stoneDk:   0x7d796a,
  thatch:    0xc9b186,
  thatchLo:  0xa88f66,
  wood:      0xa8865c,
  woodLo:    0x7a6040,
  woodDk:    0x5e4830,
  willowHi:  0xd4dfa8,
  willow:    0xb4c67c,
  willowLo:  0x8da05e,
  leaf:      0x94a468,
  leafLo:    0x6f7f4c,
  leafHi:    0xb2c288,
  ember:     0xd97b2f,
  emberHi:   0xf2a24b,
  wisp:      0xd7f27e,
  frost:     0x9fd8e8,
  storm:     0xb4a3f0,
  lumen:     0xffd98a,
  danger:    0xc9553f,
  gold:      0xc9973c
};

// ---------- canvas texture helpers ----------
export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}
export function canvasTexture(c, opts = {}) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (opts.repeat) t.repeat.set(opts.repeat[0], opts.repeat[1]);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// Painterly grass ground: mottled sage strokes + speckle. Returns {albedoBumpChannels} style canvas.
export function paintGrass(w, h, rng, base = [140, 151, 88]) {
  const c = makeCanvas(w, h), g = c.getContext('2d');
  g.fillStyle = `rgb(${base[0]},${base[1]},${base[2]})`;
  g.fillRect(0, 0, w, h);
  const tones = [
    [156, 165, 100], [140, 151, 88], [124, 136, 74], [170, 178, 116],
    [148, 160, 94], [108, 120, 64], [178, 186, 126]
  ];
  for (let i = 0; i < 2600; i++) {
    const t = tones[(rng() * tones.length) | 0];
    g.globalAlpha = 0.1 + rng() * 0.35;
    g.fillStyle = `rgb(${t[0]},${t[1]},${t[2]})`;
    const x = rng() * w, y = rng() * h;
    const rw = 8 + rng() * 46, rh = 5 + rng() * 22;
    g.beginPath(); g.ellipse(x, y, rw, rh, rng() * Math.PI, 0, Math.PI * 2); g.fill();
  }
  // fine stalks
  g.globalAlpha = 0.5;
  for (let i = 0; i < 3800; i++) {
    const t = tones[(rng() * tones.length) | 0];
    g.strokeStyle = `rgb(${t[0]},${t[1]},${t[2]})`;
    g.lineWidth = 1;
    const x = rng() * w, y = rng() * h, l = 3 + rng() * 9, a = rng() * Math.PI;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y - l); g.stroke();
  }
  g.globalAlpha = 1;
  return c;
}

// Woven thatch strips. Vertical feathering.
export function paintThatch(w, h, rng, base = [191, 169, 126]) {
  const c = makeCanvas(w, h), g = c.getContext('2d');
  g.fillStyle = `rgb(${base[0]},${base[1]},${base[2]})`;
  g.fillRect(0, 0, w, h);
  const tones = [[206, 187, 142], [172, 150, 108], [151, 129, 91], [218, 201, 158], [133, 112, 80]];
  for (let y = 0; y < h; y += 4) {
    for (let x = 0; x < w; x += 9) {
      const t = tones[(rng() * tones.length) | 0];
      g.globalAlpha = 0.25 + rng() * 0.5;
      g.strokeStyle = `rgb(${t[0]},${t[1]},${t[2]})`;
      g.lineWidth = 2 + rng() * 1.5;
      const off = (rng() - 0.5) * 8;
      g.beginPath(); g.moveTo(x + off, y); g.lineTo(x + off + (rng() - 0.5) * 3, y + 4); g.stroke();
    }
  }
  g.globalAlpha = 1;
  return c;
}

// Vertical wood planks with grain.
export function paintPlanks(w, h, rng, base = [157, 127, 87]) {
  const c = makeCanvas(w, h), g = c.getContext('2d');
  g.fillStyle = `rgb(${base[0]},${base[1]},${base[2]})`;
  g.fillRect(0, 0, w, h);
  const tones = [[178, 148, 104], [137, 108, 71], [119, 92, 58], [190, 162, 116], [97, 74, 46]];
  const planks = 7, pw = w / planks;
  for (let p = 0; p < planks; p++) {
    const t = tones[(rng() * tones.length) | 0];
    g.globalAlpha = 0.55; g.fillStyle = `rgb(${t[0]},${t[1]},${t[2]})`;
    g.fillRect(p * pw + 1, 0, pw - 2, h);
    // grain lines
    g.globalAlpha = 0.4; g.strokeStyle = `rgb(${Math.max(0, t[0] - 30)},${Math.max(0, t[1] - 26)},${Math.max(0, t[2] - 20)})`;
    for (let i = 0; i < 5; i++) {
      const x = p * pw + 2 + rng() * (pw - 5);
      g.lineWidth = 1;
      g.beginPath(); g.moveTo(x, 0);
      for (let y = 0; y <= h; y += 14) g.lineTo(x + Math.sin(y * 0.08 + i) * 2.2, y);
      g.stroke();
    }
    // seam
    g.globalAlpha = 0.75; g.fillStyle = 'rgb(70,52,32)';
    g.fillRect(p * pw, 0, 2, h);
  }
  g.globalAlpha = 1;
  return c;
}

// Speckled warm stone.
export function paintStone(w, h, rng, base = [201, 197, 184]) {
  const c = makeCanvas(w, h), g = c.getContext('2d');
  g.fillStyle = `rgb(${base[0]},${base[1]},${base[2]})`;
  g.fillRect(0, 0, w, h);
  const tones = [[216, 213, 200], [185, 181, 167], [164, 160, 146], [229, 226, 214], [148, 144, 130]];
  for (let i = 0; i < 1800; i++) {
    const t = tones[(rng() * tones.length) | 0];
    g.globalAlpha = 0.2 + rng() * 0.45;
    g.fillStyle = `rgb(${t[0]},${t[1]},${t[2]})`;
    const x = rng() * w, y = rng() * h, r = 3 + rng() * 16;
    g.beginPath(); g.moveTo(x + r, y);
    for (let k = 1; k < 6; k++) { const a = k / 6 * Math.PI * 2; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
    g.closePath(); g.fill();
  }
  g.globalAlpha = 1;
  return c;
}

// Painted sky: soft cloud blobs on warm gradient. 1024x512 for a dome.
export function paintSky(w, h, rng) {
  const c = makeCanvas(w, h), g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0.0, '#bfbaa5');
  grad.addColorStop(0.40, '#d4ceb4');
  grad.addColorStop(0.60, '#e9e2c6');
  grad.addColorStop(0.78, '#f2ecd4');
  grad.addColorStop(1.0, '#ebe4c8');
  g.fillStyle = grad; g.fillRect(0, 0, w, h);
  // cloud blobs: soft ellipses, brighter near horizon
  for (let i = 0; i < 110; i++) {
    const cx = rng() * w;
    const cy = h * 0.04 + rng() * h * 0.52;
    const ry = 9 + rng() * 30 * (0.4 + cy / h * 1.5);
    const rx = 34 + rng() * 130 * (0.5 + cy / h);
    const al = 0.10 + rng() * 0.26 * (0.4 + cy / h);
    const bright = cy > h * 0.38;
    g.globalAlpha = al;
    g.fillStyle = bright ? '#f6f0d8' : '#c9c4ae';
    for (let k = 0; k < 5; k++) {
      g.beginPath();
      g.ellipse(cx + (rng() - 0.5) * rx, cy + (rng() - 0.5) * ry, rx * (0.45 + rng() * 0.4), ry * (0.55 + rng() * 0.5), 0, 0, Math.PI * 2);
      g.fill();
    }
  }
  // warm sun glow, upper right
  const sg = g.createRadialGradient(w * 0.72, h * 0.22, 6, w * 0.72, h * 0.22, w * 0.3);
  sg.addColorStop(0, 'rgba(252,244,214,0.85)');
  sg.addColorStop(0.35, 'rgba(246,235,201,0.35)');
  sg.addColorStop(1, 'rgba(246,235,201,0)');
  g.fillStyle = sg; g.fillRect(0, 0, w, h);
  g.globalAlpha = 1;
  return c;
}

// Neutral paint-tooth: cream base, subtle warm-grey strokes and speckle.
// Used as a light modulator over vertex colors (75-100% value band per
// skill rule: never a value-crushing map on vertex-colored surfaces).
export function paintTooth(w, h, rng) {
  const c = makeCanvas(w, h);
  const g = c.getContext('2d');
  g.fillStyle = 'rgb(228, 225, 209)';
  g.fillRect(0, 0, w, h);
  const tones = [[236, 233, 218], [219, 216, 199], [207, 204, 186], [243, 240, 226], [195, 192, 174]];
  for (let i = 0; i < 2400; i++) {
    const t = tones[(rng() * tones.length) | 0];
    g.globalAlpha = 0.10 + rng() * 0.3;
    g.fillStyle = `rgb(${t[0]},${t[1]},${t[2]})`;
    const x = rng() * w, y = rng() * h;
    const rw = 8 + rng() * 42, rh = 5 + rng() * 20;
    g.beginPath(); g.ellipse(x, y, rw, rh, rng() * Math.PI, 0, Math.PI * 2); g.fill();
  }
  g.globalAlpha = 0.5;
  for (let i = 0; i < 3200; i++) {
    const t = tones[(rng() * tones.length) | 0];
    g.strokeStyle = `rgb(${t[0]},${t[1]},${t[2]})`;
    g.lineWidth = 1;
    const x = rng() * w, y = rng() * h, l = 3 + rng() * 8, a = rng() * Math.PI;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y - l); g.stroke();
  }
  g.globalAlpha = 1;
  return c;
}

// Soft round mist puff (white with radial alpha) for billboards.
export function paintMistPuff(size, rng, tint = '232,226,198') {
  const c = makeCanvas(size, size), g = c.getContext('2d');
  for (let i = 0; i < 26; i++) {
    const x = size * 0.5 + (rng() - 0.5) * size * 0.45;
    const y = size * 0.5 + (rng() - 0.5) * size * 0.3;
    const r = size * (0.08 + rng() * 0.16);
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(${tint},0.5)`);
    gr.addColorStop(1, `rgba(${tint},0)`);
    g.fillStyle = gr;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  return c;
}
