// Units: articulated enemies and towers with procedural animation.
import * as THREE from 'three';
import { clamp, lerp, PAL } from './00_util.mjs';
import { TOWERS, ENEMIES } from './02_sim.mjs';
import { requestUnitBlenderAsset, requestUnitGeometries } from './09_assets.mjs';

const DEG = Math.PI / 180;

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.85, metalness: 0, flatShading: true }, opts));
}
function limb(geo, m, x, y, z) {
  const me = new THREE.Mesh(geo, m);
  me.position.set(x, y, z);
  me.castShadow = true;
  return me;
}

// ---------- ENEMY FACTORY ----------
// Each returns { group, parts, kind } where parts carries handles for anim.
// Readability scales applied per kind at spawn (TD camera distance).
const ENEMY_SCALE = { wisp: 1.75, beetle: 1.6, ember: 1.75, stalker: 1.55, grunt: 1.55, boss: 1.15 };

// Billboard HP bar (bg + fill), added as children of each enemy group.
const hpBgGeo = new THREE.PlaneGeometry(1.0, 0.14);
const hpBgMat = new THREE.MeshBasicMaterial({ color: 0x2e2a20, transparent: true, opacity: 0.75, depthWrite: false });
hpBgMat.userData.__shared = true; // shared across all enemies; never disposed
const hpFgMat = new THREE.MeshBasicMaterial({ color: 0x9fe8a0, transparent: true, opacity: 0.95, depthWrite: false });
function makeHpBar(width) {
  const g = new THREE.Group();
  const bg = new THREE.Mesh(hpBgGeo, hpBgMat);
  const fg = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 0.09), hpFgMat.clone());
  fg.material.userData.__shared = false; // per-bar clone IS disposable
  fg.position.z = 0.001;
  g.add(bg, fg);
  g.scale.setScalar(width);
  return g;
}
export function updateHpBar(bar, frac) {
  const fg = bar.children[1];
  fg.scale.x = Math.max(0.0001, frac);
  fg.position.x = -(1 - Math.max(0, frac)) * 0.48;
  fg.material.color.setHex(frac > 0.5 ? 0x9fe8a0 : frac > 0.22 ? 0xffd98a : 0xe08a7a);
}

