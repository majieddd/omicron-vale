// Omicron: Willow Vale Defense - deterministic pure-logic simulation.
// NO DOM, NO THREE. Runs in node (tests) and browser (game) identically.
// Fixed timestep: sim.step(dt) with dt = 1/60.

export const SEED = 20260829;
export const TICK = 1 / 60;

// ---------- RNG / math ----------
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
export const dist2 = (ax, az, bx, bz) => { const dx = ax - bx, dz = az - bz; return dx * dx + dz * dz; };

// ---------- Path: dense polyline from spline control points ----------
// The dirt road winds from the west gate to the hearth at the hut.
export function buildPath(ctrl) {
  const pts = [];
  // Catmull-Rom through control points, densely sampled.
  for (let i = 0; i < ctrl.length - 1; i++) {
    const p0 = ctrl[Math.max(0, i - 1)], p1 = ctrl[i], p2 = ctrl[i + 1], p3 = ctrl[Math.min(ctrl.length - 1, i + 2)];
    const STEPS = 24;
    for (let s = 0; s < STEPS; s++) {
      const t = s / STEPS, t2 = t * t, t3 = t2 * t;
      const x = 0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
      const z = 0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
      pts.push([x, z]);
    }
  }
  pts.push([ctrl[ctrl.length - 1][0], ctrl[ctrl.length - 1][1]]);
  // cum length
  let len = 0;
  for (let i = 0; i < pts.length; i++) {
    if (i > 0) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    pts[i][2] = len;
  }
  return { pts, len };
}
export function pathAt(path, d) {
  const pts = path.pts; let lo = 0, hi = pts.length - 1;
  d = clamp(d, 0, path.len);
  while (lo < hi) { const mid = (lo + hi) >> 1; if (pts[mid][2] < d) lo = mid + 1; else hi = mid; }
  const i = Math.max(1, lo), a = pts[i - 1], b = pts[i];
  const seg = (b[2] - a[2]) || 1, t = (d - a[2]) / seg;
  return { x: lerp(a[0], b[0], t), z: lerp(a[1], b[1], t), dx: (b[0] - a[0]) / seg, dz: (b[1] - a[1]) / seg };
}
export function distToPath(path, x, z) {
  let best = Infinity;
  for (let i = 0; i < path.pts.length; i += 3) {
    const d = Math.hypot(x - path.pts[i][0], z - path.pts[i][1]);
    if (d < best) best = d;
  }
  return best;
}

// ---------- Data tables (balance knob central) ----------
export const TOWERS = {
  willow: {
    name: 'Willow Warden', key: '1', cost: 100, range: 9, rate: 1.6, dmg: 12, color: 0x9fce6a,
    desc: 'Swift longbow watch. Anti-air, single target. Arcs leaf-arrows.',
    lv: [
      { cost: 100, dmg: 12, rate: 1.6, range: 9 },
      { cost: 75, dmg: 20, rate: 1.5, range: 10 },
      { cost: 130, dmg: 32, rate: 1.35, range: 11.5 }
    ]
  },
  forge: {
    name: 'Ember Forge', key: '2', cost: 180, range: 11, rate: 0.62, dmg: 30, color: 0xe08a3c,
    desc: 'Lobs blazing caltrops. Full hit on direct, 40% splash.',
    lv: [
      { cost: 180, dmg: 30, rate: 0.62, range: 11, splash: 2.6 },
      { cost: 130, dmg: 46, rate: 0.60, range: 12, splash: 3.1 },
      { cost: 170, dmg: 70, rate: 0.56, range: 13, splash: 3.7 }
    ]
  },
  frost: {
    name: 'Frostbloom Totem', key: '3', cost: 110, range: 7.5, rate: 1.0, dmg: 7, color: 0x8fd8e8,
    desc: 'Sighing petals chill all in range; slow 65%.',
    lv: [
      { cost: 110, dmg: 7, rate: 1.0, range: 7.5, slow: 0.65 },
      { cost: 95, dmg: 12, rate: 1.0, range: 8.2, slow: 0.7 },
      { cost: 135, dmg: 19, rate: 1.0, range: 9.0, slow: 0.75 }
    ]
  },
  storm: {
    name: 'Storm Drum', key: '4', cost: 160, range: 10, rate: 0.8, dmg: 20, color: 0xc9a3ff,
    desc: 'A cracked drum that sings chain lightning across 3 foes.',
    lv: [
      { cost: 160, dmg: 20, rate: 0.8, range: 10, chain: 3 },
      { cost: 120, dmg: 30, rate: 0.78, range: 10.5, chain: 3 },
      { cost: 165, dmg: 48, rate: 0.74, range: 11.5, chain: 4 }
    ]
  },
  lumen: {
    name: 'Lumen Hearth', key: '5', cost: 190, range: 8.5, rate: 0.45, dmg: 42, color: 0xffd98a,
    desc: 'A lantern heart thrumming a radiant blast. Hits air too.',
    lv: [
      { cost: 190, dmg: 42, rate: 0.45, range: 8.5 },
      { cost: 150, dmg: 66, rate: 0.45, range: 9.0 },
      { cost: 200, dmg: 100, rate: 0.44, range: 9.5 }
    ]
  }
};

