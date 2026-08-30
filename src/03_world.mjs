// World: terrain with painted vertex colors, dirt road, sky dome, mist, background hills.
import * as THREE from 'three';
import { buildPath, distToPath } from './02_sim.mjs';
import { mulberry32, clamp, lerp, PAL, paintGrass, paintSky, paintMistPuff, canvasTexture, makeCanvas, paintTooth } from './00_util.mjs';

export const WORLD = {
  w: 46,   // x extent
  h: 34,   // z extent
  pathCtrl: [[-21, 6], [-13, 3.2], [-6.5, -1.8], [0, -0.6], [4.6, 2.2], [9.6, 0.8], [14.5, -1.6], [21, 0.2]]
};

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
  let h = noise(x * 0.16, z * 0.16) * 1.5 + noise(x * 0.45, z * 0.45) * 0.5 - 0.65;
  // flatten along the road corridor
  const d = distToPath(path, x, z);
  const f = clamp(d / 2.6, 0, 1);
  h *= lerp(0.06, 1, f * f * (3 - 2 * f));
  // gentle bowl: edges rise into hills
  const ex = clamp((Math.abs(x) - WORLD.w * 0.36) / 5, 0, 1);
  const ez = clamp((Math.abs(z) - WORLD.h * 0.34) / 4.5, 0, 1);
  h += (ex * ex * 2.1 + ez * ez * 1.4) * (0.4 + noise(x * 0.3, z * 0.3) * 0.6);
  return h;
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
    // hill shade
    const ex = clamp((Math.abs(x) - WORLD.w * 0.36) / 5, 0, 1);
    const ez = clamp((Math.abs(z) - WORLD.h * 0.34) / 4.5, 0, 1);
    const rise = Math.max(ex, ez);
    if (rise > 0.15) tmp.lerp(new THREE.Color(PAL.grassLo), rise * 0.5).lerp(new THREE.Color(0x7a8055), Math.max(0, rise - 0.5) * 0.8);
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

// Distant hills: dark faceted cones at the horizon (referenced silhouette band).
export function buildHills() {
  const rng = mulberry32(31337);
  const group = new THREE.Group();
  group.name = 'hills';
  const mat = new THREE.MeshBasicMaterial({ color: 0x8f957f, fog: true });
  const matFar = new THREE.MeshBasicMaterial({ color: 0xa6ab94, fog: true });
  for (let i = 0; i < 34; i++) {
    const ang = (i / 34) * Math.PI * 2 + rng() * 0.2;
    const r = 95 + rng() * 30;
    const hgt = 6 + rng() * 16;
    const geo = new THREE.ConeGeometry(7 + rng() * 14, hgt, 5 + ((rng() * 3) | 0));
    const m = new THREE.Mesh(geo, rng() > 0.5 ? mat : matFar);
    m.position.set(Math.cos(ang) * r, hgt * 0.5 - 8, Math.sin(ang) * r);
    m.rotation.y = rng() * Math.PI;
    group.add(m);
    // flat dark conifer silhouettes on nearer hills
    if (rng() > 0.4) {
      const cb = new THREE.Mesh(new THREE.ConeGeometry(2 + rng() * 2.5, 5 + rng() * 7, 4), matFar);
      cb.position.set(Math.cos(ang) * (r - 22), hgt * 0.3 - 6.5, Math.sin(ang) * (r - 22));
      group.add(cb);
    }
  }
  return group;
}

export function buildMistLayers() {
  const rng = mulberry32(4242);
  const group = new THREE.Group();
  group.name = 'mist';
  const tex = canvasTexture(paintMistPuff(256, rng));
  tex.wrapS = THREE.ClampToEdgeWrapping; tex.wrapT = THREE.ClampToEdgeWrapping;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.5, depthWrite: false, fog: false });
  const layers = [];
  // Flat ground-haze sheets (rotateX -90) that drift like the reference's low mist.
  const spots = [
    [-24, 1.2, -10, 34], [-24, 1.6, 7, 30], [-10, 0.9, -15, 26], [6, 1.2, -16, 30],
    [22, 1.4, -11, 26], [24, 1.0, 6, 30], [0, 0.8, 17, 26]
  ];
  for (const [x, y, z, size] of spots) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size * 0.42), mat.clone());
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    m.name = 'mistLayer';
    group.add(m);
    layers.push({ mesh: m, x0: x, sp: rng() * 0.35, ph: rng() * 10, size });
  }
  // soft vertical drift veils at the far edges only (very faint)
  const farMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.16, depthWrite: false, fog: false, side: THREE.DoubleSide });
  for (const [x, y, z, size] of [[-30, 3.5, 0, 40], [30, 3.5, 0, 38], [0, 3.5, -32, 36], [0, 3.5, 32, 36]]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size * 0.4), farMat.clone());
    m.position.set(x, y, z);
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
  return { group: g, path, noise, terrain };
}
