// Props: the diorama flock. Willow, thatched hut, faceted boulders, trees, fences, reeds, cairns.
import * as THREE from 'three';
import { mulberry32, clamp, lerp, PAL, paintThatch, paintPlanks, paintStone, paintGrass, canvasTexture } from './00_util.mjs';
import { makeNoise2D } from './03_world.mjs';

const rng = mulberry32(20260829);

function std(color, opts = {}) {
  return new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.95, metalness: 0, flatShading: true }, opts));
}

// Minimal merge helper: bake transformed copies of a geometry into one BufferGeometry.
// leafGeo is a non-indexed or indexed geometry; each entry applies matrix4 + color.
function mergeGeoms(list) {
  // list: [{geo, matrix, color}]
  let totalPos = 0, totalIdx = 0, hasIndex = !!list[0].geo.index;
  for (const it of list) {
    totalPos += it.geo.attributes.position.count;
    if (hasIndex && it.geo.index) totalIdx += it.geo.index.count;
  }
  const pos = new Float32Array(totalPos * 3);
  const nor = new Float32Array(totalPos * 3);
  const col = new Float32Array(totalPos * 3);
  const idx = hasIndex ? new Uint32Array(totalIdx) : null;
  const nm = new THREE.Matrix3();
  const tmpC = new THREE.Color();
  let vo = 0, io = 0;
  for (const it of list) {
    const p = it.geo.attributes.position;
    const n = it.geo.attributes.normal;
    nm.getNormalMatrix(it.matrix);
    tmpC.set(it.color);
    for (let i = 0; i < p.count; i++, vo++) {
      const v = new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i)).applyMatrix4(it.matrix);
      pos[vo * 3] = v.x; pos[vo * 3 + 1] = v.y; pos[vo * 3 + 2] = v.z;
      const nv = new THREE.Vector3(n.getX(i), n.getY(i), n.getZ(i)).applyMatrix3(nm).normalize();
      nor[vo * 3] = nv.x; nor[vo * 3 + 1] = nv.y; nor[vo * 3 + 2] = nv.z;
      col[vo * 3] = tmpC.r; col[vo * 3 + 1] = tmpC.g; col[vo * 3 + 2] = tmpC.b;
    }
    if (idx && it.geo.index) {
      const g = it.geo.index;
      for (let i = 0; i < g.count; i++, io++) idx[io] = g.getX(i) + vo - p.count;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  if (idx) geo.setIndex(new THREE.BufferAttribute(idx, 1));
  return geo;
}

