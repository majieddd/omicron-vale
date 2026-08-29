// FX: projectiles, particle pools, lightning, death bursts, ambient life.
import * as THREE from 'three';
import { clamp, lerp, mulberry32 } from './00_util.mjs';

export function makeFXPools() {
  const rng = mulberry32(555);
  const group = new THREE.Group();
  group.name = 'fx';

  // --- shared particle pool (Points-based, per-particle color/size) ---
  const MAX = 900;
  const geo = new THREE.BufferGeometry();
  const posArr = new Float32Array(MAX * 3);
  const colArr = new Float32Array(MAX * 3);
  const sizeArr = new Float32Array(MAX);
  geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(sizeArr, 1));
  const pMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, vertexColors: true,
    uniforms: { uTex: { value: makeDotTexture() } },
    vertexShader: `
      attribute float aSize; varying vec3 vC;
      void main(){ vC = color;
        vec4 mv = modelViewMatrix * vec4(position,1.0);
        gl_PointSize = aSize * (240.0 / -mv.z);
        gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `
      uniform sampler2D uTex; varying vec3 vC;
      void main(){ vec4 t = texture2D(uTex, gl_PointCoord);
        gl_FragColor = vec4(vC, t.a * vC.a); }`
  });
  const points = new THREE.Points(geo, pMat);
  points.frustumCulled = false;
  group.add(points);
  const particles = []; // {x,y,z,vx,vy,vz,r,g,b,size,life,maxLife,grav,fade}
  function spawn(x, y, z, vx, vy, vz, color, size, life, grav) {
    if (particles.length >= MAX) particles.shift();
    const c = new THREE.Color(color);
    particles.push({ x, y, z, vx, vy, vz, r: c.r, g: c.g, b: c.b, size, life, maxLife: life, grav: grav || 0 });
  }
  function update(dt) {
    let n = 0;
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      p.vy -= (p.grav || 0) * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    }
    // write buffer
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      const a = p.life / p.maxLife;
      posArr[n * 3] = p.x; posArr[n * 3 + 1] = p.y; posArr[n * 3 + 2] = p.z;
      colArr[n * 3] = p.r; colArr[n * 3 + 1] = p.g; colArr[n * 3 + 2] = p.b;
      sizeArr[n] = p.size * (0.35 + a * 0.65);
      n++;
    }
    geo.setDrawRange(0, n);
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
    geo.attributes.aSize.needsUpdate = true;
  }
  function burst(x, y, z, opts = {}) {
    const n = opts.count || 14;
    for (let i = 0; i < n; i++) {
      const a = rng() * Math.PI * 2, b = (rng() - 0.5) * Math.PI;
      const sp = (opts.speed || 3) * (0.5 + rng());
      spawn(x, y, z,
        Math.cos(a) * Math.cos(b) * sp, Math.sin(b) * sp + (opts.up || 1.5), Math.sin(a) * Math.cos(b) * sp,
        opts.colors[(rng() * opts.colors.length) | 0],
        (opts.size || 9) * (0.6 + rng() * 0.8), (opts.life || 0.7) * (0.5 + rng() * 0.7),
        opts.grav || 6);
    }
  }
  return { group, update, spawn, burst };
}

function makeDotTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.45, 'rgba(255,255,255,0.85)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  return t;
}

// --- projectile meshes ---
export function makeProjectileMesh(kind) {
  if (kind === 'arrow') {
    const g = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 4), new THREE.MeshStandardMaterial({ color: 0x8a6c46 }));
    shaft.rotation.x = Math.PI / 2;
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 4), new THREE.MeshStandardMaterial({ color: 0x6b5b43 }));
    tip.rotation.x = Math.PI / 2; tip.position.z = 0.55;
    const fletch = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.2, 3), new THREE.MeshStandardMaterial({ color: 0x9fce6a, side: THREE.DoubleSide }));
    fletch.rotation.x = -Math.PI / 2; fletch.position.z = -0.48;
    g.add(shaft, tip, fletch);
    return g;
  }
  if (kind === 'ember') {
    const g = new THREE.Group();
    const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 1), new THREE.MeshBasicMaterial({ color: 0xff9b3e }));
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffe9a8 }));
    g.add(ball, core);
    return g;
  }
  if (kind === 'petal') {
    const g = new THREE.Group();
    const p = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.4, 3), new THREE.MeshStandardMaterial({ color: 0xbfeaf5, emissive: 0x4a9ab5, emissiveIntensity: 0.5 }));
    p.rotation.x = Math.PI / 2;
    return p;
  }
  if (kind === 'orb') {
    const g = new THREE.Group();
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd98a }));
    return b;
  }
  return null;
}

// --- chain lightning bolt: line segments with jitter, fades ---
export function makeBolt(from, targets, dur) {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0xcfbaff, transparent: true, opacity: 1, side: THREE.DoubleSide });
  const pts = [new THREE.Vector3(from.x, from.y, from.z)];
  let px = from.x, py = from.y, pz = from.z;
  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    const steps = 4;
    for (let s = 1; s <= steps; s++) {
      const k = s / steps;
      const midX = lerp(px, t.x, k), midZ = lerp(pz, t.z, k);
      const midY = lerp(py, 0.6, k) + (s < steps ? (Math.random() - 0.5) * 0.7 : 0);
      pts.push(new THREE.Vector3(midX, midY, midZ));
    }
    px = t.x; py = 0.6; pz = t.z;
  }
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const line = new THREE.Line(geo, mat);
  g.add(line);
  // glare
  const glare = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 }));
  glare.position.set(targets[targets.length - 1] ? targets[targets.length - 1].x : from.x, 0.8, targets[targets.length - 1] ? targets[targets.length - 1].z : from.z);
  g.add(glare);
  return { mesh: g, dur, t: 0 };
}

// --- ground blast ring (lumen pulse): thin bright flash, no huge glow wall ---
export function makeBlastRing(r) {
  // cap visual radius; gameplay radius (damage reach) never drawn as FX
  const vis = Math.min(r, 3.2);
  const geo = new THREE.RingGeometry(vis * 0.82, vis, 32);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffc879, transparent: true, opacity: 0.42, side: THREE.DoubleSide, depthWrite: false });
  const m = new THREE.Mesh(geo, mat);
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.12;
  const tm = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false }));
  tm.rotation.x = -Math.PI / 2;
  tm.position.y = 0.1;
  tm.scale.setScalar(0.82);
  m.add(tm);
  return { mesh: m, t: 0, dur: 0.5, r };
}

// --- ice pulse ring (frost): SMALL breathing footprint at the totem, NOT range-sized
export function makeIceRing(range) {
  // visual radius fixed at ~2.6 (totem footprint). Gameplay radius is the
  // frost slow field (range), shown by the placement ghost, never by FX.
  const vis = 2.6;
  const geo = new THREE.RingGeometry(vis * 0.86, vis, 40);
  const mat = new THREE.MeshBasicMaterial({ color: 0x9fd8e8, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false });
  const m = new THREE.Mesh(geo, mat);
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.22;
  return { mesh: m, t: 0, dur: 0.8, range };
}

// --- soul puff on enemy death ---
export function makeSoulBurst(color) {
  const c = new THREE.Color(color);
  const geo = new THREE.IcosahedronGeometry(0.3, 0);
  const mat = new THREE.MeshBasicMaterial({ color: c.getHex(), transparent: true, opacity: 0.9 });
  const m = new THREE.Mesh(geo, mat);
  return { mesh: m, t: 0, dur: 0.55 };
}