export function makeEnemy(kind) {
  const def = ENEMIES[kind];
  const g = new THREE.Group();
  g.name = 'enemy-' + kind;
  g.userData.tint = new THREE.Color(def.color);
  const P = { group: g, kind, parts: {} };
  if (kind === 'wisp') {
    // floating spirit: teardrop body, two fluttering wing-fans, glowing core
    const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 1), mat(0xaacc60, { emissive: 0x7aa028, emissiveIntensity: 0.7 }));
    body.scale.set(0.8, 1.15, 0.8);
    body.position.y = 0.75; body.name = "body";
    body.castShadow = true;
    g.add(body);
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), new THREE.MeshBasicMaterial({ color: 0xf5ffd0 }));
    core.position.y = 0.85;
    g.add(core);
    const wingMat = mat(0xd2e89a, { side: THREE.DoubleSide, transparent: true, opacity: 0.9 });
    const wl = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.8, 4), wingMat); wl.name = "wl";
    wl.position.set(-0.34, 0.85, 0); wl.rotation.z = 1.05;
    const wr = wl.clone(); wr.position.x = 0.34; wr.rotation.z = -1.05; wr.name = "wr";
    g.add(wl, wr);
    P.parts.wl = wl; P.parts.wr = wr; P.parts.body = body; P.parts.core = core;
    // tiny trailing dewdrops
    P.parts.drop = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4), mat(0xbcd46e));
    P.parts.drop.position.y = 0.3; g.add(P.parts.drop);
  } else if (kind === 'beetle') {
    // armored crawler: shell dome, head, mandibles, six scuttling legs
    const shellM = mat(0x5f7f4a);
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), shellM);
    shell.scale.set(1, 0.62, 1.25);
    shell.position.y = 0.42; shell.name = "shell";
    shell.castShadow = true;
    g.add(shell);
    // crown plates
    for (let i = 0; i < 3; i++) {
      const p = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.3, 4), mat(0x4c6a3c));
      p.name = "crown" + i;
      p.position.set(0, 0.72 - i * 0.06, -0.15 + i * 0.34);
      p.rotation.x = -0.5;
      g.add(p);
    }
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 6, 5), mat(0x49663a));
    head.position.set(0, 0.34, 0.62); head.castShadow = true; head.name = "head";
    g.add(head);
    const eyeM = new THREE.MeshBasicMaterial({ color: 0xf0ef9a });
    for (const s of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), eyeM);
      e.position.set(s * 0.11, 0.42, 0.78); g.add(e);
    }
    P.parts.head = head;
    const legM = mat(0x3d5533);
    P.parts.legs = [];
    for (let i = 0; i < 3; i++) {
      for (const s of [-1, 1]) {
        const hip = new THREE.Group();
        hip.position.set(s * 0.42, 0.4, -0.3 + i * 0.32);
        const up = limb(new THREE.CylinderGeometry(0.05, 0.05, 0.42, 5), legM, 0, -0.18, 0);
        up.name = "legUp" + i + (s > 0 ? "R" : "L");
        up.rotation.z = s * 0.9;
        const low = limb(new THREE.CylinderGeometry(0.04, 0.03, 0.4, 5), legM, 0, -0.52, 0);
        low.name = "legLow" + i + (s > 0 ? "R" : "L");
        low.rotation.z = -s * 0.5;
        hip.add(up, low);
        g.add(hip);
        P.parts.legs.push({ hip, up, low, side: s, idx: i });
      }
    }
  } else if (kind === 'ember') {
    // hopping cinder imp: charcoal body, flame plume, short legs, ember hands
    const bodyM = mat(0x3d3430, { emissive: 0x9a4a18, emissiveIntensity: 0.5 });
    const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.34, 1), bodyM);
    body.position.y = 0.55; body.scale.set(0.85, 1.1, 0.8); body.name = "body";
    body.castShadow = true;
    g.add(body);
    const plume = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.55, 5), new THREE.MeshBasicMaterial({ color: 0xf2a24b }));
    plume.position.y = 1.05; plume.rotation.z = 0.12; plume.name = "plume";
    g.add(plume);
    P.parts.plume = plume; P.parts.body = body;
    const legM = mat(0x2b2422);
    P.parts.legs = [];
    for (const s of [-1, 1]) {
      const hip = new THREE.Group();
      hip.position.set(s * 0.14, 0.35, 0);
      const l = limb(new THREE.CylinderGeometry(0.06, 0.05, 0.34, 4), legM, 0, -0.17, 0.08);
      hip.add(l); g.add(hip);
      P.parts.legs.push({ hip, side: s });
    }
    const eyeM = new THREE.MeshBasicMaterial({ color: 0xffd27a });
    for (const s of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), eyeM);
      e.position.set(s * 0.11, 0.62, 0.22); g.add(e);
    }
  } else if (kind === 'stalker') {
    // briar wisp-walker: tall grass-blade body, curling thorn arms, hood head
    const bodyM = mat(0x9aa871);
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.5, 6), bodyM);
    body.position.y = 0.95; body.castShadow = true; body.name = "body";
    g.add(body);
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.3, 6, 5), mat(0x7f8f58));
    hood.position.y = 1.6; hood.scale.set(1, 0.8, 1); hood.name = "hood";
    g.add(hood);
    const eyeM = new THREE.MeshBasicMaterial({ color: 0x3c4a2a });
    for (const s of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), eyeM);
      e.position.set(s * 0.1, 1.62, 0.24); g.add(e);
    }
    P.parts.body = body; P.parts.hood = hood;
    const armM = mat(0x86935f);
    P.parts.arms = [];
    for (const s of [-1, 1]) {
      const arm = new THREE.Group();
      arm.position.set(s * 0.34, 1.25, 0);
      const a = limb(new THREE.CylinderGeometry(0.05, 0.035, 0.7, 5), armM, 0, -0.3, 0);
      a.name = "armA" + (s > 0 ? "R" : "L");
      a.rotation.z = s * 0.65;
      const hand = limb(new THREE.ConeGeometry(0.12, 0.3, 4), mat(0x5d6b3d), 0, -0.72, 0);
      hand.name = "armH" + (s > 0 ? "R" : "L");
      hand.rotation.z = Math.PI + s * 0.2;
      arm.add(a, hand);
      g.add(arm);
      P.parts.arms.push({ arm, side: s });
    }
  } else if (kind === 'grunt') {
    // waddling mossback: low body, mossy dome, tusks, stub arms, tail
    const bodyM = mat(0x6e7a55);
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.6, 0.75), bodyM);
    body.position.y = 0.5; body.castShadow = true; body.name = "body";
    g.add(body);
    const dome = new THREE.Mesh(new THREE.IcosahedronGeometry(0.52, 1), mat(0x59653f));
    dome.position.y = 0.75; dome.scale.set(1.15, 0.72, 0.95); dome.name = "dome";
    dome.castShadow = true;
    g.add(dome);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.35, 0.3), mat(0x818e60));
    head.name = "head";
    head.position.set(0, 0.52, 0.5); g.add(head);
    const tuskM = mat(0xcfc9b4);
    for (const s of [-1, 1]) {
      const t = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.22, 4), tuskM);
      t.name = "tusk" + (s > 0 ? "R" : "L");
      t.position.set(s * 0.12, 0.58, 0.66);
      t.rotation.x = 1.9;
      g.add(t);
    }
    const eyeM = new THREE.MeshBasicMaterial({ color: 0x2f3325 });
    for (const s of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 4), eyeM);
      e.position.set(s * 0.13, 0.62, 0.63); g.add(e);
    }
    P.parts.body = body; P.parts.head = head; P.parts.dome = dome;
    const legM = mat(0x4c5638);
    const legs = [];
    for (const s of [-1, 1]) {
      for (const f of [-1, 1]) {
        const hip = new THREE.Group();
        hip.position.set(s * 0.42, 0.34, f * 0.3);
        const l = limb(new THREE.CylinderGeometry(0.09, 0.07, 0.36, 5), legM, 0, -0.16, 0);
        l.name = "leg" + (s > 0 ? "R" : "L") + (f > 0 ? "F" : "B");
        hip.add(l); g.add(hip);
        legs.push({ hip, side: s, front: f });
      }
    }
    P.parts.legs = legs;
  } else if (kind === 'boss') {
    // Stonehorn Sentinel: massive two-legged stone golem, horn crown, glowing rift core
    const rockM = mat(0x8b917f, { roughness: 0.95 });
    const darkM = mat(0x6f7565, { roughness: 0.95 });
    const legs = [];
    const pelvis = limb(new THREE.BoxGeometry(1.7, 0.9, 1.2), darkM, 0, 1.5, 0);
    pelvis.name = "pelvis";
    g.add(pelvis);
    for (const s of [-1, 1]) {
      const hip = new THREE.Group();
      hip.position.set(s * 0.62, 1.35, 0);
      const thigh = limb(new THREE.BoxGeometry(0.55, 1.3, 0.75), rockM, 0, -0.65, 0);
      thigh.name = "thigh" + (s > 0 ? "R" : "L");
      const shin = limb(new THREE.CylinderGeometry(0.34, 0.46, 1.2, 5), darkM, 0, -1.85, 0);
      shin.name = "shin" + (s > 0 ? "R" : "L");
      const foot = limb(new THREE.BoxGeometry(0.75, 0.5, 1.15), rockM, 0, -2.5, 0.28);
      foot.name = "foot" + (s > 0 ? "R" : "L");
      hip.add(thigh, shin, foot);
      g.add(hip);
      legs.push({ hip, s });
    }
    const torso = limb(new THREE.BoxGeometry(2.3, 1.7, 1.4), rockM, 0, 2.85, -0.1);
    torso.name = "torso";
    torso.rotation.x = -0.06;
    g.add(torso);
    const chestPlate = limb(new THREE.BoxGeometry(1.9, 0.7, 0.35), darkM, 0, 3.2, 0.6);
    chestPlate.name = "plate";
    g.add(chestPlate);
    // glowing rift core
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.34, 1), new THREE.MeshBasicMaterial({ color: 0xb7e8c9 }));
    core.position.set(0, 2.75, 0.62);
    g.add(core);
    P.parts.core = core;
    // horn crown
    for (let i = 0; i < 5; i++) {
      const h = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.9 - Math.abs(i - 2) * 0.18, 4), darkM);
      h.name = "horn" + i;
      h.position.set((i - 2) * 0.42, 3.95, -0.2);
      h.rotation.z = (i - 2) * 0.22;
      g.add(h);
    }
    const head = limb(new THREE.BoxGeometry(1.0, 0.7, 0.8), rockM, 0, 3.75, 0.35);
    head.name = "head";
    g.add(head);
    const eyeM = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
    for (const s of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 4), eyeM);
      e.position.set(s * 0.26, 3.85, 0.78); g.add(e);
    }
    // tree-trunk arms
    const arms = [];
    for (const s of [-1, 1]) {
      const arm = new THREE.Group();
      arm.position.set(s * 1.35, 2.9, 0);
      const sh = limb(new THREE.BoxGeometry(0.62, 1.5, 0.8), rockM, 0, -0.65, 0);
      sh.name = "sh" + (s > 0 ? "R" : "L");
      const fist = limb(new THREE.IcosahedronGeometry(0.55, 1), darkM, 0, -1.6, 0.15);
      fist.name = "fist" + (s > 0 ? "R" : "L");
      arm.add(sh, fist);
      g.add(arm);
      arms.push({ arm, s });
    }
    P.parts.legs = legs;
    P.parts.arms = arms;
    P.parts.torso = torso;
  }
  P.group.scale.setScalar(ENEMY_SCALE[kind] || 1.6);
  // hp bar floats above the creature (billboard-ish; small enough to read from TD cam)
  const hb = makeHpBar(kind === 'boss' ? 1.6 : 1.0);
  hb.position.y = (kind === 'boss' ? 4.6 : (kind === 'grunt' || kind === 'beetle' ? 1.5 : 2.0));
  hb.visible = false; // shown when damaged
  g.add(hb);
  P.parts.hpBar = hb;
  requestUnitGeometries('enemy-' + kind, g);
  return P;
}