// ---------- The Willow (hero tree) ----------
export function buildWillow(scale = 1) {
  const g = new THREE.Group();
  g.name = 'willow';
  const trunkMat = std(PAL.woodLo, { flatShading: true });
  // Slightly leaning trunk of stacked tapered segments
  let py = 0, px = 0, pz = 0, bend = -0.06;
  const segs = 5;
  for (let i = 0; i < segs; i++) {
    const h = 0.9 + rng() * 0.25;
    const geo = new THREE.CylinderGeometry(0.34 - i * 0.055, 0.52 - i * 0.055, h, 6, 1);
    const m = new THREE.Mesh(geo, trunkMat);
    m.position.set(px + bend * i * 0.3, py + h / 2, pz);
    m.rotation.z = bend * i;
    m.castShadow = true;
    g.add(m);
    py += h * 0.92;
    bend += 0.012;
  }
  const crownY = py + 0.2;
  // Crown hub
  const hub = new THREE.Mesh(new THREE.IcosahedronGeometry(0.8, 0), std(PAL.willowLo));
  hub.position.set(px + 0.3, crownY + 0.15, pz);
  hub.castShadow = true;
  g.add(hub);
  // Drooping leaf strands: each strand is ONE merged mesh (all leaves baked),
  // so the willow is ~54 draw calls of leaves + trunk instead of ~800.
  const leafGeo = new THREE.CircleGeometry(0.18, 5);
  const strandMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide, flatShading: true, alphaTest: 0.2 });
  const strands = [];
  const N = 54;
  const m4 = new THREE.Matrix4();
  const eul = new THREE.Euler();
  const q = new THREE.Quaternion();
  const sph = new THREE.Vector3();
  const colHi = new THREE.Color(PAL.willowHi), colMid = new THREE.Color(PAL.willow), colLo = new THREE.Color(PAL.willowLo);
  for (let i = 0; i < N; i++) {
    const ring = i % 3; // 0: long outer, 1: inner, 2: inner short
    const a = (i / N) * Math.PI * 2 + rng() * 0.4;
    const rr = ring === 0 ? 0.95 + rng() * 0.5 : (ring === 1 ? 0.5 + rng() * 0.5 : 0.15 + rng() * 0.4);
    const sx = px + 0.3 + Math.cos(a) * rr;
    const sz = pz + Math.sin(a) * rr;
    const len = ring === 0 ? 3.6 + rng() * 2.6 : (ring === 1 ? 2.6 + rng() * 2.0 : 1.6 + rng() * 1.2);
    const lean = 0.5 + rng() * 0.25;
    const nLeaf = 11 + ((rng() * 5) | 0);
    const parts = [];
    for (let k = 0; k < nLeaf; k++) {
      const t = k / (nLeaf - 1);
      const y = -t * len;
      const x = Math.sin(t * 1.55) * len * lean * 0.5;
      eul.set(rng() * 0.5 - 0.25, rng() * Math.PI * 2, x * 1.6);
      q.setFromEuler(eul);
      const s = 0.85 + rng() * 1.15 - Math.min(1, t * 1.1) * 0.3;
      m4.compose(sph.set(x, y, 0), q, new THREE.Vector3(s, s, s));
      const c = ring === 0 ? (k > nLeaf * 0.6 ? colHi : colMid) : (rng() > 0.5 ? colMid : colLo);
      parts.push({ geo: leafGeo, matrix: m4.clone(), color: c });
    }
    const strand = new THREE.Mesh(mergeGeoms(parts), strandMat);
    strand.position.set(sx, crownY + 0.15, sz);
    strand.rotation.y = a;
    strand.castShadow = true;
    g.add(strand);
    strands.push(strand);
  }
  g.userData.strands = strands;
  return g;
}

export function animateWillow(w, t) {
  if (!w.userData.strands) return;
  for (let i = 0; i < w.userData.strands.length; i++) {
    const s = w.userData.strands[i];
    s.rotation.x = Math.sin(t * 0.75 + i * 1.7) * 0.055;
    s.rotation.z = Math.cos(t * 0.6 + i * 2.1) * 0.045;
  }
}

