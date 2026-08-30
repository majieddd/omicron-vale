// Blender asset bridge: parse embedded GLBs (base64) and swap them onto
// registered procedural groups. Game NEVER depends on the asset being ready:
// procedural mesh renders first, GLB replaces it when parsed. This keeps the
// single-file play.html working from file:// with zero network.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { canvasTexture, paintPlanks, paintThatch, paintStone, mulberry32 } from './00_util.mjs';

// Painterly texture override per material name (keeps GLB geometry, game look).
const TEX_BY_MAT = {
  wood: (r) => paintPlanks(512, 256, r),
  thatch: (r) => paintThatch(512, 256, r),
  stone: (r) => paintStone(256, 256, r),
};

function applyGameTextures(root) {
  root.traverse(o => {
    if (o.isMesh && o.material) {
      const fn = TEX_BY_MAT[o.material.name];
      if (fn) {
        const t = canvasTexture(fn(mulberry32((o.id * 7919 + 17) >>> 0)));
        o.material.map = t;
        o.material.color.set(0xffffff);
        o.material.needsUpdate = true;
      }
      o.material.flatShading = true;
      o.material.roughness = 1;
      o.material.metalness = 0;
    }
  });
}

const pending = [];      // { name, group, onReady }
const ready = {};        // name -> GLTF scene root (cloned per use)
let started = false;

export function makeBlenderAsset(name) {
  const g = new THREE.Group();
  g.name = 'asset:' + name;
  g.userData.assetName = name;
  return g;
}

// Register a group to receive the asset, keeping its transform intact.
export function requestBlenderAsset(name, group, onReady) {
  if (ready[name]) {
    const inst = ready[name].clone(true);
    group.add(inst);
    if (onReady) onReady(inst);
    return true;
  }
  pending.push({ name, group, onReady });
  return false;
}

// Swap-in for UNIT-style assets (towers/enemies): hide every scene child that
// is NOT an animated part (parts record keeps animation code working), then
// attach the Blender body. If no parts are given, hides ALL children.
export function requestUnitBlenderAsset(name, group, parts, onReady) {
  const keep = new Set();
  const collect = (v) => {
    if (v && v.isObject3D) keep.add(v);
    else if (Array.isArray(v)) v.forEach(collect);
    else if (v && typeof v === 'object') Object.values(v).forEach(collect);
  };
  collect(parts);
  const apply = (inst) => {
    const hidden = [];
    group.traverse((o) => {
      if (o === group || o === inst) return;
      if (!(o.isMesh || o.isLine || o.isPoints)) return;
      // keep if any ancestor (incl. self) is an animated part
      for (let a = o; a && a !== group; a = a.parent) {
        if (keep.has(a)) return;
      }
      hidden.push(o);
    });
    for (const h of hidden) h.visible = false;
    group.add(inst);
    if (onReady) onReady(inst);
  };
  if (ready[name]) { const inst = ready[name].clone(true); apply(inst); return true; }
  pending.push({ name, group, onReady: apply });
  return false;
}

// Called once at boot: decode all embedded GLBs.
export function initBlenderAssets() {
  const map = window.__ASSET_GLB || {};
  const names = Object.keys(map);
  if (!names.length) return Promise.resolve(false);
  const loader = new GLTFLoader();
  const jobs = names.map(name => new Promise((resolve) => {
    try {
      const b64 = map[name];
      const bin = atob(b64);
      const buf = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
      loader.parse(buf.buffer, '', (gltf) => {
        const root = gltf.scene || gltf.scenes[0];
        if (!root) { resolve(null); return; }
        applyGameTextures(root);
        root.traverse(o => {
          if (o.isMesh) {
            o.castShadow = true;
            o.receiveShadow = true;
            if (o.material) {
              o.material.flatShading = true;
              o.material.needsUpdate = true;
            }
          }
        });
        ready[name] = root;
        // flush pending groups holding this name
        for (let i = pending.length - 1; i >= 0; i--) {
          const p = pending[i];
          if (p.name === name) {
            const inst = root.clone(true);
            p.group.add(inst);
            if (p.onReady) p.onReady(inst);
            pending.splice(i, 1);
          }
        }
        resolve(root);
      }, (err) => { console.warn('asset parse failed', name, err); resolve(null); });
    } catch (e) { console.warn('asset decode failed', name, e); resolve(null); }
  }));
  return Promise.all(jobs).then(() => true);
}

export function hasBlenderAsset(name) {
  return !!ready[name];
}
