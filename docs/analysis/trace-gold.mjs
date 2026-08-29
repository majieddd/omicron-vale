// Exact income trace: willow+forge, mid economy
import { buildPath, newState, startWave, placeTower, upgradeTower, step, TOWERS, WAVES, ENEMIES, WAVE_BONUS } from '../../src/02_sim.mjs';

const ctrl = [[-18, 4], [-12, 2], [-6, -2], [0, -1], [4, 2], [9, 1], [14, -1], [18, 0]];
const path = buildPath(ctrl);
ENEMIES.wisp.reward = 8; ENEMIES.beetle.reward = 14; ENEMIES.ember.reward = 10;
ENEMIES.stalker.reward = 12; ENEMIES.grunt.reward = 20; ENEMIES.boss.reward = 200;
WAVE_BONUS[1] = 60; WAVE_BONUS[2] = 90; WAVE_BONUS[3] = 150;

const s = newState(path);
s.gold = 300;
placeTower(s, 'willow', -3, -4.5);
placeTower(s, 'forge', 2.5, -3.5);
let prevKills = 0, prevLives = s.lives, prevWave = 0;
const SPOTS = { frost: [6.5, 3.4], storm: [10.5, -3], lumen: [12.5, 2.5] };
const PRIORITY = ['frost', 'storm', 'lumen'];
for (let i = 0; i < 90000; i++) {
  if (s.phase === 'build' && s.wave < WAVES.length) {
    console.log(`[build @t=${s.t.toFixed(1)}] wave=${s.wave} gold=${Math.floor(s.gold)} kills=${s.kills} lives=${s.lives}`);
    for (const k of PRIORITY) {
      if (!s.towers.some(t => t.type === k)) {
        const [x, z] = SPOTS[k];
        const r = placeTower(s, k, x, z);
        console.log(`  try buy ${k} (cost ${TOWERS[k].cost}) gold=${Math.floor(s.gold)} -> ${r.ok ? 'ok' : r.why}`);
        if (r.ok) break;
      }
    }
    for (const t of s.towers) {
      const next = TOWERS[t.type].lv[t.lv + 1];
      if (next && s.gold - 40 >= next.cost && next.cost <= 135) {
        upgradeTower(s, t.id);
        console.log(`  upgrade ${t.type} -> lv${t.lv + 1}`);
      }
    }
    if (startWave(s)) console.log(`  >> WAVE ${s.wave} STARTS`);
  } else if (s.phase === 'combat' && s.gold > 260) {
    for (const t of s.towers) {
      const next = TOWERS[t.type].lv[t.lv + 1];
      if (next && next.cost <= s.gold - 80) { upgradeTower(s, t.id); console.log(`  [combat] upgrade ${t.type}->lv${t.lv + 1}`); }
    }
  } else if (s.phase === 'victory' || s.phase === 'defeat') {
    console.log(`END ${s.phase}: lives=${s.lives} kills=${s.kills} gold=${Math.floor(s.gold)}`);
    break;
  }
  step(s, 1 / 60);
  // wave transition report
  if (s.wave !== prevWave && s.phase === 'build') {
    console.log(`  -- wave transition: ${prevWave} -> ${s.wave}, kills ${prevKills}->${s.kills}, lives ${prevLives}->${s.lives}, gold=${Math.floor(s.gold)}`);
    prevKills = s.kills; prevLives = s.lives; prevWave = s.wave;
  }
}
