// Omicron: Willow Vale Defense - main controller.
// Renderer + camera + input + placement + loop + event wiring + test API.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildPath, newState, startWave, placeTower, upgradeTower, sellTower, step as simStep, TOWERS, WAVES } from './02_sim.mjs';
import { clamp, lerp } from './00_util.mjs';
import { buildWorldScene, groundHeight, buildSky, buildHills, buildMistLayers } from './03_world.mjs';
import { buildProps, animateProps, useBlenderRocks } from './04_props.mjs';
import { makeEnemy, animateEnemy, makeTower, animateTower, updateHpBar } from './05_units.mjs';
import { makeFXPools, makeProjectileMesh, makeBolt, makeBlastRing, makeIceRing, makeSoulBurst } from './06_fx.mjs';
import { createAudio } from './07_audio.mjs';
import { initBlenderAssets, getBlenderGeometries } from './09_assets.mjs';
import { distToPath } from './02_sim.mjs';
const distToPathSafe = (x, z) => distToPath(sim.path, x, z);

// ---------- renderer ----------
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.22;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xd9d3ba);
scene.fog = new THREE.Fog(0xe3ddc2, 38, 165);

const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 400);
camera.position.set(0, 30, 30);
camera.lookAt(0, 0, 0);

// composer
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.35, 0.55, 0.9);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ---------- lights ----------
const sun = new THREE.DirectionalLight(0xffe3b4, 2.6);
sun.position.set(-16, 24, 10);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -26; sun.shadow.camera.right = 26;
sun.shadow.camera.top = 26; sun.shadow.camera.bottom = -26;
sun.shadow.camera.far = 70;
sun.shadow.bias = -0.0004;
scene.add(sun);
const hemi = new THREE.HemisphereLight(0xdfe3cc, 0x7d8359, 1.05);
scene.add(hemi);
const rim = new THREE.DirectionalLight(0xbfd4c0, 0.5);
rim.position.set(20, 8, -18);
scene.add(rim);

// ---------- world ----------
const world = buildWorldScene();
scene.add(world.group);
const props = buildProps(world.path, world.noise);
scene.add(props);
const sky = buildSky();
scene.add(sky);
const hills = buildHills();
scene.add(hills);
const mist = buildMistLayers(world.path, world.noise);
scene.add(mist.group);

// ---------- fx ----------
const fx = makeFXPools();
scene.add(fx.group);
const bolts = [], rings = [], souls = [];
window.__fx = { bolts, rings, souls }; // diagnostic hook (harmless read-only)
const activeProjectiles = []; // {sim, mesh, kind, phase}

// ---------- sim ----------
const sim = newState(world.path);
sim.path = world.path;

// ---------- audio ----------
const audio = createAudio();

// ---------- UI ----------
const $ = id => document.getElementById(id);
const ui = { lives: $('lives'), gold: $('gold'), wave: $('wave'), banner: $('banner'),
  bannerTitle: $('banner-title'), bannerSub: $('banner-sub'), toast: $('toast'),
  panel: $('panel'), panelTitle: $('panel-title'), panelStats: $('panel-stats'),
  btnUpgrade: $('btn-upgrade'), btnSell: $('btn-sell'), cards: $('cards') };
ui.btnUpgrade.addEventListener('click', () => { doUpgrade(); });
ui.btnSell.addEventListener('click', () => { doSell(); });

let selectedTowerId = null;
let selectedBuildKey = null;
let toastTimer = 0;

function toast(msg) {
  ui.toast.textContent = msg;
  ui.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ui.toast.classList.remove('show'), 1600);
}

function showBanner(title, sub, dur) {
  ui.bannerTitle.textContent = title;
  ui.bannerSub.textContent = sub || '';
  ui.banner.classList.add('show');
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => ui.banner.classList.remove('show'), dur || 2600);
}
let bannerTimer = 0;