// ------------------------------------------------------------------
// ENEMY ANIMATION: driven purely by sim fields (d, anim, slow, flash, dead)
// ------------------------------------------------------------------
export function animateEnemy(P, e, t) {
  const g = P.group;
  const walkPh = e.d * 2.2 + e.anim * 4;
  const p = P.parts;
  // reset transforms each frame (positions are set by sync)
  // ground bob
  const bob = clamp(Math.abs(Math.sin(walkPh * 1.1)) * (e.slowT ? 0.035 : 0.07), 0, 0.09);
  g.position.y = bob;

  if (P.kind === 'wisp') {
    g.position.y = 0.28 + Math.sin(t * 2.1 + e.anim * 7) * 0.14;
    const flap = Math.sin(t * 14 + e.anim * 3) * 0.55;
    p.wl.rotation.z = 1.05 + flap;
    p.wr.rotation.z = -1.05 - flap;
    p.body.rotation.y = t * 1.4;
    p.core.scale.setScalar(1 + Math.sin(t * 5 + e.anim) * 0.25);
    p.drop.position.y = 0.3 + Math.sin(t * 3 + e.anim) * 0.1;
    const s = Math.sin(t * 2.6 + e.anim * 5);
    p.wl.scale.set(1 + s * 0.1, 1 - s * 0.05, 1);
    p.wr.scale.set(1 - s * 0.1, 1 + s * 0.05, 1);
  } else if (P.kind === 'beetle') {
    // scuttle legs in tripod gait
    for (const L of p.legs) {
      const ph = walkPh + L.idx * 2.1 + (L.side > 0 ? 0 : Math.PI);
      const sw = Math.sin(ph) * 0.55;
      L.hip.rotation.x = sw;
      L.hip.rotation.y = Math.sin(ph * 0.5) * 0.2;
      L.up.rotation.z = L.side * (0.9 + Math.cos(ph) * 0.25);
      L.low.rotation.z = -L.side * (0.5 + Math.sin(ph) * 0.3);
    }
    p.head.rotation.y = Math.sin(t * 0.8 + e.anim) * 0.24;
    // shell squash while walking
    const sq = Math.sin(walkPh * 2) * 0.04;
    p.legs.length && 0;
  } else if (P.kind === 'ember') {
    // hopping: legs compress, body arcs
    const hop = Math.abs(Math.sin(walkPh * 0.9));
    g.position.y = hop * 0.55;
    for (const L of p.legs) L.hip.rotation.x = -hop * 1.1;
    p.body.scale.set(0.85 + hop * 0.12, 1.1 - hop * 0.22, 0.8 + hop * 0.12);
    p.plume.rotation.z = Math.sin(t * 9 + e.anim * 2) * 0.16 + 0.12;
    p.plume.scale.y = 1 + Math.sin(t * 11) * 0.18;
  } else if (P.kind === 'stalker') {
    // gliding sway, weaving arms (sway on body/head parts so group facing survives)
    p.body.rotation.z = Math.sin(walkPh * 0.55) * 0.12;
    p.body.rotation.y = Math.sin(t * 1.7 + e.anim * 3) * 0.08;
    for (const A of p.arms) {
      A.arm.rotation.x = Math.sin(walkPh + A.side) * 0.5;
      A.arm.rotation.z = A.side * 0.65 + Math.sin(t * 2.2 + A.side) * 0.1;
    }
    p.hood.rotation.y = Math.sin(t * 0.6) * 0.2;
  } else if (P.kind === 'grunt') {
    // four-leg waddle: diagonal pairs
    for (const L of p.legs) {
      const ph = walkPh + (L.front > 0 ? 0 : Math.PI);
      L.hip.rotation.x = Math.sin(ph + (L.side > 0 ? Math.PI : 0)) * 0.6;
    }
    p.body.rotation.z = Math.sin(walkPh * 0.5) * 0.07;
    p.head.rotation.y = Math.sin(t * 1.1) * 0.3;
    p.dome.scale.x = 1.15 + Math.sin(walkPh * 2) * 0.03;
  } else if (P.kind === 'boss') {
    // heavy stomp: alternating leg lifts, torso sway, arm swings, ground pulse
    const stomp = Math.pow(Math.abs(Math.sin(walkPh * 0.5)), 6);
    for (const L of p.legs) {
      const ph = walkPh * 0.5 + (L.s > 0 ? 0 : Math.PI);
      const hitch = Math.max(0, Math.sin(ph));
      L.hip.rotation.x = -hitch * 0.55;
      L.hip.position.y = 1.35 - hitch * 0.3;
    }
    // dip stored for syncEnemies (which owns absolute group Y for grounding)
    g.userData.__dip = -stomp * 0.12;
    g.rotation.z = Math.sin(walkPh * 0.5) * 0.05;
    p.torso.rotation.y = Math.sin(walkPh * 0.5) * 0.14;
    for (const A of p.arms) {
      A.arm.rotation.x = Math.sin(walkPh * 0.5 + A.s * 1.2) * 0.18 - 0.1;
    }
    const beat = 1 + Math.sin(t * 2.4) * 0.3;
    p.core.scale.setScalar(beat);
  }
  // flash tint on hit (sim sets flash>0); restore base emissive when it ends
  if (e.flash > 0) {
    const f = e.flash / 0.12;
    g.traverse(o => {
      if (o.material && o.material.emissive) {
        if (!o.userData.__baseEm) {
          o.userData.__baseEm = { r: o.material.emissive.r, g: o.material.emissive.g, b: o.material.emissive.b };
        }
        // blend grey flash ON TOP of base glow instead of replacing it
        o.material.emissive.setRGB(
          o.userData.__baseEm.r + (0.6 * f),
          o.userData.__baseEm.g + (0.6 * f),
          o.userData.__baseEm.b + (0.6 * f)
        );
      }
    });
  } else {
    g.traverse(o => {
      if (o.material && o.material.emissive && o.userData.__baseEm) {
        o.material.emissive.setRGB(o.userData.__baseEm.r, o.userData.__baseEm.g, o.userData.__baseEm.b);
      }
    });
  }
}