// Which towers can hit airborne (wisp) enemies. Niche: willow + lumen are anti-air.
export const TOWER_AIR = { willow: true, lumen: true };

export const ENEMIES = {
  wisp:     { name: 'Flitter Wisp',    hp: 40,  speed: 2.4, reward: 8,  color: 0xd7f27e, kind: 'fly', air: true },
  beetle:   { name: 'Crowned Beetle',  hp: 150, speed: 1.4, reward: 14, color: 0x6f9d55, kind: 'ground', armorSingle: 0.35 },
  ember:    { name: 'Emberling',       hp: 78,  speed: 2.3, reward: 10, color: 0xf29c55, kind: 'ground' },
  stalker:  { name: 'Briar Stalker',   hp: 95,  speed: 2.4, reward: 12, color: 0xb7c49b, kind: 'ground', jitter: 1.6 },
  grunt:    { name: 'Mossback Grunt',  hp: 210, speed: 1.7, reward: 20, color: 0x87956a, kind: 'ground' },
  boss:     { name: 'Stonehorn Sentinel', hp: 2600, speed: 0.95, reward: 200, color: 0x9aa79b, kind: 'boss',
              armorSplash: 0.5, slowImmune: true, leak: 10 }
};

export const WAVES = [
  { name: 'The Drift',     groups: [
    { e: 'wisp', n: 8,  delay: 0.9 },
    { e: 'beetle', n: 5, delay: 1.8 }
  ]},
  { name: 'The Bramble',   groups: [
    { e: 'stalker', n: 8, delay: 1.1 },
    { e: 'ember', n: 8, delay: 1.0 },
    { e: 'grunt', n: 5, delay: 1.6 }
  ]},
  { name: 'The Stonehorn', groups: [
    { e: 'wisp', n: 10, delay: 0.7 },
    { e: 'grunt', n: 8, delay: 1.1 },
    { e: 'ember', n: 8, delay: 0.9 },
    { e: 'boss', n: 1,  delay: 0 }
  ]}
];

export const START_GOLD = 300;
export const START_LIVES = 20;
export const WAVE_BONUS = { 1: 60, 2: 90, 3: 150 };

// ---------- Sim state ----------
export function newState(path) {
  return {
    path,
    t: 0,               // sim time (s)
    phase: 'build',     // build | combat | victory | defeat
    gold: START_GOLD, lives: START_LIVES,
    wave: 0,            // current wave number (0 = none)
    enemies: [], towers: [],
    projectiles: [], shots: [], orbs: [],
    spawnq: [],         // {e, at, jitter}
    kills: 0, leaks: 0,
    speed: 1, pause: false,
    nextId: 1,
    rng: mulberry32(SEED),
    events: []          // {type, ...} drained by render/audio
  };
}