// build tower cards
function buildCards() {
  ui.cards.innerHTML = '';
  for (const key of Object.keys(TOWERS)) {
    const t = TOWERS[key];
    const lv = t.lv[0];
    const dps = Math.round(lv.dmg * lv.rate * 10) / 10;
    const tag = t.desc.split('.')[0].replace(/^[^,]*,\s*/, '') || '';
    const mechanic = key === 'willow' ? 'single · air' : key === 'forge' ? 'splash' : key === 'frost' ? 'slow 65%' : key === 'storm' ? 'chain 3' : 'burst · air';
    const el = document.createElement('div');
    el.className = 'card';
    el.dataset.key = key;
    el.innerHTML = `<span class="key">${t.key}</span>
      <span class="tswatch" style="background:#${t.color.toString(16).padStart(6, '0')}"></span>
      <span class="tname">${t.name}</span>
      <span class="tstats">${dps} dps · rng ${lv.range}</span>
      <span class="tmech">${mechanic}</span>
      <span class="tcost">${lv.cost}g</span>
      <span class="tdesc">${t.desc}</span>`;
    el.addEventListener('click', () => selectBuild(key));
    ui.cards.appendChild(el);
  }
}
function selectBuild(key) {
  selectedBuildKey = selectedBuildKey === key ? null : key;
  if (selectedBuildKey) {
    toast(`Click the ground to raise a ${TOWERS[selectedBuildKey].name}`);
    makeGhost(selectedBuildKey);
  } else {
    ghostGroup.visible = false;
  }
  updateCards();
}
function updateCards() {
  for (const el of ui.cards.children) {
    const key = el.dataset.key;
    el.classList.toggle('selected', selectedBuildKey === key);
    el.classList.toggle('poor', sim.gold < TOWERS[key].cost);
  }
}
function updateHud() {
  ui.lives.textContent = sim.lives;
  ui.gold.textContent = Math.floor(sim.gold);
  ui.wave.textContent = sim.wave > 0 ? sim.wave + '/' + WAVES.length : (sim.phase === 'build' ? '-' : sim.wave);
  // boss bar
  const boss = sim.enemies.find(e => e.kind === 'boss');
  const bossbar = document.getElementById('bossbar');
  if (boss) {
    bossbar.classList.remove('hidden');
    document.getElementById('bossbar-fill').style.width = Math.max(0, 100 * boss.hp / boss.maxHp) + '%';
  } else bossbar.classList.add('hidden');
}

// ---------- input ----------
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const groundPt = new THREE.Vector3();
const ghostGroup = new THREE.Group();
let ghostMat = null;
let ghostRing = null;
scene.add(ghostGroup);

function makeGhost(key) {
  ghostGroup.clear();
  const P = makeTower(key);
  ghostGroup.add(P.group);
  ghostMat = new THREE.MeshBasicMaterial({ color: 0x9fe8a0, transparent: true, opacity: 0.55, depthWrite: false });
  ghostGroup.traverse(o => {
    if (o.isMesh) {
      o.castShadow = false;
      o.material = ghostMat;
    }
  });
  const range = TOWERS[key].lv[0].range;
  const ringGeo = new THREE.RingGeometry(range - 0.06, range, 48);
  ghostRing = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xece6cf, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false }));
  ghostRing.rotation.x = -Math.PI / 2;
  ghostRing.position.y = 0.06;
  ghostGroup.add(ghostRing);
  ghostGroup.visible = false;
}