// ---------- The Hearth Hut (path endpoint) ----------
export function buildHut() {
  const g = new THREE.Group();
  g.name = 'hut';
  const W = 6.4, D = 4.6, H = 2.6;
  const wallTex = canvasTexture(paintPlanks(512, 256, rng, [157, 127, 87]));
  wallTex.repeat.set(2, 1);
  const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 1, flatShading: false, color: 0xffffff });
  const body = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), wallMat);
  body.position.y = H / 2;
  body.castShadow = true; body.receiveShadow = true;
  g.add(body);
  // thatch roof: two slabs + ridge, thick overhang
  const roofTex = canvasTexture(paintThatch(512, 256, rng));
  roofTex.repeat.set(2.5, 1.6);
  const thatchMat = new THREE.MeshStandardMaterial({ map: roofTex, roughness: 1, flatShading: false, color: 0xffffff });
  const roofH = 1.9, sl = Math.hypot(W * 0.5 + 0.9, roofH);
  for (const s of [-1, 1]) {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(sl, 0.5, D + 1.6), thatchMat);
    slab.rotation.z = -s * Math.atan2(roofH, W * 0.5 + 0.9);
    slab.position.set(s * (W * 0.25), H + roofH * 0.5, 0);
    slab.castShadow = true;
    g.add(slab);
    // soffit board: closes the underside gap between wall top and roof slab
    const soff = new THREE.Mesh(new THREE.BoxGeometry(W * 0.55, 0.1, D + 1.5), std(PAL.woodLo));
    soff.position.set(s * W * 0.19, H + 0.06, 0);
    soff.castShadow = true;
    g.add(soff);
  }
  const ridge = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, D + 1.7, 6), thatchMat);
  ridge.rotation.x = Math.PI / 2;
  ridge.position.y = H + roofH;
  ridge.castShadow = true;
  g.add(ridge);
  // gable ends (wood)
  const gable = new THREE.Shape();
  gable.moveTo(-W / 2 + 0.02, 0); gable.lineTo(W / 2 - 0.02, 0); gable.lineTo(0, roofH);
  for (const s of [-1, 1]) {
    const ge = new THREE.Mesh(new THREE.ShapeGeometry(gable), wallMat);
    ge.rotation.y = Math.PI / 2;
    ge.position.set(0, H, s * D / 2 - s * 0.01);
    ge.castShadow = true;
    g.add(ge);
  }
  // door + frames
  const doorMat = std(PAL.woodDk);
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.8, 0.12), doorMat);
  door.position.set(1.1, 0.9, D / 2 + 0.03);
  g.add(door);
  const doorF = new THREE.Mesh(new THREE.BoxGeometry(1.35, 2.0, 0.1), std(PAL.woodLo));
  doorF.position.set(1.1, 1.0, D / 2 - 0.01);
  g.add(doorF);
  // little window
  const win = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 0.1), std(0x3a2f22));
  win.position.set(-1.6, 1.5, D / 2 + 0.02);
  g.add(win);
  const winF = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.9, 0.08), std(PAL.woodLo));
  winF.position.set(-1.6, 1.5, D / 2 - 0.02);
  g.add(winF);
  // chimney
  const chim = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.6, 0.8), std(PAL.stoneLo));
  chim.position.set(-2.2, H + roofH * 0.62, -1.2);
  chim.castShadow = true;
  g.add(chim);
  // doormat path stones
  for (let i = 0; i < 5; i++) {
    const st = makeRock(0.28 + rng() * 0.16, PAL.stoneLo);
    st.position.set(0.9 - i * 0.55, 0.05, D / 2 + 0.5 + i * 0.35);
    g.add(st);
  }
  return g;
}

// ---------- Faceted boulders ----------
export function makeRock(size, color) {
  const geo = new THREE.IcosahedronGeometry(size, 1);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const v = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
    const s = 1 + (rng() - 0.5) * 0.34;
    v.multiplyScalar(s);
    v.y *= 0.72; // settled, low-slung
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  const mat = std(color, { roughness: 0.92 });
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

export function buildRockField() {
  const g = new THREE.Group();
  g.name = 'rocks';
  const colors = [PAL.stone, PAL.stoneLo, 0xd8d4c6, 0xb8b4a4];
  const spots = [
    // the cairn shelf across the mid-ground (hero cluster)
    [-8, 1.0, 7.4, 1.5], [-6.4, 0.6, 7.9, 0.9], [-4.8, 0.75, 7.2, 1.1], [-9.7, 0.5, 6.9, 0.8],
    [3, 0.9, -7.8, 1.3], [4.6, 0.55, -8.3, 0.8], [6, 0.8, -7.6, 1.0],
    // scattered smalls
    [-14, 0.4, -3.5, 0.55], [11.5, 0.5, 5.2, 0.7], [15, 0.35, -4.4, 0.5],
    [-1.5, 0.3, 3.8, 0.42], [-17, 0.5, 4.2, 0.75], [17.5, 0.55, 3.6, 0.8],
    [8.5, 0.35, -3.2, 0.45], [-11, 0.45, -5.6, 0.6], [13.4, 0.4, 2.2, 0.5],
    [-3.4, 0.3, -5.9, 0.4], [1.2, 0.28, 5.9, 0.38]
  ];
  for (const [x, y, z, s] of spots) {
    const r = makeRock(s, colors[(rng() * colors.length) | 0]);
    r.position.set(x, y * 0.8, z);
    r.rotation.y = rng() * Math.PI * 2;
    g.add(r);
  }
  return g;
}

// Cairn stack that faces the path (like the reference foreground)
export function buildCairn() {
  const g = new THREE.Group();
  g.name = 'cairn';
  for (let i = 0; i < 3; i++) {
    const r = makeRock(0.62 - i * 0.16, i === 0 ? PAL.stoneLo : PAL.stone);
    r.position.y = i * 0.72 + 0.42;
    r.rotation.y = rng() * Math.PI;
    g.add(r);
  }
  return g;
}

// ---------- Trees: painted canopy on faceted trunk ----------
export function buildTree(kind = 'round') {
  const g = new THREE.Group();
  g.name = 'tree-' + kind;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.3, 2.6, 5), std(rng() > 0.5 ? PAL.woodLo : PAL.woodDk));
  trunk.position.y = 1.3; trunk.castShadow = true;
  g.add(trunk);
  if (kind === 'round') {
    const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5, 1), std(PAL.leaf, { flatShading: true }));
    blob.position.y = 3.1; blob.scale.set(1, 0.9, 1); blob.castShadow = true;
    g.add(blob);
    const blob2 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9, 1), std(PAL.leafHi));
    blob2.position.set(0.8, 2.6, 0.3); blob2.castShadow = true;
    g.add(blob2);
    const blob3 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.8, 1), std(PAL.leafLo));
    blob3.position.set(-0.7, 2.5, -0.4); blob3.castShadow = true;
    g.add(blob3);
  } else if (kind === 'pine') {
    for (let i = 0; i < 3; i++) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(1.5 - i * 0.35, 1.9, 7), std(i % 2 ? PAL.leafLo : PAL.leaf));
      cone.position.y = 2.2 + i * 1.15;
      cone.castShadow = true;
      g.add(cone);
    }
  } else { // cypress
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.55, 4.6, 6), std(PAL.leafLo));
    cone.position.y = 3.2; cone.castShadow = true;
    g.add(cone);
  }
  return g;
}

