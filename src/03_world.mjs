// World: terrain with painted vertex colors, dirt road, sky dome, mist, background hills.
import * as THREE from 'three';
import { buildPath, distToPath } from './02_sim.mjs';
import { mulberry32, clamp, lerp, PAL, paintGrass, paintSky, paintMistPuff, canvasTexture, makeCanvas, paintTooth } from './00_util.mjs';

export const WORLD = {
  w: 46,   // x extent
  h: 34,   // z extent
  // Small-planet curvature: the map is the top cap of a planet of radius R_P.
  // capY(r) = sqrt(R_P^2 - r^2) - R_P (negative at r>0), so edges drop away.
  R_P: 80,
  // the planet sphere rides this much below the terrain cap (crust thickness)
  CRUST: 0.5,
  pathCtrl: [[-21, 6], [-13, 3.2], [-6.5, -1.8], [0, -0.6], [4.6, 2.2], [9.6, 0.8], [14.5, -1.6], [21, 0.2]]
};

// Height of the planet surface at horizontal distance r from the map center.
export function capY(r) {
  const R = WORLD.R_P;
  const rr = Math.min(r, R - 0.01);
  return Math.sqrt(R * R - rr * rr) - R;
}

// Unit surface normal at horizontal (x, z) on the cap (points away from center).
export function sphereNormal(x, z, out) {
  const R = WORLD.R_P;
  const c = capY(Math.hypot(x, z)) + R;   // sqrt(R^2 - r^2)
  out.set(x / R, c / R, z / R);
  return out.normalize();
}

export function buildPathGeometry() {
  const p = buildPath(WORLD.pathCtrl);
  return p;
}

// Deterministic value noise (bilinear over hash grid).
export function makeNoise2D(seed) {
  const rng = mulberry32(seed);
  const perm = new Float32Array(256);
  for (let i = 0; i < 256; i++) perm[i] = rng();
  const h = (x, y) => perm[(((x & 255) << 8) | (y & 255)) & 255];
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    return lerp(lerp(h(xi, yi), h(xi + 1, yi), u), lerp(h(xi, yi + 1), h(xi + 1, yi + 1), u), v);
  };
}

export function groundHeight(x, z, path, noise) {
  const r = Math.hypot(x, z);
  let h = noise(x * 0.16, z * 0.16) * 1.5 + noise(x * 0.45, z * 0.45) * 0.5 - 0.65;
  // flatten along the road corridor
  const d = distToPath(path, x, z);
  const f = clamp(d / 2.6, 0, 1);
  h *= lerp(0.06, 1, f * f * (3 - 2 * f));
  // stay on/above the planet surface: local bumps only add, never dig in
  if (h < 0) h = 0;
  // fade local detail to zero near the map edge so terrain meets the planet sphere seamlessly
  const ef = clamp(Math.min(WORLD.w / 2 - Math.abs(x), WORLD.h / 2 - Math.abs(z)) / 5, 0, 1);
  h *= ef;
  // small-planet curvature: the whole map is a cap of the planet
  return capY(r) + h;
}