export function startWave(s) {
  if (s.phase !== 'build' || s.wave >= WAVES.length) return false;
  s.wave++;
  s.phase = 'combat';
  const def = WAVES[s.wave - 1];
  let at = 1.2;
  const rng = mulberry32(SEED + s.wave * 7919);
  for (const g of def.groups) {
    for (let i = 0; i < g.n; i++) {
      s.spawnq.push({ e: g.e, at: at, jitter: (rng() - 0.5) * 0.8 });
      at += g.delay * (0.9 + rng() * 0.2);
    }
  }
  s.events.push({ type: 'wave-start', wave: s.wave, name: def.name });
  return true;
}

export function placeTower(s, typeKey, x, z) {
  const def = TOWERS[typeKey];
  if (!def) return { ok: false, why: 'unknown tower' };
  if (s.phase === 'defeat' || s.phase === 'victory') return { ok: false, why: 'game over' };
  if (s.gold < def.cost) return { ok: false, why: 'gold' };
  if (distToPath(s.path, x, z) < 1.05) return { ok: false, why: 'path' };
  // towers must not overlap one another
  for (const t of s.towers) if (dist2(t.x, t.z, x, z) < 1.9 * 1.9) return { ok: false, why: 'overlap' };
  s.gold -= def.cost;
  const id = s.nextId++;
  const lv = def.lv[0];
  s.towers.push({ id, type: typeKey, x, z, lv: 0, cd: 0, hp: 1, aim: 0, anim: 0, fired: 0, root: null, spell: 0,
    dmg: lv.dmg, rate: lv.rate, range: lv.range, splash: lv.splash || 0, slow: lv.slow || 0, chain: lv.chain || 1 });
  s.events.push({ type: 'build', id });
  return { ok: true, id };
}

export function upgradeTower(s, id) {
  const t = s.towers.find(q => q.id === id);
  if (!t) return { ok: false, why: 'none' };
  const next = TOWERS[t.type].lv[t.lv + 1];
  if (!next) return { ok: false, why: 'max' };
  if (s.gold < next.cost) return { ok: false, why: 'gold' };
  s.gold -= next.cost;
  t.lv++; t.dmg = next.dmg; t.rate = next.rate; t.range = next.range;
  if (next.splash !== undefined) t.splash = next.splash;
  if (next.slow !== undefined) t.slow = next.slow;
  if (next.chain !== undefined) t.chain = next.chain;
  s.events.push({ type: 'upgrade', id });
  return { ok: true };
}

export function sellTower(s, id) {
  const i = s.towers.findIndex(q => q.id === id);
  if (i < 0) return { ok: false };
  const t = s.towers[i];
  let refund = TOWERS[t.type].cost;
  for (let l = 0; l < t.lv; l++) refund += Math.round(TOWERS[t.type].lv[l + 1].cost * 0.7);
  refund = Math.round(refund * 0.7);
  s.gold += refund;
  s.towers.splice(i, 1);
  s.events.push({ type: 'sell', id });
  return { ok: true, refund };
}

// ---------- Combat ----------
function hurt(s, e, dmg, opts = {}) {
  if (e.dead) return;
  let mult = 1;
  // armor semantics: single-target resist vs splash resist (niche counters)
  if (opts.kind === 'single' && e.armorSingle) mult *= (1 - e.armorSingle);
  if (opts.kind === 'splash' && e.armorSplash) mult *= (1 - e.armorSplash);
  e.hp -= dmg * mult;
  e.flash = 0.12;
  if (opts.slow && !e.slowImmune && e.slowT < opts.slow) { e.slowT = opts.slow; e.slowD = opts.slowDur || 2.2; }
  if (e.hp <= 0) {
    e.dead = true;
    s.kills++;
    s.gold += e.reward;
    s.events.push({ type: 'kill', id: e.id, x: e.x, z: e.z, kind: e.kind, reward: e.reward });
  }
}

