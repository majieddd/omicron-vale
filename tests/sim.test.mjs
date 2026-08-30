// Headless balance + determinism test for the Omicron sim.
// Run: node tests/sim.test.mjs
import { buildPath, newState, startWave, placeTower, upgradeTower, step, WAVES, TOWERS, simSnapshot } from '../src/02_sim.mjs';

const ctrl = [[-18, 4], [-12, 2], [-6, -2], [0, -1], [4, 2], [9, 1], [14, -1], [18, 0]];
const path = buildPath(ctrl);

// ---- determinism: same seed => identical snapshots
const sA = newState(buildPath(ctrl)), sB = newState(buildPath(ctrl));
sA.gold = 2000; sB.gold = 2000;
startWave(sA); startWave(sB);
const placeA = [[ 'willow', -3, -4.5 ], [ 'forge', 2.5, -3.5 ], [ 'frost', 6.5, 3.4 ], [ 'storm', 10.5, -3 ], [ 'lumen', 12.5, 2.5 ]];
for (const [k, x, z] of placeA) { placeTower(sA, k, x, z); placeTower(sB, k, x, z); }
for (let i = 0; i < 60 * 60 * 10; i++) { step(sA, 1/60); step(sB, 1/60); }
const snap = s => JSON.stringify([s.t, s.phase, s.gold, s.lives, s.wave, s.kills, s.enemies.length, s.towers.length]);
if (snap(sA) !== snap(sB)) { console.error('DETERMINISM FAIL'); process.exit(1); }
console.log('determinism OK, snapshot after 10min:', snap(sA), 'phase:', sA.phase);

// ---- winnability with a competent-ish bot over all 3 waves
function play(seedPath) {
  const st = newState(seedPath);
  st.gold = 2000;
  let placed = [];
  startWave(st);
  for (let i = 0; i < 60000; i++) {
    // bot logic: during build, buy towers near path; during combat, upgrade as gold allows
    if (st.phase === 'build') {
      for (const [k, x, z] of placeA) {
        if (!st.towers.some(t => t.type === k)) placeTower(st, k, x, z);
      }
      startWave(st);
    } else if (st.phase === 'combat' || st.phase === 'victory') {
      // buy upgrades with surplus
      for (const t of st.towers) {
        if (st.gold > 400) upgradeTower(st, t.id);
      }
      if (st.phase === 'victory') break;
    } else break; // defeat
    step(st, 1/60);
    if (i > 60500) break;
  }
  return st;
}
const r = play(buildPath(ctrl));
const ok = r.phase === 'victory' && r.lives > 0;
console.log('playthrough:', JSON.stringify(simSnapshot(r)), ok ? 'WIN' : 'LOSS');
if (!ok) {
  console.error('BALANCE FAIL: bot could not win (lives=' + r.lives + ' phase=' + r.phase + ')');
  process.exit(1);
}
console.log('ALL SIM TESTS PASSED');