export function buildTerrain(path, noise) {
  const segX = 168, segZ = 128;
  const geo = new THREE.PlaneGeometry(WORLD.w, WORLD.h, segX, segZ);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const cGrass = new THREE.Color(PAL.grass), cGrassHi = new THREE.Color(PAL.grassHi), cGrassLo = new THREE.Color(PAL.grassLo);
  const cDirt = new THREE.Color(PAL.dirt), cDirtDk = new THREE.Color(PAL.dirtDark);
  const cStone = new THREE.Color(PAL.stoneLo);
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const r = Math.hypot(x, z);
    const y = groundHeight(x, z, path, noise);
    pos.setY(i, y);
    // color
    const n = noise(x * 0.7, z * 0.7), n2 = noise(x * 2.3, z * 2.3);
    tmp.copy(cGrass).lerp(cGrassLo, n * 0.75).lerp(cGrassHi, n2 * 0.45);
    const d = distToPath(path, x, z);
    if (d < 1.5) {
      // roadbed: packed dirt with stone speckle (widened, high contrast)
      tmp.copy(cDirt).lerp(cDirtDk, n * 0.55);
      if (n2 > 0.6) tmp.lerp(cStone, 0.5);
    } else if (d < 2.6) {
      // shoulder: faded dirt -> grass
      const t = clamp((d - 1.5) / 1.1, 0, 1);
      const dirt = new THREE.Color(cDirt).lerp(cDirtDk, n * 0.55);
      tmp.lerp(dirt, 0.7 * (1 - t));
    }
    // hill shade: blend toward the planet's outer grass band near the rim
    const rim = clamp((r - WORLD.w * 0.5) / 9, 0, 1);
    if (rim > 0.02) tmp.lerp(cGrassLo, rim * 0.55).lerp(new THREE.Color(0x6f7a4a), Math.min(1, rim * 0.7));
    colors[i * 3] = tmp.r; colors[i * 3 + 1] = tmp.g; colors[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const rng = mulberry32(991);
  // NEUTRAL paint-tooth map: mostly bright, light texture so vertex colors
  // (road/dirt/grass zones) stay the hue source instead of being multiplied into dark.
  const tooth = paintTooth(512, 512, rng);
  const grassTex = canvasTexture(tooth, { repeat: [5, 3.75] });
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true, map: grassTex, roughness: 1.0, metalness: 0.0, flatShading: false
  });
  mat.map.needsUpdate = true;
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  return mesh;
}

export function buildSky() {
  const rng = mulberry32(777);
  const tex = canvasTexture(paintSky(1024, 512, rng));
  tex.wrapS = THREE.RepeatWrapping; tex.repeat.set(2, 1);
  const geo = new THREE.SphereGeometry(240, 32, 18);
  const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, depthWrite: false });
  const sky = new THREE.Mesh(geo, mat);
  sky.name = 'sky';
  return sky;
}

// ---------- The planet ball ----------
// The map is the top cap; this sphere continues the surface out and down.
export function buildPlanetBall() {
  const R = WORLD.R_P;
  const rng = mulberry32(424242);
  const tex = canvasTexture(paintPlanet(1024, 512, rng, R));
  tex.wrapS = THREE.RepeatWrapping;
  const geo = new THREE.SphereGeometry(R, 96, 48);
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 1.0, metalness: 0.0 });
  const ball = new THREE.Mesh(geo, mat);
  ball.position.set(0, -(R + WORLD.CRUST), 0);   // crust: ball rides CRUST below the cap
  ball.name = 'planet';
  return ball;
}

function paintPlanet(w, h, rng, R) {
  const c = makeCanvas(w, h);
  const g = c.getContext('2d');
  // sage top fading to warm olive + stone bands low on the ball (painterly)
  const grd = g.createLinearGradient(0, 0, 0, h);
  grd.addColorStop(0.00, '#97a163');
  grd.addColorStop(0.22, '#8a9a5c');
  grd.addColorStop(0.45, '#7f8a52');
  grd.addColorStop(0.70, '#6d7844');
  grd.addColorStop(0.90, '#5c6838');
  grd.addColorStop(1.00, '#4f5a30');
  g.fillStyle = grd;
  g.fillRect(0, 0, w, h);
  // mottled patches (grass noise at planet scale)
  for (let i = 0; i < 2600; i++) {
    const x = rng() * w, y = rng() * h;
    const s = 2 + rng() * 9;
    const v = 0.88 + rng() * 0.30;
    g.fillStyle = `rgba(${(140 * v + 20) | 0}, ${(150 * v + 16) | 0}, ${(90 * v + 12) | 0}, ${0.16 + rng() * 0.15})`;
    g.fillRect(x, y, s, s * (0.5 + rng() * 0.8));
  }
  // stone streaks / ledges lower on the ball
  for (let i = 0; i < 320; i++) {
    const y = h * (0.55 + rng() * 0.42);
    const x = rng() * w;
    g.strokeStyle = `rgba(92, 99, 66, ${0.10 + rng() * 0.14})`;
    g.lineWidth = 1 + rng() * 4;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + rng() * 60 - 30, y + rng() * 10 - 5, x + rng() * 120 - 60, y + rng() * 14 - 7);
    g.stroke();
  }
  return c;
}