function screenToGround(ev) {
  mouse.x = (ev.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(ev.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  // The ground is the planet cap (sphere at (0,-(R+CRUST),0), radius R).
  // Ray-sphere shoot: keeps clicks true to the curved surface.
  const o = raycaster.ray.origin, d = raycaster.ray.direction;
  const c = new THREE.Vector3(0, -(WORLD.R_P + WORLD.CRUST), 0);
  const L = new THREE.Vector3().subVectors(o, c);
  const b = L.dot(d);
  const disc = b * b - (L.lengthSq() - WORLD.R_P * WORLD.R_P);
  if (disc < 0) return null;               // ray misses the planet
  const t = -b - Math.sqrt(disc);
  if (t < 0) return null;                  // intersection behind the camera
  return { x: o.x + d.x * t, z: o.z + d.z * t };
}

// hover ghost update
canvas.addEventListener('pointermove', ev => {
  if (!selectedBuildKey) return;
  if (!ghostGroup.children.length) makeGhost(selectedBuildKey);
  const p = screenToGround(ev);
  if (!p) return;
  ghostGroup.visible = true;
  ghostGroup.position.set(p.x, groundHeight(p.x, p.z, sim.path, world.noise), p.z); // match syncTowers
  const ok = placementOk(p.x, p.z);
  ghostMat.color.setHex(ok ? 0x9fe8a0 : 0xe08a7a);
  ghostGroup.scale.set(1, 1, 1);
});

// placement validity
function placementOk(x, z) {
  if (Math.abs(x) > 20.5 || Math.abs(z) > 14.5) return false;
  const d = distToPathSafe(x, z);
  if (d < 1.15) return false;
  for (const t of sim.towers) {
    const dx = t.x - x, dz = t.z - z;
    if (dx * dx + dz * dz < 1.9 * 1.9) return false;
  }
  return true;
}
let dragStart = null;
canvas.addEventListener('pointerdown', ev => { dragStart = { x: ev.clientX, y: ev.clientY }; });
canvas.addEventListener('pointerup', ev => {
  if (!dragStart) return;
  const moved = Math.hypot(ev.clientX - dragStart.x, ev.clientY - dragStart.y);
  dragStart = null;
  if (moved > 6) return; // cancel: it was a drag
  const p = screenToGround(ev);
  if (!p) return;
  if (selectedBuildKey) {
    const res = placeTowerSim(p.x, p.z);
    if (res.ok) toast('Tower raised');
  } else {    // select a tower
    let hit = null, bd = 1.3 * 1.3;
    for (const t of sim.towers) {
      const dx = p.x - t.x, dz = p.z - t.z;
      if (dx * dx + dz * dz < bd) { bd = dx * dx + dz * dz; hit = t; }
    }
    selectedTowerId = hit ? hit.id : null;
    updatePanel();
  }
});
// camera drag orbit is skipped: fixed cinematic hero angle with subtle sway.
canvas.addEventListener('wheel', ev => {
  ev.preventDefault();
  cameraDist = clamp(cameraDist + ev.deltaY * 0.01, 18, 42);
}, { passive: false });

function placeTowerSim(x, z) {
  if (!selectedBuildKey) return { ok: false };
  const res = placeTower(sim, selectedBuildKey, x, z);
  if (res.ok) {
    audio.sfx('place');
    selectedBuildKey = null;
    ghostGroup.visible = false;
    updateCards();
  } else if (res.why === 'gold') toast('Not enough gold');
  return res;
}

function doUpgrade() {
  if (selectedTowerId == null) return;
  const res = upgradeTower(sim, selectedTowerId);
  if (res.ok) { audio.sfx('upgrade'); toast('Tower upgraded'); }
  else if (res.why === 'gold') toast('Not enough gold');
  updatePanel();
}
function doSell() {
  if (selectedTowerId == null) return;
  const res = sellTower(sim, selectedTowerId);
  if (res.ok) { audio.sfx('sell'); toast(`Sold for ${res.refund}g`); selectedTowerId = null; }
  updatePanel();
}
function updatePanel() {
  if (selectedTowerId == null) { ui.panel.classList.add('hidden'); hideRangeRing(); return; }
  const t = sim.towers.find(q => q.id === selectedTowerId);
  if (!t) { ui.panel.classList.add('hidden'); hideRangeRing(); return; }
  const def = TOWERS[t.type];
  ui.panel.classList.remove('hidden');
  showRangeRing(t);
  ui.panelTitle.textContent = def.name;
  ui.panelSub.textContent = `Level ${t.lv + 1}`;
  const next = def.lv[t.lv + 1];
  ui.panelStats.innerHTML =
    `<div class="row"><span>Damage</span><b>${t.dmg}${next ? ' &rarr; ' + next.dmg : ''}</b></div>` +
    `<div class="row"><span>Rate</span><b>${t.rate}/s</b></div>` +
    `<div class="row"><span>Range</span><b>${t.range}${next ? ' &rarr; ' + next.range : ''}</b></div>` +
    (t.splash ? `<div class="row"><span>Splash</span><b>${t.splash}</b></div>` : '') +
    (t.slow ? `<div class="row"><span>Slow</span><b>${Math.round(t.slow * 100)}%</b></div>` : '') +
    (t.chain ? `<div class="row"><span>Chain</span><b>${t.chain}</b></div>` : '');
  ui.btnUpgrade.textContent = next ? `Upgrade (${next.cost}g)` : 'Max level';
  ui.btnUpgrade.classList.toggle('disabled', !next || sim.gold < next.cost);
}

// range ring for selected tower
const selRing = new THREE.Mesh(
  new THREE.RingGeometry(0.98, 1.0, 48),
  new THREE.MeshBasicMaterial({ color: 0xffd98a, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false })
);
selRing.rotation.x = -Math.PI / 2;
selRing.visible = false;
scene.add(selRing);
function showRangeRing(t) {
  selRing.visible = true;
  selRing.scale.setScalar(t.range);
  selRing.position.set(t.x, groundHeight(t.x, t.z, sim.path, world.noise) + 0.07, t.z);
}
function hideRangeRing() { selRing.visible = false; }

// ---------- keyboard ----------
window.addEventListener('keydown', ev => {
  if (ev.key >= '1' && ev.key <= '5') {
    const keys = Object.keys(TOWERS);
    const k = keys[+ev.key - 1];
    if (k) selectBuild(k);
  }
  if (ev.key === 'Escape') { selectedBuildKey = null; updateCards(); selectedTowerId = null; updatePanel(); }
  if (ev.key === ' ') { ev.preventDefault(); togglePause(); }
  if (ev.key === 'm') toggleMute();
});

// ---------- topbar buttons ----------
$('btn-speed').addEventListener('click', () => {
  sim.speed = sim.speed === 1 ? 2 : 1;
  $('btn-speed').textContent = sim.speed + 'x';
  $('btn-speed').classList.toggle('active', sim.speed > 1);
});
$('btn-pause').addEventListener('click', () => togglePause());
$('btn-mute').addEventListener('click', () => toggleMute());
function togglePause() {
  sim.pause = !sim.pause;
  $('btn-pause').classList.toggle('active', sim.pause);
}
function toggleMute() {
  audio.setMuted(!audio.muted);
  $('btn-mute').textContent = audio.muted ? '\u266A\u0337' : '\u266A';
}

// ---------- wave button ----------
const waveBtn = document.createElement('button');
waveBtn.className = 'hbtn'; waveBtn.id = 'btn-wave';
waveBtn.textContent = 'Start Wave';
$('topbar').insertBefore(waveBtn, $('btn-speed'));
waveBtn.addEventListener('click', startWaveClick);
function startWaveClick() {
  audio.resume();
  if (startWave(sim)) {
    audio.sfx('wave-horn');
    showBanner(`WAVE ${sim.wave}`, WAVES[sim.wave - 1].name, 2800);
  } else toast('Wave already in progress');
}

function shortestAngle(from, to) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// ---------- GPU resource disposal (leak prevention) ----------
const SHARED_DISPOSE = new Set(); // geometry/material that must survive (shared mats)
function disposeView(obj) {
  obj.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        if (m.userData && m.userData.__shared) continue; // shared across entities
        if (!SHARED_DISPOSE.has(m)) {
          SHARED_DISPOSE.add(m); // disposed once, no double free
          m.dispose();
        }
      }
    }
  });
}

