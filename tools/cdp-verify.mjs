// cdp-verify.mjs - live CDP verification for Omicron (Helium on 9222).
// Usage: node tools/cdp-verify.mjs [mode]   mode in boot|towers|enemies|campaign|all
import fs from 'fs';
const CDP_PORT = 9222;
const BASE = process.env.OMICRON_URL || 'http://127.0.0.1:8301/';
const mode = process.argv[2] || 'all';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync('docs/shots', { recursive: true });

const list = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`).then((r) => r.json());
const page = list.find((t) => t.type === 'page') || list[0];
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let id = 0; const pend = new Map();
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); p(m.result); }
};
const send = (method, params = {}) => new Promise((res) => {
  const i = ++id; pend.set(i, res);
  ws.send(JSON.stringify({ id: i, method, params }));
});
const evalp = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true, userGesture: true });
  if (r && r.exceptionDetails) console.log('EVAL-EXC:', JSON.stringify(r.exceptionDetails).slice(0, 200));
  return r && r.result ? r.result.value : undefined;
};
const shot = async (name) => {
  const s = await send('Page.captureScreenshot', { format: 'jpeg', quality: 88 });
  fs.writeFileSync(`docs/shots/${name}.jpg`, Buffer.from(s.data, 'base64'));
  console.log('SHOT', name, ((s.data.length * 0.75) | 0), 'bytes');
};
const render = async (n=2) => {
  await evalp(`window.__game && window.__game.renderFrames && window.__game.renderFrames(${n})`);
  await sleep(120);
};

// ---------- boot ----------
console.log('navigate', BASE);
await send('Page.navigate', { url: BASE });
await sleep(3500);
const boot = await evalp(`JSON.stringify({ready: window.__READY === true, game: !!window.__game,
  errors: window.__ERRORS ? JSON.stringify(window.__ERRORS) : null, title: document.title})`);
console.log('boot:', boot);
if (mode === 'boot') { ws.close(); process.exit(0); }

if (mode === 'all' || mode === 'towers') {
  // ---------- towers closeups ----------
  await evalp(`window.__game.setGold(99999); window.__game.setCam ? null : null;`);
  const placed = await evalp(`(() => {
    const g = window.__game; if (!g) return 'no game';
    g.setGold(99999);
    const kinds = ['willow', 'forge', 'frost', 'storm', 'lumen'];
    const spots = [[1, 3], [4, 2], [7, 2], [10, -1], [13, 4]];
    let out = [];
    for (let i = 0; i < kinds.length; i++) {
      let ok = false;
      for (let r = 0; r < 6 && !ok; r++) {
        const dx = [-1, 1, -1, 1, 0, 2][r], dz = [0, 0, 1, -1, 2, 2][r];
        const res = g.place(kinds[i], spots[i][0] + dx, spots[i][1] + dz);
        ok = res && res.ok === true;
      }
      out.push(kinds[i] + ':' + (ok ? 'ok' : 'fail'));
    }
    return out.join(',');
  })()`);
  console.log('placed:', placed);
  await evalp(`window.__game.renderFrames(3); null`);
  await sleep(300);
  // per-tower hero shots from open side
  const details = await evalp(`(() => {
    const s = window.__game.sim; const out = [];
    for (const t of s.towers) out.push({ k: t.type, x: t.x, z: t.z });
    return JSON.stringify(out);
  })()`);
  console.log('towers:', details);
  const tw = JSON.parse(details);
  for (const t of tw) {
    const cam = { willow: [2, 3.4, 5.2], forge: [4.8, 3.6, 5.4], frost: [7.8, 3.8, 5.6], storm: [10.2, 4.0, 4.0], lumen: [13.6, 3.9, 6.2] }[t.k];
    await evalp(`window.__game.setCam(${cam[0]}, ${cam[1]}, ${cam[2]}, ${t.x}, 1.6, ${t.z}); null`);
    await render(3);
    await shot(`u_${t.k}`);
  }
  // wide hero
  await evalp(`window.__game.setCam(14, 12, 20, 5, 1, 2); null`);
  await render(2);
  await shot('u_wide');
}

if (mode === 'all' || mode === 'enemies') {
  // ---------- enemies: spawn wave 1 & 2 via startWave, wait for them, snap ----------
  if (mode === 'enemies') {
    await evalp(`window.__game.setGold(99999); null`);
    const pl = await evalp(`(function(){ const g=window.__game; g.setGold(99999);
      const kinds=['willow','forge','frost','storm','lumen']; const spots=[[1,3],[4,2],[7,2],[10,-1],[13,4]];
      let n = 0;
      for (let i = 0; i < kinds.length; i++) {
        let ok = false;
        for (let r = 0; r < 6 && !ok; r++) {
          const dx = [-1, 1, -1, 1, 0, 2][r], dz = [0, 0, 1, -1, 2, 2][r];
          const res = g.place(kinds[i], spots[i][0] + dx, spots[i][1] + dz);
          ok = res && res.ok === true;
        }
        n += ok ? 1 : 0;
      }
      return String(n); })()`);
    console.log('placed-enemies-mode:', pl);
  }
  const w1 = await evalp(`(() => { const g = window.__game; return g.startWave() ? 'ok' : 'fail'; })()`);
  console.log('wave1 start:', w1);
  await evalp(`window.__game.step(30); null`);   // spawn + walk a bit
  await sleep(3200);  // let WAVE banner fade
  await evalp(`window.__game.renderFrames(2); null`);
  const en = await evalp(`(() => { const s = window.__game.sim;
    return JSON.stringify(s.enemies.map(e => ({ k: e.kind, x: +e.x.toFixed(1), z: +e.z.toFixed(1) })));
  })()`);
  console.log('enemies w1:', en);
  await evalp(`window.__game.setCam(8, 7, 9, 3, 1, 0); null`);
  await render(2);
  await shot('u_enemies1');
  // zoom each enemy type (wave1 kinds)
  const kinds1 = [...new Set(JSON.parse(en).map(e => e.k))];
  for (const k of kinds1) {
    await evalp(`(() => { const g = window.__game; const s = g.sim; const e = s.enemies.find(e => e.kind === '${k}');
      if (!e) return; g.setCam(e.x + 4.2, 2.6, e.z + 4.2, e.x, 1.2, e.z); })()`);
    await render(3);
    await shot(`u_${k}`);
  }
  // ---------- wave 2 & 3 kinds ----------
  await evalp(`(function(){ const g = window.__game;
    for (let i = 0; i < 3600 && g.sim.phase === 'combat'; i++) g.step(1);
    return g.sim.phase; })()`);
  await evalp(`window.__game.startWave()`);
  await evalp(`window.__game.step(40); null`);
  await sleep(3200);
  const en2 = await evalp(`(() => { const s = window.__game.sim;
    return JSON.stringify(s.enemies.map(e => ({ k: e.kind, x: +e.x.toFixed(1), z: +e.z.toFixed(1) })));
  })()`);
  console.log('enemies w2:', en2);
  await evalp(`window.__game.setCam(8, 8, 10, -6, 1, 3); null`);
  await render(2);
  await shot('u_enemies2');
  for (const k of [...new Set(JSON.parse(en2 || '[]').map(e => e.k))]) {
    await evalp(`(() => { const g = window.__game; const e = g.sim.enemies.find(e => e.kind === '${k}');
      if (!e) return; g.setCam(e.x + 4.2, 2.6, e.z + 4.2, e.x, 1.2, e.z); })()`);
    await render(3);
    await shot('u_' + k);
  }
  // wave 3 (boss)
  await evalp(`(function(){ const g = window.__game;
    for (let i = 0; i < 4200 && g.sim.phase === 'combat'; i++) g.step(1);
    return g.sim.phase; })()`);
  await evalp(`window.__game.startWave()`);
  await evalp(`window.__game.step(30); null`);
  await sleep(3200);
  const en3 = await evalp(`(() => { const s = window.__game.sim;
    return JSON.stringify(s.enemies.map(e => ({ k: e.kind, x: +e.x.toFixed(1), z: +e.z.toFixed(1) })));
  })()`);
  console.log('enemies w3:', en3);
  for (const k of [...new Set(JSON.parse(en3 || '[]').map(e => e.k))]) {
    await evalp(`(() => { const g = window.__game; const e = g.sim.enemies.find(e => e.kind === '${k}');
      if (!e) return;
      if (e.kind === 'boss') g.setCam(e.x + 11, 8.5, e.z + 11, e.x, 2.6, e.z);
      else g.setCam(e.x + 4.6, 3.2, e.z + 4.6, e.x, 1.1, e.z); })()`);
    await render(3);
    await shot('u_' + k);
  }
}

if (mode === 'all' || mode === 'campaign') {
  // ---------- full campaign ----------
  if (!(mode === 'campaign')) {
    // already in all-mode with towers+enemies1; continue from here
  }
  // build 8 towers + upgrade a few before waves
  await evalp(`(function(){ const g = window.__game;
    g.setGold(99999);
    const build = [ ['forge', -3, 0], ['forge', 2, 0], ['willow', -5, 2], ['storm', 5, 2],
                    ['frost', 7, 0], ['lumen', 1, 5], ['willow', 9, -3], ['storm', -7, 0] ];
    let n = 0;
    for (const [k, x, z] of build) {
      const res = g.place(k, x, z);
      if (res && res.ok) { n++; if (res.id !== undefined) { g.upgrade(res.id); } }
    }
    g.upgrade(0);
    return n; })()`);
  // wave 1
  await evalp(`window.__game.startWave()`);
  await evalp(`(function(){ const g = window.__game;
     for (let i = 0; i < 2600 && g.sim.phase === 'combat'; i++) g.step(1); return g.sim.phase; })()`);
  console.log('phase after w1:', await evalp('window.__game.sim.phase'));
  // wave 2
  await evalp(`window.__game.startWave()`);
  console.log('w2:', await evalp('window.__game.sim.wave'));
  await evalp(`(function(){ const g = window.__game;
     for (let i = 0; i < 4000 && g.sim.phase === 'combat'; i++) g.step(1); return g.sim.phase; })()`);
  console.log('phase after w2:', await evalp('window.__game.sim.phase'));
  // wave 3 (boss)
  await evalp(`window.__game.startWave()`);
  console.log('w3:', await evalp('window.__game.sim.wave'));
  // snap boss on the way
  await evalp(`window.__game.step(120); null`);
  const boss = await evalp(`(() => { const s = window.__game.sim;
    const e = s.enemies.find(e => e.kind === 'boss');
    return e ? JSON.stringify({ x: e.x.toFixed(1), z: e.z.toFixed(1) }) : null; })()`);
  if (boss) {
    const b = JSON.parse(boss);
    await evalp(`window.__game.setCam(${Number(b.x) + 5}, 4.5, ${Number(b.z) + 5}, ${b.x}, 2.2, ${b.z}); null`);
    await render(3);
    await shot('u_boss');
  }
  await evalp(`(function(){ const g = window.__game;
     for (let i = 0; i < 9000 && g.sim.phase === 'combat'; i++) g.step(1); return g.sim.phase; })()`);
  const fin = await evalp(`JSON.stringify({ phase: window.__game.sim.phase, lives: window.__game.sim.lives,
    enemies: window.__game.sim.enemies.length, gold: window.__game.sim.gold })`);
  console.log('final:', fin);
}
console.log('errors:', await evalp(`window.__ERRORS ? JSON.stringify(window.__ERRORS) : '[]'`));
ws.close();