// Distant hills that sit ON the planet's surface (tilted to the local normal).
export function buildHills() {
  const rng = mulberry32(31337);
  const R = WORLD.R_P;
  const group = new THREE.Group();
  group.name = 'hills';
  const mat = new THREE.MeshBasicMaterial({ color: 0x8f957f, fog: true });
  const matFar = new THREE.MeshBasicMaterial({ color: 0xa6ab94, fog: true });
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < 34; i++) {
    const ang = (i / 34) * Math.PI * 2 + rng() * 0.2;
    const rr = R - (6 + rng() * 14);          // distance from pole, on the ball
    const hgt = 6 + rng() * 16;
    const geo = new THREE.ConeGeometry(7 + rng() * 14, hgt, 5 + ((rng() * 3) | 0));
    const m = new THREE.Mesh(geo, rng() > 0.5 ? mat : matFar);
    const x = Math.cos(ang) * rr, z = Math.sin(ang) * rr;
    const y = Math.sqrt(Math.max(0.001, R * R - rr * rr)) - R;
    m.position.set(x, y + hgt * 0.5 - 1.2, z);
    // upright along the local surface normal
    const n = new THREE.Vector3(x, y + R, z).normalize();
    m.quaternion.setFromUnitVectors(up, n);
    group.add(m);
    // flat dark conifer silhouettes on nearer hills
    if (rng() > 0.4) {
      const cb = new THREE.Mesh(new THREE.ConeGeometry(2 + rng() * 2.5, 5 + rng() * 7, 4), matFar);
      const x2 = Math.cos(ang) * (rr - 16), z2 = Math.sin(ang) * (rr - 16);
      const y2 = Math.sqrt(Math.max(0.001, R * R - (rr - 16) * (rr - 16))) - R;
      const n2 = new THREE.Vector3(x2, y2 + R, z2).normalize();
      cb.position.set(x2, y2 + 2.0, z2);
      cb.quaternion.setFromUnitVectors(up, n2);
      group.add(cb);
    }
  }
  return group;
}

export function buildMistLayers(path, noise) {
  const rng = mulberry32(4242);
  const group = new THREE.Group();
  group.name = 'mist';
  const tex = canvasTexture(paintMistPuff(256, rng));
  tex.wrapS = THREE.ClampToEdgeWrapping; tex.wrapT = THREE.ClampToEdgeWrapping;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.5, depthWrite: false, fog: false });
  const layers = [];
  const gh = (x, z) => groundHeight(x, z, path, noise);
  // Low ground-haze sheets that follow the curved surface (drift in update loop).
  const spots = [
    [-24, 1.2, -10, 34], [-24, 1.6, 7, 30], [-10, 0.9, -15, 26], [6, 1.2, -16, 30],
    [22, 1.4, -11, 26], [24, 1.0, 6, 30], [0, 0.8, 17, 26]
  ];
  for (const [x, y, z, size] of spots) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size * 0.42), mat.clone());
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, gh(x, z) + y, z);
    m.name = 'mistLayer';
    group.add(m);
    layers.push({ mesh: m, x0: x, sp: rng() * 0.35, ph: rng() * 10, size });
  }
  // soft vertical drift veils at the far edges only (very faint)
  const farMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.16, depthWrite: false, fog: false, side: THREE.DoubleSide });
  for (const [x, y, z, size] of [[-30, 3.5, 0, 40], [30, 3.5, 0, 38], [0, 3.5, -32, 36], [0, 3.5, 32, 36]]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size * 0.4), farMat.clone());
    m.position.set(x, capY(Math.hypot(x, z)) + y, z);
    const side = Math.abs(x) > 20;
    if (side) m.rotation.y = Math.PI / 2; // face inward on the sides
    m.name = 'mistVeil';
    group.add(m);
    layers.push({ mesh: m, x0: x, sp: rng() * 0.18, ph: rng() * 10, size, veil: true, driftZ: side });
  }
  return { group, layers };
}

export function buildWorldScene() {
  const path = buildPathGeometry();
  const noise = makeNoise2D(1234);
  const g = new THREE.Group();
  g.name = 'world';
  const terrain = buildTerrain(path, noise);
  g.add(terrain);
  g.add(buildPlanetBall());
  return { group: g, path, noise, terrain };
}