// ---------- entity sync (render side) ----------
const enemyViews = new Map(); // id -> {P, parts}
const towerViews = new Map(); // id -> {P}

function syncEnemies(dt) {
  const seen = new Set();
  for (const e of sim.enemies) {
    seen.add(e.id);
    let v = enemyViews.get(e.id);
    if (!v) {
      const P = makeEnemy(e.kind);
      scene.add(P.group);
      v = { P, dead: false };
      enemyViews.set(e.id, v);
    }
    v.P.group.position.x = e.x;
    v.P.group.position.z = e.z;
    v.P.group.position.y = groundHeight(e.x, e.z, sim.path, world.noise);
    // ease-rotate toward travel direction; stalker sway is applied to body, not group
    v.P.group.rotation.y += shortestAngle(v.P.group.rotation.y, e.face) * Math.min(1, dt * 6);
    animateEnemy(v.P, e, renderTime);
    // ground offset: boss model hangs below its origin; keep feet on the road (dip preserved)
    if (e.kind === 'boss') {
      const dip = v.P.group.userData.__dip || 0;
      v.P.group.position.y = groundHeight(e.x, e.z, sim.path, world.noise) + 1.45 + dip;
    }
    // hp bar
    const hb = v.P.parts.hpBar;
    if (e.hp < e.maxHp) {
      hb.visible = true;
      updateHpBar(hb, e.hp / e.maxHp);
      // face camera-ish: bar's +Z should point at the camera (billboard on Y)
      const dx = camera.position.x - e.x, dz = camera.position.z - e.z;
      hb.rotation.y = Math.atan2(dx, dz);
      hb.rotation.x = 0;
    } else hb.visible = false;
  }
  // removal is handled by the kill/leak events (they carry the id and a flag);
  // this pass is only a safety net for anything that vanished silently.
  for (const [id, v] of enemyViews) {
    if (!seen.has(id)) {
      disposeView(v.P.group);
      scene.remove(v.P.group);
      enemyViews.delete(id);
    }
  }
}