// ------------------------------------------------------------------
// TOWER FACTORY
// ------------------------------------------------------------------
export function makeTower(typeKey) {
  const def = TOWERS[typeKey];
  const g = new THREE.Group();
  g.name = 'tower-' + typeKey;
  const P = { group: g, type: typeKey, parts: {} };
  // stone base all towers share
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1.05, 0.35, 7), mat(0xb6b2a2));
  base.position.y = 0.17;
  base.castShadow = true; base.receiveShadow = true;
  g.add(base);

  if (typeKey === 'willow') {
    // wooden archer tower with a living bowman
    const wood = mat(0x8a6c46);
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.34, 1.7, 6), wood);
    pillar.position.y = 1.2; pillar.castShadow = true;
    g.add(pillar);
    const platform = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.6, 0.16, 7), wood);
    platform.position.y = 2.1; platform.castShadow = true;
    g.add(platform);
    const bowM = mat(0x6b4f2e);
    const bow = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.05, 5, 12, Math.PI * 1.2), bowM);
    bow.rotation.z = Math.PI * 0.9;
    bow.name = "bow";
    bow.position.y = 2.62;
    g.add(bow);
    P.parts.bow = bow;
    const strMat = new THREE.LineBasicMaterial({ color: 0xe8e0c0 });
    const string = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0), new THREE.Vector3(0.6,0,0)]), strMat);
    P.parts.string = string;
    string.name = "string";
    string.position.y = 2.62; string.position.x = -0.38;
    g.add(string);
    // leaves sprouting
    const leafM = mat(0x9fce6a);
    for (let i = 0; i < 5; i++) {
      const l = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.34, 4), leafM);
      l.position.set(Math.cos(i * 1.3) * 0.5, 2.5 + Math.sin(i * 1.3) * 0.28, Math.sin(i * 1.3) * 0.5);
      l.rotation.z = Math.PI * 0.5;
      l.castShadow = true;
      g.add(l);
    }
    P.parts.leafMats = leafM;
  } else if (typeKey === 'forge') {
    // kiln: stacked stones, iron rim, glowing billows, muzzle
    const kiln = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.72, 1.3, 7), mat(0x8f8a7a));
    kiln.position.y = 1.0; kiln.castShadow = true;
    g.add(kiln);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.09, 6, 10), mat(0x4a4640, { metalness: 0.5, roughness: 0.5 }));
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 1.68;
    g.add(rim);
    const mouth = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.5, 6), mat(0x2f2b26));
    mouth.rotation.x = Math.PI / 2 + 0.5;
    mouth.name = "mouth";
    mouth.position.set(0, 1.5, 0.35);
    g.add(mouth);
    const fireGlow = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff9b3e }));
    fireGlow.position.set(0, 0.62, 0.18);
    g.add(fireGlow);
    P.parts.glow = fireGlow;
    P.parts.mouth = mouth;
    const drumM = mat(0x6e5138);
    const drum = new THREE.Group();
    const d1 = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.18, 8), drumM);
    d1.name = "drumD1";
    const d2 = d1.clone(); d2.name = "drumD2"; d2.position.y = 0.28; d2.scale.setScalar(0.8);
    drum.add(d1, d2);
    drum.position.y = 2.0;
    drum.castShadow = true;
    g.add(drum);
    // bellows levers
    const bellM = mat(0x5a4a34);
    P.parts.bellows = [];
    for (const s of [-1, 1]) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.5, 0.3), bellM);
      b.name = "bellows" + (s > 0 ? "R" : "L");
      b.position.set(s * 0.5, 1.1, -0.2);
      b.rotation.z = s * 0.3;
      g.add(b);
      P.parts.bellows.push(b);
    }
    P.parts.drum = drum;
  } else if (typeKey === 'frost') {
    // totem of chimes: stone crosier, ice petals orbiting, drip tip
    const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 1.9, 6), mat(0x9aa0a8));
    staff.position.y = 1.3; staff.castShadow = true;
    g.add(staff);
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(0.34, 1), mat(0x9fd8e8, { emissive: 0x4a9ab5, emissiveIntensity: 0.7 }));
    crown.name = "crown";
    crown.position.y = 2.35;
    g.add(crown);
    P.parts.crown = crown;
    P.parts.petals = [];
    const petalM = mat(0xbfeaf5, { side: THREE.DoubleSide });
    for (let i = 0; i < 6; i++) {
      const pivot = new THREE.Group();
      const petal = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.7, 4), petalM);
      petal.name = "petal";
      petal.rotation.z = -Math.PI / 2;
      petal.position.y = 0.3;
      pivot.add(petal);
      pivot.position.y = 2.35;
      pivot.rotation.y = (i / 6) * Math.PI * 2;
      g.add(pivot);
      P.parts.petals.push(pivot);
    }
    const drip = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 4), mat(0x9fd8e8, { emissive: 0x4a9ab5, emissiveIntensity: 0.5 }));
    drip.name = "drip";
    drip.position.set(0, 0.4, 0);
    g.add(drip);
    P.parts.drip = drip;
  } else if (typeKey === 'storm') {
    // hollow drum on tripod, sparking ring, mace-handed drummer
    const wood = mat(0x76604a);
    const tripod = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.6, 5), wood);
      leg.position.set(Math.cos(a) * 0.42, 0.72, Math.sin(a) * 0.42);
      leg.rotation.z = Math.cos(a) * 0.3;
      leg.rotation.x = -Math.sin(a) * 0.3;
      tripod.add(leg);
    }
    const skinTop = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.1, 9), mat(0xd8cbb0));
    skinTop.name = "skin";
    skinTop.position.y = 1.52;
    tripod.add(skinTop);
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.66, 0.5, 9), mat(0x68523c));
    drum.name = "drum";
    drum.position.y = 1.28;
    tripod.add(drum);
    g.add(tripod);
    P.parts.drum = drum; P.parts.skin = skinTop;
    // spark ring
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.65, 0.035, 5, 14), new THREE.MeshBasicMaterial({ color: 0xb4a3f0 }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 2.0;
    g.add(ring);
    P.parts.ring = ring;
    // drummer mace
    const arm = new THREE.Group();
    const a1 = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.7, 5), wood);
    const mace = new THREE.Mesh(new THREE.SphereGeometry(0.13, 6, 5), mat(0x3f3b35));
    a1.name = "armHandle"; mace.name = "mace";
    a1.position.y = 0.35; mace.position.y = 0.75;
    arm.add(a1, mace);
    arm.position.x = 0.55;
    arm.position.y = 1.0;
    g.add(arm);
    P.parts.arm = arm;
  } else if (typeKey === 'lumen') {
    // hearth lantern: mossy pillar, gilded cage, radiant orb, drip embers
    const stoneM = mat(0xa8a190);
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.44, 1.7, 7), stoneM);
    pillar.position.y = 1.2; pillar.castShadow = true;
    g.add(pillar);
    const moss = new THREE.Mesh(new THREE.SphereGeometry(0.4, 7, 5), mat(0x7f9454));
    moss.position.set(0.22, 1.75, 0.1); moss.scale.set(1.1, 0.55, 1);
    g.add(moss);
    // cage
    const cageM = mat(0x57422a);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.7, 4), cageM);
      bar.position.set(Math.cos(a) * 0.26, 2.35, Math.sin(a) * 0.26);
      bar.rotation.z = Math.cos(a) * 0.12;
      bar.rotation.x = -Math.sin(a) * 0.12;
      g.add(bar);
    }
    const cageTop = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.3, 6), cageM);
    cageTop.name = "cageTop";
    cageTop.position.y = 2.75;
    g.add(cageTop);
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffd98a }));
    orb.name = "orb";
    orb.position.y = 2.38;
    g.add(orb);
    P.parts.orb = orb;
    P.parts.cageTop = cageTop;
    const capMat = new THREE.MeshBasicMaterial({ color: 0xffe9bb });
    P.parts.orbLight = new THREE.PointLight(0xffc96a, 1.1, 9, 2);
    P.parts.orbLight.position.y = 2.4;
    g.add(P.parts.orbLight);
    P.parts.cap = capMat;
  }
  // Blender watertight body: replaces static meshes when parsed; animated
  // P.parts (bow/drum/petals/orb/...) stay procedural and keep animating.
  requestUnitBlenderAsset('tower-' + typeKey, g, P.parts);
  requestUnitGeometries('tower-' + typeKey + '-parts', g);
  return P;
}