export function buildTreefield() {
  const g = new THREE.Group();
  g.name = 'trees';
  const kinds = ['round', 'round', 'pine', 'cypress', 'round'];
  const spots = [
    [-19, -6, 1.15], [-15.5, -7.5, 0.9], [-12, 8.5, 1.1], [-8.5, 10, 0.8], [-4.5, -8.5, 1.0],
    [2.5, 9.8, 1.2], [7, 10.5, 0.85], [12, 9.2, 1.05], [17, 7.5, 0.9], [20, -6, 1.2],
    [15.8, -7.8, 0.8], [9.5, -9.5, 1.0], [5, -10.2, 0.75], [-17.5, 9.5, 0.85], [-21.5, 0.5, 1.0]
  ];
  let i = 0;
  for (const [x, z, s] of spots) {
    const t = buildTree(kinds[i++ % kinds.length]);
    t.position.set(x, 0, z);
    t.scale.setScalar(s);
    g.add(t);
  }
  return g;
}

// ---------- Reeds, grass tufts, fences ----------
export function buildReeds() {
  const g = new THREE.Group();
  g.name = 'reeds';
  const mat = new THREE.MeshStandardMaterial({ color: 0xb3a36c, roughness: 1, flatShading: true, side: THREE.DoubleSide });
  const dark = new THREE.MeshStandardMaterial({ color: 0x8a7f4f, roughness: 1, flatShading: true, side: THREE.DoubleSide });
  const cluster = (x, z, n, size) => {
    for (let i = 0; i < n; i++) {
      const h = size * (0.7 + rng() * 0.5);
      const s = new THREE.Mesh(new THREE.ConeGeometry(0.05, h, 3), rng() > 0.4 ? mat : dark);
      s.position.set(x + (rng() - 0.5) * 0.5, h / 2, z + (rng() - 0.5) * 0.5);
      s.rotation.z = (rng() - 0.5) * 0.22;
      g.add(s);
    }
  };
  cluster(-2.8, 2.9, 9, 1.1); cluster(-4.2, 2.5, 6, 0.9); cluster(8.2, 3.3, 8, 1.0);
  cluster(12.8, 1.4, 7, 1.2); cluster(-6.8, -2.6, 6, 0.9); cluster(3.4, -2.9, 5, 0.8);
  return g;
}