function spawnEnemy(s, kind) {
  const def = ENEMIES[kind];
  const id = s.nextId++;
  s.enemies.push({
    id, kind, name: def.name, hp: def.hp, maxHp: def.hp,
    speed: def.speed, reward: def.reward, color: def.color, kindFlag: def.kind,
    air: !!def.air, armorSingle: def.armorSingle || 0, armorSplash: def.armorSplash || 0,
    slowImmune: !!def.slowImmune, leak: def.leak || 1,
    jitter: def.jitter || 0, lane: (s.rng() - 0.5) * 0.9,
    d: 0, x: 0, z: 0, dead: false, flash: 0, slowT: 0, slowD: 0,
    anim: s.rng() * 10, state: 'walk', stateT: 0, goal: 0, face: 0
  });
  s.events.push({ type: 'spawn', id, kind });
}

export function step(s, dtRaw) {
  const dt = Math.min(0.5, dtRaw);
  s.t += dt;
  // drain spawn queue (all due entries, in order)
  while (s.spawnq.length && s.spawnq[0].at <= s.t) {
    const q = s.spawnq.shift();
    spawnEnemy(s, q.e);
    if (q.e === 'boss') s.events.push({ type: 'boss-spawn', id: s.enemies[s.enemies.length - 1].id });
  }
  // enemies move along path
  for (const e of s.enemies) {
    if (e.dead) continue;
    let sp = e.speed;
    if (e.slowT > 0 && !e.slowImmune) { sp *= (1 - e.slowT); e.slowD -= dt; if (e.slowD <= 0) e.slowT = 0; }
    else if (e.slowImmune) e.slowT = 0;
    e.d += sp * dt;
    if (e.kind === 'fly') e.d += sp * dt * 0.15; // slight hover drift
    const p = pathAt(s.path, e.d);
    const side = Math.sin(e.d * 0.8 + e.anim) * e.jitter;
    const sdx = -p.dz, sdz = p.dx;
    e.x = p.x + sdx * side; e.z = p.z + sdz * side;
    e.face = Math.atan2(p.dx, p.dz); // face along travel direction
    if (e.flash > 0) e.flash -= dt;
    if (e.d >= s.path.len - 0.6) {
      e.dead = true;
      s.leaks++;
      const cost = e.leak || 1;
      s.lives -= cost;
      s.events.push({ type: 'leak', id: e.id, boss: e.kind === 'boss', cost });
      if (s.lives <= 0) { s.lives = 0; s.phase = 'defeat'; s.events.push({ type: 'defeat' }); }
    }
  }
  s.enemies = s.enemies.filter(e => !e.dead);

  // towers act
  for (const t of s.towers) {
    if (t.cd > 0) t.cd -= dt;
    // find target: nearest-to-heath in range; aerial-only unless tower is anti-air
    let target = null, bestD = -1;
    const canAir = !!TOWER_AIR[t.type];
    for (const e of s.enemies) {
      if (e.dead) continue;
      if (e.air && !canAir) continue;
      const d = dist2(t.x, t.z, e.x, e.z);
      if (d <= t.range * t.range && e.d > bestD) { bestD = e.d; target = e; }
    }
    if (target) {
      t.aim = Math.atan2(target.x - t.x, target.z - t.z);
      if (t.cd <= 0) fireTower(s, t, target);
    } else t.spell = Math.max(0, t.spell - dt);
  }

  // projectiles
  for (const p of s.projectiles) {
    p.t += dt;
    const k = p.t / p.dur;
    const tp = p.targets;
    if (k >= 1) {
      // direct hit (full damage) on the projectile's target
      for (const te of tp) if (!te.dead) hurt(s, te, p.dmg, { kind: 'single', slow: p.slow, slowDur: p.slowDur || 2.2 });
      if (p.splash) {
        // splash: 40% of direct damage to every enemy in radius (density-scaled)
        const sd = p.splashDmg || p.dmg * 0.4;
        for (const e of s.enemies) {
          if (e.dead) continue;
          const d2 = dist2(p.tx, p.tz, e.x, e.z);
          if (d2 <= p.splash * p.splash) hurt(s, e, sd, { kind: 'splash' });
        }
        s.events.push({ type: 'boom', x: p.tx, z: p.tz, r: p.splash });
      }
      p.done = true;
    } else {
      // track target position live (homing arrows/embers)
      if (p.targets.length && !p.targets[0].dead) {
        p.tx = p.targets[0].x; p.tz = p.targets[0].z;
      }
    }
  }
  s.projectiles = s.projectiles.filter(p => !p.done);

  // chain lightning resolution (instant, on fire)
  // orbs (lumen pulse) travel out and return
  for (const o of s.orbs) {
    o.t += dt;
    const k = o.t / o.dur;
    if (k >= 1) {
      for (const e of s.enemies) {
        if (e.dead) continue;
        if (dist2(o.x, o.z, e.x, e.z) <= o.r * o.r) hurt(s, e, o.dmg, { kind: 'single' });
      }
      s.events.push({ type: 'blast', x: o.x, z: o.z, r: o.r });
      o.done = true;
    }
  }
  s.orbs = s.orbs.filter(o => !o.done);

  // wave completion
  if (s.phase === 'combat' && s.spawnq.length === 0 && s.enemies.length === 0) {
    if (s.wave >= WAVES.length) {
      // victory if wave 3 cleared
      s.phase = 'victory';
      s.gold += WAVE_BONUS[s.wave] || 0;
      s.events.push({ type: 'victory' });
    } else {
      s.phase = 'build';
      s.gold += WAVE_BONUS[s.wave] || 0;
      s.events.push({ type: 'wave-end', wave: s.wave, bonus: WAVE_BONUS[s.wave] || 0, name: WAVES[s.wave - 1].name });
    }
  }
}