function spawnDeathBurst(id, v) {
  // use last known pos stored on view
  const x = v.P.group.position.x, z = v.P.group.position.z;
  const kind = v.P.kind;
  const colors = kind === 'wisp' ? [0xd7f27e, 0xf0f8c8] :
    kind === 'ember' ? [0xf2a24b, 0xffd27a, 0xd97b2f] :
    kind === 'boss' ? [0xb7e8c9, 0x9aa79b, 0xffffff] :
    kind === 'beetle' ? [0x6f9d55, 0x9fce6a] :
    kind === 'stalker' ? [0xb7c49b, 0x86935f] :
    [0x87956a, 0xa5b475];
  fx.burst(x, groundHeight(x, z, sim.path, world.noise) + 0.7, z, { colors, count: kind === 'boss' ? 42 : 20, speed: kind === 'boss' ? 6.5 : 3.6, up: 2.4, life: 0.85, size: 10, grav: 7 });
  const soul = makeSoulBurst(colors[0]);
  soul.mesh.position.set(x, groundHeight(x, z, sim.path, world.noise) + 0.8, z);
  scene.add(soul.mesh);
  souls.push(soul);
  if (kind === 'boss') {
    // shockwave rings + screen kick
    rings.push(makeBlastRing(4.2));
    rings[rings.length - 1].mesh.position.set(x, groundHeight(x, z, sim.path, world.noise) + 0.15, z);
    scene.add(rings[rings.length - 1].mesh);
    cameraKick = 1;
  }
}

function syncTowers(dt) {
  const seen = new Set();
  for (const t of sim.towers) {
    seen.add(t.id);
    let v = towerViews.get(t.id);
    if (!v) {
      const P = makeTower(t.type);
      scene.add(P.group);
      v = { P };
      towerViews.set(t.id, v);
    }
    v.P.group.position.x = t.x;
    v.P.group.position.z = t.z;
    v.P.group.position.y = groundHeight(t.x, t.z, sim.path, world.noise);
    // scale by level
    const s = 1 + t.lv * 0.1;
    v.P.group.scale.setScalar(s);
    animateTower(v.P, t, renderTime, dt);
  }
  for (const [id, v] of towerViews) {
    if (!seen.has(id)) {
      disposeView(v.P.group);
      scene.remove(v.P.group);
      towerViews.delete(id);
    }
  }
}