// ------------------------------------------------------------------
// TOWER ANIMATION: aim, fire kick, idle life
// ------------------------------------------------------------------
export function animateTower(P, tW, t, dt) {
  const p = P.parts;
  const aimYaw = tW.aim !== undefined ? tW.aim : 0;
  P.group.rotation.y = aimYaw;
  const fireK = clamp((tW.anim || 0) / 0.25, 0, 1); // anim ramps down from fire
  const idle = Math.sin(t * 1.1 + tW.id * 1.7) * 0.03;
  if (P.type === 'willow') {
    // bow draw: rotate open when firing, ease back
    const draw = fireK;
    p.bow.rotation.z = Math.PI * 0.9 + draw * 0.5;
    p.string.scale.x = 1 - draw * 0.8;
    p.bow.position.y = 2.62 + idle * 0.4;
    P.group.children[1].rotation.y = 0;
  } else if (P.type === 'forge') {
    // muzzle recoil + drum arc + billows squeeze
    p.drum.rotation.z = Math.PI * 0.8 + fireK * 0.9;
    p.drum.position.y = 2.0 - fireK * 0.35;
    for (const b of p.bellows) b.rotation.z = (b.position.x > 0 ? 0.3 : -0.3) - fireK * (b.position.x > 0 ? 0.25 : -0.25);
    p.glow.scale.setScalar(1 + Math.sin(t * 6.5) * 0.25 + fireK * 0.6);
    p.mouth.position.z = 0.35 + fireK * 0.12;
  } else if (P.type === 'frost') {
    // petals orbit and whip on cast; crown pulses
    const cast = fireK;
    for (let i = 0; i < p.petals.length; i++) {
      p.petals[i].rotation.y += dt * (2.4 + cast * 9);
      p.petals[i].rotation.x = Math.sin(t * 2 + i) * 0.12 + cast * 0.5;
    }
    p.crown.scale.setScalar(1 + Math.sin(t * 3 + cast * 6) * 0.12 + cast * 0.3);
    p.drip.position.y = 0.4 + Math.sin(t * 1.6) * 0.06;
  } else if (P.type === 'storm') {
    // drum beater swings on cast; ring flickers
    p.arm.rotation.x = -fireK * 1.6 + Math.sin(t * 4) * 0.06;
    p.ring.scale.setScalar(1 + fireK * 0.4 + Math.sin(t * 7) * 0.05);
    p.skin.rotation.y = t * 0.7;
  } else if (P.type === 'lumen') {
    // orb breathes, flares on cast; ember flicker
    p.orb.scale.setScalar(1 + Math.sin(t * 2.2) * 0.12 + fireK * 0.5);
    p.orbLight.intensity = 1.0 + Math.sin(t * 2.2) * 0.35 + fireK * 2.2;
    p.cageTop.rotation.y = t * 0.3;
  }
}