function chainTargets(s, t, first) {
  const out = [first];
  let cur = first, avail = s.enemies.filter(e => !e.dead && e.id !== first.id);
  while (out.length < t.chain && avail.length) {
    let best = null, bd = 7 * 7;
    for (const e of avail) { const d = dist2(cur.x, cur.z, e.x, e.z); if (d < bd) { bd = d; best = e; } }
    if (!best) break;
    out.push(best); avail = avail.filter(e => e.id !== best.id); cur = best;
  }
  return out;
}

function fireTower(s, t, target) {
  const type = t.type;
  t.cd = 1 / t.rate;
  t.anim = 0.001; t.fired++; t.spell = 0.001;
  s.events.push({ type: 'fire', id: t.id });
  if (type === 'willow') {
    s.projectiles.push({ kind: 'arrow', t: 0, dur: 0.42, targets: [target], tx: target.x, tz: target.z, sx: t.x, sz: t.z, dmg: t.dmg, dmp: 0 });
  } else if (type === 'forge') {
    const d = Math.sqrt(dist2(t.x, t.z, target.x, target.z));
    // splashDmg omitted: splash resolves to 40% of direct damage (density-scaled, not wave-clear)
    s.projectiles.push({ kind: 'ember', t: 0, dur: 0.5 + d * 0.075, targets: [target], tx: target.x, tz: target.z, sx: t.x, sz: t.z, dmg: t.dmg, splash: t.splash });
  } else if (type === 'frost') {
    // spiral of petals around the totem hitting all in range (ground only)
    for (const e of s.enemies) {
      if (e.dead || e.air) continue;
      const d = Math.hypot(e.x - t.x, e.z - t.z);
      if (d <= t.range) s.projectiles.push({ kind: 'petal', t: 0, dur: 0.16, targets: [e], tx: e.x, tz: e.z, sx: t.x, sz: t.z, dmg: t.dmg, slow: t.slow, slowDur: 2.2 });
    }
  } else if (type === 'storm') {
    const chain = chainTargets(s, t, target);
    s.shots.push({ kind: 'bolt', pts: chain.map(e => ({ x: e.x, z: e.z })), t: 0, dur: 0.28, from: { x: t.x, z: t.z, y: 2.2 } });
    for (const te of chain) hurt(s, te, t.dmg, { kind: 'single' });
  } else if (type === 'lumen') {
    s.orbs.push({ t: 0, dur: 0.85, x: t.x, z: t.z, r: t.range, dmg: t.dmg });
  }
}

export function simSnapshot(s) {
  return { t: s.t, phase: s.phase, gold: s.gold, lives: s.lives, wave: s.wave, kills: s.kills,
    enemies: s.enemies.length, towers: s.towers.length };
}