// ---------- projectiles ----------
const projViews = new Set(); // meshes managed here
function syncProjectiles(dt) {
  // spawn meshes for sim projectiles
  for (const p of sim.projectiles) {
    if (p._mesh) continue;
    const m = makeProjectileMesh(p.kind);
    if (m) {
      scene.add(m);
      p._mesh = m;
      m.userData.sx = p.sx; m.userData.sz = p.sz;
    }
  }
  for (const p of sim.projectiles) {
    if (!p._mesh) continue;
    const k = clamp(p.t / p.dur, 0, 1);
    const m = p._mesh;
    const sx = p.sx, sz = p.sz;
    const gx = lerp(sx, p.tx, k), gz = lerp(sz, p.tz, k);
    const gy = groundHeight(gx, gz, sim.path, world.noise);
    if (p.kind === 'arrow') {
      m.position.set(gx, gy + 1.7 + Math.sin(k * Math.PI) * 1.5, gz);
      m.rotation.set(0, Math.atan2(p.tx - sx, p.tz - sz), 0);
      m.rotation.z = -Math.PI / 2;
    } else if (p.kind === 'ember') {
      m.position.set(gx, gy + 2.2 + Math.sin(k * Math.PI) * 5.0, gz);
      if (Math.random() < 0.55) fx.spawn(m.position.x, m.position.y, m.position.z, (Math.random() - 0.5) * 0.8, -0.8 - Math.random(), (Math.random() - 0.5) * 0.8, 0xff9b3e, 6, 0.5, 1.0);
    } else if (p.kind === 'petal') {
      m.position.set(gx, gy + 1.4 - k * 0.8, gz);
      m.rotation.x += dt * 18;
      m.rotation.z += dt * 9;
    }
  }
  // remove meshes whose sim entry is gone
  for (const p of Array.from(projViews)) {
    if (!sim.projectiles.includes(p)) {
      if (p._mesh) { disposeView(p._mesh); scene.remove(p._mesh); p._mesh = null; }
      projViews.delete(p);
    }
  }
  for (const p of sim.projectiles) projViews.add(p);
}

// ---------- render loop ----------
let renderTime = 0;
let acc = 0;
let cameraDist = 27;
let cameraKick = 0;
let camOverride = null;
let lastNow = performance.now();
let frame = 0;

function animate(now) {
  requestAnimationFrame(animate);
  try {
    stepFrame(now);
  } catch (err) {
    const st = String(err && err.stack || err);
    if (!window.__ERRSTACKS.some(s => s.includes('stepFrame') || s.includes(String(err)))) window.__ERRSTACKS.push('FRAME: ' + st.split('\n').slice(0, 4).join(' | '));
    window.__ERRORS.push('FRAME: ' + String(err));
    if (!window.__FRAMEERR) window.__FRAMEERR = String(err) + '\n' + st;
  }
}