export function buildGrassTufts() {
  const g = new THREE.Group();
  g.name = 'tufts';
  // one merged geometry for ALL tufts (128 clusters x ~4 blades = ~500 meshes -> 1)
  const bladeGeo = new THREE.ConeGeometry(0.045, 1, 3);
  const parts = [];
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const eul = new THREE.Euler();
  const scl = new THREE.Vector3();
  const pos = new THREE.Vector3();
  const cMid = new THREE.Color(0x7f8c50), cHi = new THREE.Color(0x9aa75e);
  for (let i = 0; i < 130; i++) {
    const x = (rng() - 0.5) * 40, z = (rng() - 0.5) * 30;
    const n = 3 + ((rng() * 4) | 0);
    for (let k = 0; k < n; k++) {
      const h = 0.25 + rng() * 0.45;
      eul.set(0, 0, (rng() - 0.5) * 0.35);
      q.setFromEuler(eul);
      m4.compose(pos.set(x + (rng() - 0.5) * 0.4, h / 2, z + (rng() - 0.5) * 0.4), q, scl.set(1, h, 1));
      parts.push({ geo: bladeGeo, matrix: m4.clone(), color: rng() > 0.5 ? cMid : cHi });
    }
  }
  const tuft = new THREE.Mesh(mergeGeoms(parts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true, side: THREE.DoubleSide }));
  tuft.castShadow = true;
  g.add(tuft);
  return g;
}

export function buildFences() {
  const g = new THREE.Group();
  g.name = 'fence';
  const postMat = std(PAL.woodDk);
  // zigzag fence hugging the path near the hut
  const run = (x0, z0, x1, z1, n) => {
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = lerp(x0, x1, t) + (i % 2 ? 0.35 : -0.35);
      const z = lerp(z0, z1, t);
      const h = 1.15 + (rng() - 0.5) * 0.2;
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.12, h, 0.12), postMat);
      p.position.set(x, h / 2, z);
      p.rotation.z = (rng() - 0.5) * 0.16;
      p.castShadow = true;
      g.add(p);
    }
    // rails
    for (let i = 0; i < n; i++) {
      const xa = lerp(x0, x1, i / n), za = lerp(z0, z1, i / n);
      const xb = lerp(x0, x1, (i + 1) / n), zb = lerp(z0, z1, (i + 1) / n);
      const len = Math.hypot(xb - xa, zb - za) + 0.15;
      const rim = new THREE.Mesh(new THREE.BoxGeometry(len, 0.09, 0.09), postMat);
      rim.position.set((xa + xb) / 2, 0.62, (za + zb) / 2);
      rim.rotation.y = Math.atan2(-(zb - za), xb - xa);
      rim.rotation.z = 0.02;
      g.add(rim);
      const rim2 = rim.clone();
      rim2.position.y = 0.95;
      g.add(rim2);
    }
  };
  run(-6.5, 5.8, -1.5, 6.6, 6);
  run(4.8, 6.9, 9.8, 6.2, 6);
  run(-13.5, -4.6, -9.8, -5.9, 4);
  return g;
}

export function buildProps() {
  const g = new THREE.Group();
  g.name = 'props';
  const willow = buildWillow(1.15);
  willow.position.set(-5.6, 0, -0.6); // mid-ground hero, near path center-left
  g.add(willow);
  const hut = buildHut();
  hut.position.set(18.8, 0, -0.4);  // at the path end = the hearth
  hut.rotation.y = -Math.PI / 2 + 0.06;
  g.add(hut);
  g.add(buildRockField());
  g.add(buildTreefield());
  g.add(buildReeds());
  g.add(buildGrassTufts());
  g.add(buildFences());
  const cairn = buildCairn();
  cairn.position.set(-2.2, 0, 6.4);
  g.add(cairn);
  return g;
}

export function animateProps(world, t) {
  const w = world.group.getObjectByName('willow');
  if (w) animateWillow(w, t);
  for (const child of world.group.children) {
    if (child.name === 'mist') { /* handled separately */ }
  }
}
