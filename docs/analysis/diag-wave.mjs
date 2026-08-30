// Per-wave diagnostic: where does a reasonable build leak?
import { buildPath, newState, startWave, placeTower, upgradeTower, step, TOWERS, WAVES, START_GOLD } from '../../src/02_sim.mjs';

const ctrl = [[-18, 4], [-12, 2], [-6, -2], [0, -1], [4, 2], [9, 1], [14, -1], [18, 0]];
const path = buildPath(ctrl);
const s = newState(path);
s.gold = START_GOLD;

const build = [["willow", -3, -4.5], ["forge", 2.5, -3.5]];
for (const [k, x, z] of build) placeTower(s, k, x, z);
console.log('start gold', STARTER(s), 'towers placed:', s.towers.map(t=>t.type).join(','));

function STARTER(st2) { return st2.gold; }

const SPOTS = { frost: [6.5, 3.4], storm: [10.5, -3], lumen: [12.5, 2.5] };
const PRIORITY = ['frost', 'storm', 'lumen'];

let waveLog = [];
for (let i = 0; i < 60000; i++) {
  if (s.phase === 'build' && s.wave < WAVES.length) {
    for (const k of PRIORITY) {
      if (!s.towers.some(t => t.type === k) && TOWERS[k].cost <= s.gold - 40) {
        const [x, z] = SPOTS[k];
        if (placeTower(s, k, x, z).ok) break;
      }
    }
    for (const t of s.towers) {
      const next = TOWERS[t.type].lv[t.lv + 1];
      if (next && s.gold - 40 >= next.cost && next.cost <= 135) upgradeTower(s, t.id);
    }
    startWave(s);
    waveLog.push(`W${s.wave} start: towers=${s.towers.map(t=>t.type+'@'+t.lv).join(',')} gold=${Math.floor(s.gold)}`);
  } else if (s.phase === 'combat' && s.gold > 220) {
    for (const t of s.towers) {
      const next = TOWERS[t.type].lv[t.lv + 1];
      if (next && next.cost <= s.gold - 60) upgradeTower(s, t.id);
    }
  } else if (s.phase === 'victory' || s.phase === 'defeat') {
    waveLog.push(`END: ${s.phase} lives=${s.lives} kills=${s.kills} gold=${Math.floor(s.gold)}`);
    break;
  }
  step(s, 1 / 60);
  // log at each wave transition
  if (s.phase === 'build' && s.wave < WAVES.length && !s.spawnq.length && !s.enemies.length) {
    if (!waveLog.includes(`(W${s.wave} cleared: lives=${s.lives} gold=${Math.floor(s.gold)}) tap`)) {
      // do nothing; next build loop logs
    }
  }
}
// simpler: also step forward and print transitions
console.log(waveLog.join('\n'));