function stepFrame(now) {
  const dtReal = Math.min(0.05, (now - lastNow) / 1000);
  lastNow = now;
  renderTime += dtReal;

  // fixed-timestep sim
  if (!sim.pause) {
    acc += dtReal * sim.speed;
    const STEP = 1 / 60;
    let guard = 0;
    while (acc >= STEP && guard < 8) {
      simStep(sim, STEP);
      processSimEvents();
      acc -= STEP; guard++;
    }
  }

  // visuals
  animateProps(world, renderTime);
  syncEnemies(dtReal);
  syncTowers(dtReal);
  syncProjectiles(dtReal);
  fx.update(dtReal);

  // bolts fade
  for (let i = bolts.length - 1; i >= 0; i--) {
    const b = bolts[i];
    b.t += dtReal;
    const k = b.t / b.dur;
    b.mesh.children.forEach(c => { if (c.material) c.material.opacity = Math.max(0, 1 - k); });
    if (k >= 1) { disposeView(b.mesh); scene.remove(b.mesh); bolts.splice(i, 1); }
  }
  for (let i = rings.length - 1; i >= 0; i--) {
    const r = rings[i];
    r.t += dtReal;
    const k = r.t / r.dur;
    // expand from 40% to exactly the authored radius (rings are authored at full radius)
    r.mesh.scale.setScalar(0.4 + k * 0.6);
    const alpha = Math.max(0, 0.8 * (1 - k));
    r.mesh.children.forEach(c => { if (c.material) c.material.opacity = alpha; });
    if (r.mesh.material) r.mesh.material.opacity = alpha * (r.mesh.material.opacity !== undefined ? 0.8 : 1);
    if (k >= 1) { disposeView(r.mesh); scene.remove(r.mesh); rings.splice(i, 1); }
  }
  for (let i = souls.length - 1; i >= 0; i--) {
    const s = souls[i];
    s.t += dtReal;
    const k = s.t / s.dur;
    s.mesh.position.y = 0.8 + k * 2.2;
    s.mesh.scale.setScalar(1 - k * 0.6);
    s.mesh.material.opacity = Math.max(0, 0.9 * (1 - k));
    if (k >= 1) { disposeView(s.mesh); scene.remove(s.mesh); souls.splice(i, 1); }
  }

  // camera: hero angle + gentle sway + kick
  cameraKick = Math.max(0, cameraKick - dtReal * 1.6);
  if (camOverride) {
    camera.position.set(camOverride.pos[0], camOverride.pos[1], camOverride.pos[2]);
    camera.lookAt(camOverride.look[0], camOverride.look[1], camOverride.look[2]);
  } else {
    const sway = Math.sin(renderTime * 0.16) * 0.7;
    camera.position.x = sway;
    camera.position.y = cameraDist * 0.86 - cameraKick * 0.12;
    camera.position.z = cameraDist * 0.92 + sway * 0.4;
    const lookY = 0.2 - cameraKick * 0.3;
    camera.lookAt(0, lookY, 0);
  }

  // mist drift
  for (const l of mist.layers) {
    if (l.veil) {
      const base = l.driftZ ? 0 : l.x0;
      const off = Math.sin(renderTime * l.sp * 0.5 + l.ph) * 1.2;
      if (l.driftZ) { l.mesh.position.z = base + off; l.mesh.position.x = l.x0; }
      else { l.mesh.position.x = base + off; }
    } else {
      l.mesh.position.x = l.x0 + Math.sin(renderTime * l.sp * 0.5 + l.ph) * 1.6;
    }
  }
  // sky rotation
  sky.rotation.y = renderTime * 0.0022;

  composer.render();
  updateHud();
  updateCards();
  frame++;
}

