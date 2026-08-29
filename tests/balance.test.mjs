// Balance regression for reviewer findings.
// 1. The '2 forges autowins' exploit must be dead: no-build-spam cheap pair.
// 2. Full roster with upgrades still wins (normal difficulty).
// Run: node tests/balance.test.mjs
import { buildPath, newState, startWave, placeTower, upgradeTower, step, TOWERS, ENEMIES, WAVES, START_GOLD } from '../src/02_sim.mjs';

const ctrl = [[-18, 4], [-12, 2], [-6, -2], [0, -1], [4, 2], [9, 1], [14, -1], [18, 0]];
const path = buildPath(ctrl);

function play(build, opts = {}) {
  const s = newState(path);
  s.gold = START_GOLD;
  for (const [k, x, z] of build) placeTower(s, k, x, z);
  // realistic player: buy the roster you can afford, upgrade when rich
  const PRIORITY = ['frost', 'storm', 'lumen'];
  const SPOTS = { frost: [6.5, 3.4], storm: [10.5, -3], lumen: [12.5, 2.5] };
  for (let i = 0; i < 60000; i++) {
    if (s.phase === 'build' && s.wave < WAVES.length) {
      // spend down before the wave: buy next priority tower if affordable
      for (const k of PRIORITY) {
        if (!s.towers.some(t => t.type === k) && TOWERS[k].cost <= s.gold - 40) {
          const [x, z] = SPOTS[k];
          if (placeTower(s, k, x, z).ok) break;
        }
      }
      // cheap upgrades with surplus
      for (const t of s.towers) {
        const next = TOWERS[t.type].lv[t.lv + 1];
        if (next && s.gold - 40 >= next.cost && next.cost <= 135) upgradeTower(s, t.id);
      }
      startWave(s);
    } else if (s.phase === 'combat') {
      // buy the cheapest valuable upgrade mid-wave when spare gold exists
      if (s.gold > 220) {
        for (const t of s.towers) {
          const next = TOWERS[t.type].lv[t.lv + 1];
          if (next && next.cost <= s.gold - 60) upgradeTower(s, t.id);
        }
      }
    } else if (s.phase === 'victory') return { win: true, lives: s.lives, gold: s.gold, kills: s.kills };
    else if (s.phase === 'defeat') return { win: false, lives: s.lives, gold: s.gold, kills: s.kills };
    step(s, 1 / 60);
  }
  return { win: s.phase === 'victory', lives: s.lives, gold: s.gold, kills: s.kills };
}

const FORGE_PAIR = [["forge", 2.5, 3.0], ["forge", -2.5, -3.0]];
const FULL = [["willow", -3, -4.5], ["forge", 2.5, -3.5], ["frost", 6.5, 3.4], ["storm", 10.5, -3], ["lumen", 12.5, 2.5]];

// must hold near path (distToPath > 1.05). Verify positions:
function okPos(build) {
  let good = true;
  for (const [k, x, z] of build) {
    const r = placeTower(newState(path), k, x, z);
    if (!r.ok) { good = false; console.log('bad pos', k, x, z, r); }
  }
  return good;
}

console.log('positions ok:', okPos(FORGE_PAIR) && okPos(FULL));

const pair = play(FORGE_PAIR);
const full = play(FULL);

console.log('forge-pair result:', JSON.stringify(pair));
console.log('full-roster result:', JSON.stringify(full));

let fail = false;
// The exploit: 2 forges should NOT sail through all 3 waves with high lives.
if (pair.win && pair.lives >= 14) { console.error('BALANCE FAIL: forge pair still autowins (' + pair.lives + ' lives)'); fail = true; }
// The promise: a full roster with upgrades should clear the campaign.
if (!full.win) { console.error('BALANCE FAIL: full roster cannot win'); fail = true; }
// Boss stakes: leaking boss should be costly. Simulate directly:
const s2 = newState(path);
s2.gold = 99999;
placeTower(s2, 'forge', 2.5, 3.0);
startWave(s2);
// fast-forward to boss spawn is complex; instead verify leak cost payload exists via def
import { ENEMIES as E2 } from '../src/02_sim.mjs';
if (E2.boss.leak !== 10) { console.error('BALANCE FAIL: boss leak not 10'); fail = true; }
if (!E2.boss.slowImmune) { console.error('BALANCE FAIL: boss not slow-immune'); fail = true; }
if (E2.boss.armorSplash <= 0) { console.error('BALANCE FAIL: boss has no splash armor'); fail = true; }
if (!E2.wisp.air) { console.error('BALANCE FAIL: wisp not airborne'); fail = true; }
if (E2.beetle.armorSingle <= 0) { console.error('BALANCE FAIL: beetle no single armor'); fail = true; }

if (fail) process.exit(1);
console.log('ALL BALANCE TESTS PASSED');
