// cdp-shot.mjs - capture hero + orbit shots of the curbed planet map.
// Usage: node tools/cdp-shot.mjs <hero|orbit|edge|pathEnd>
import fs from 'fs';
const CDP_PORT = 9222;
const BASE = process.env.OMICRON_URL || 'http://127.0.0.1:8321/';
const mode = process.argv[2] || 'hero';

function connect(wsUrl) {
  return new Promise((res, rej) => {
    const ws = new WebSocket(wsUrl);
    ws.onopen = () => res(ws);
    ws.onerror = (e) => rej(new Error('ws err'));
  });
}
const list = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json();
let page = list.find((p) => p.type === 'page' && p.url.includes('8321')) || list.find((p) => p.type === 'page');
const ws = await connect(page.webSocketDebuggerUrl);
let id = 0; const pend = new Map();
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
};
function send(method, params = {}) {
  return new Promise((res) => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
}
const evalp = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  return r.result?.result?.value;
};
await send('Page.bringToFront');
await send('Runtime.enable');
const shot = async (name) => {
  const { result } = await send('Page.captureScreenshot', { format: 'jpeg', quality: 82 });
  const p = `docs/shots/${name}.jpg`;
  fs.writeFileSync(p, Buffer.from(result.data, 'base64'));
  console.log('SHOT', p);
};

// wait ready
for (let i = 0; i < 40; i++) { const v = await evalp('!!(window.__game && window.__game.sim)'); if (v) break; await new Promise((r) => setTimeout(r, 500)); }

if (mode === 'hero') {
  await evalp(`(() => { const g = window.__game; g.renderFrames(4); })()`);
  await shot('p_hero');
} else if (mode === 'orbit') {
  await evalp(`(() => { const g = window.__game; g.setCam(52, 34, 30, 0, -2, 0); g.renderFrames(4); })()`);
  await shot('p_orbit');
} else if (mode === 'edge') {
  await evalp(`(() => { const g = window.__game; g.setCam(0, 26, 40, 0, -4, 0); g.renderFrames(4); })()`);
  await shot('p_edge');
} else if (mode === 'pathEnd') {
  await evalp(`(() => { const g = window.__game; g.setCam(21, 8, 12, 14, -2, -1); g.renderFrames(4); })()`);
  await shot('p_pathend');
}
await new Promise((r) => setTimeout(r, 400));
ws.close();
process.exit(0);