// ---------- event processing ----------
function processSimEvents() {
  // snapshot + clear at the TOP: a throwing handler must never re-fire events
  const evs = sim.events;
  sim.events = [];
  for (const ev of evs) {
    switch (ev.type) {
      case 'kill': {
        audio.sfx(ev.kind === 'wisp' ? 'kill-fly' : ev.kind === 'boss' ? 'kill-boss' : 'kill');
        const v = enemyViews.get(ev.id);
        if (v) { spawnDeathBurst(ev.id, v); disposeView(v.P.group); scene.remove(v.P.group); enemyViews.delete(ev.id); }
        break;
      }
      case 'leak': {
        audio.sfx('leak');
        const v = enemyViews.get(ev.id);
        if (v) { disposeView(v.P.group); scene.remove(v.P.group); enemyViews.delete(ev.id); }
        toast(ev.boss ? 'The Stonehorn breached the hearth! -10 lives' : 'The hearth is damaged!');
        break;
      }
      case 'wave-start': {
        showBanner(`WAVE ${ev.wave}`, ev.name, 2600);
        break;
      }
      case 'wave-end': {
        audio.sfx('click');
        showBanner('Wave cleared', `+${ev.bonus} gold`, 2200);
        break;
      }
      case 'victory': {
        audio.sfx('victory');
        showBanner('THE VALE IS SAFE', 'All three waves ended. You win.', 6000);
        document.getElementById('letterbox').style.opacity = 1;
        break;
      }
      case 'defeat': {
        audio.sfx('defeat');
        showBanner('THE HEARTH FALLS', 'The vale is lost...', 8000);
        document.getElementById('letterbox').style.opacity = 1;
        break;
      }
      case 'fire': {
        const t = sim.towers.find(q => q.id === ev.id);
        if (t) {
          if (t.type !== 'storm') {
            audio.sfx(t.type === 'willow' ? 'arrow' : t.type === 'forge' ? 'forge' : t.type === 'frost' ? 'frost' : 'lumen');
          }
          if (t.type === 'frost') {
            const r = makeIceRing(t.range);
            r.mesh.position.set(t.x, 0.2, t.z);
            scene.add(r.mesh);
            rings.push(r);
          }
        }
        break;
      }
      case 'boom': {
        fx.burst(ev.x, 0.6, ev.z, { colors: [0xff9b3e, 0xffd27a, 0xd97b2f, 0x8d7c53], count: 26, speed: 5.5, up: 2.6, life: 0.7, size: 10, grav: 8 });
        const r = makeBlastRing(ev.r); r.mesh.position.set(ev.x, 0.15, ev.z);
        scene.add(r.mesh); rings.push(r);
        break;
      }
      case 'blast': {
        fx.burst(ev.x, 0.7, ev.z, { colors: [0xffd98a, 0xffe9bb, 0xffc96a], count: 30, speed: 6, up: 2, life: 0.8, size: 11, grav: 3 });
        break;
      }
      case 'boss-spawn': {
        audio.sfx('boss-step');
        break;
      }
      case 'build': {
        const t = sim.towers.find(q => q.id === ev.id);
        if (t) {
          fx.burst(t.x, 0.4, t.z, { colors: [0xb7e8c9, 0x9fce6a, 0xece6cf], count: 18, speed: 3, up: 2.4, life: 0.6, size: 8, grav: 5 });
        }
        break;
      }
      default: break;
    }
  }
  // drain bolts from sim.shots (prune consumed entries so the array never grows)
  for (let i = sim.shots.length - 1; i >= 0; i--) {
    const sh = sim.shots[i];
    if (!sh._done) {
      sh._done = true;
      const b = makeBolt({ x: sh.from.x, y: sh.from.y, z: sh.from.z }, sh.pts, sh.dur);
      scene.add(b.mesh);
      bolts.push(b);
      audio.sfx('storm');
    } else {
      sim.shots.splice(i, 1);
    }
  }
}

// ---------- boot ----------
function boot() {
  buildCards();
  updateHud();
  updatePanel();
  initBlenderAssets().then(() => { // async swap-in of Blender GLB assets
    useBlenderRocks(getBlenderGeometries('rocks'));
  });
  document.getElementById('boot').classList.add('gone');
  window.__READY = true;
}

// ---------- test API ----------
window.__game = {
  sim, scene, camera, renderer,
  place: (k, x, z) => placeTower(sim, k, x, z),
  upgrade: id => upgradeTower(sim, id),
  sell: id => sellTower(sim, id),
  startWave: () => startWave(sim),
  step: n => { for (let i = 0; i < (n || 1); i++) simStep(sim, 1 / 60); },
  setGold: g => { sim.gold = g; },
  select: k => selectBuild(k),
  audio, renderTime: () => renderTime, frame: () => frame,
  // deterministic render drive: bypass rAF for headless screenshots
  renderFrames: (n) => {
    let now = lastNow + 16.7 * (n || 1);
    for (let i = 0; i < (n || 1); i++) {
      now += 16.7;
      stepFrame(now);
    }
  },
  // debug camera: disables auto-camera while set (pass null to restore)
  setCam: (x, y, z, tx, ty, tz) => {
    if (x == null) { camOverride = null; return; }
    camOverride = { pos: [x, y, z], look: [tx, ty, tz] };
  }
};

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});

// first user gesture resumes audio
const resumeOnce = () => { audio.resume(); document.removeEventListener('pointerdown', resumeOnce); };
document.addEventListener('pointerdown', resumeOnce);

animate(performance.now());
boot();
