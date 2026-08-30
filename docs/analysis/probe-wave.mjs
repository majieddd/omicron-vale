// Precise probe: per-wave income, spend, leaks. Patch ENEMIES rewards mid-set.
import { buildPath, newState, startWave, placeTower, upgradeTower, step, TOWERS, WAVES, ENEMIES, WAVE_BONUS } from '../../src/02_sim.mjs';

const ctrl = [[-18, 4], [-12, 2], [-6, -2], [0, -1], [4, 2], [9, 1], [14, -1], [18, 0]];
const path = buildPath(ctrl);
// mid economy
ENEMIES.wisp.reward = 8; ENEMIES.beetle.reward = 14; ENEMIES.ember.reward = 10;
ENEMIES.stalker.reward = 12; ENEMIES.grunt.reward = 20; ENEMIES.boss.reward = 200;
WAVE_BONUS[1] = 60; WAVE_BONUS[2] = 90; WAVE_BONUS[3] = 150;

function probe(build, label) {
  const s = newState(path);
  s.gold = 300;
  let log = [`[${label}] start gold=${s.gold}`];
  for (const [k, x, z] of build) {
    const r = placeTower(s, k, x, z);
    log.push(`  place ${k}@(${x},${z}) -> ${r.ok ? 'ok' : r.why}`);
  }
  const SPOTS = { frost: [6.5, 3.4], storm: [10.5, -3], lumen: [12.5, 2.5] };
  const PRIORITY = ['frost', 'storm', 'lumen'];
  let lastWave = 0;
  for (let i = 0; i < 90000; i++) {
    if (s.phase === 'build') {
      for (const k of PRIORITY) {
        if (!s.towers.some(t => t.type === k) && TOWERS[k].cost <= s.gold - 40) {
          const [x, z] = SPOTS[k];
          const r = placeTower(s, k, x, z);
          if (r.ok) { log.push(`  BOUGHT ${k} -> gold ${Math.floor(s.gold)}`); break; }
        }
      }
      for (const t of s.towers) {
        const next = TOWERS[t.type].lv[t.lv + 1];
        if (next && s.gold - 40 >= next.cost && next.cost <= 135) {
          upgradeTower(s, t.id);
          log.push(`  UPGRADE ${t.type} -> lv${t.lv + 1}`);
        }
      }
      if (s.wave < WAVES.length && startWave(s)) {
        log.push(`  WAVE ${s.wave} STARTS: towers=[${s.towers.map(t=>t.type+'@'+t.lv).join(',')}] gold=${Math.floor(s.gold)}`);
      } else if (s.wave >= WAVES.length) { log.push('  (all waves done, in build)'); break; }
    } else if (s.phase === 'combat' && s.gold > 260) {
      for (const t of s.towers) {
        const next = TOWERS[t.type].lv[t.lv + 1];
        if (next && next.cost <= s.gold - 80) { upgradeTower(s, t.id); log.push(`  COMBAT BUY upgrade ${t.type}->lv${t.lv + 1} (gold ${Math.floor(s.gold)})`); }
      }
    } else if (s.phase === 'victory' || s.phase === 'defeat') {
      log.push(`  FINAL ${s.phase}: lives=${s.lives} kills=${s.kills} gold=${Math.floor(s.gold)}`);
      break;
    }
    step(s, 1 / 60);
  }
  console.log(log.join('\n'));
  console.log('---');
}

probe([["willow", -3, -4.5], ["forge", 2.5, -3.5]], 'willow+forge');
probe([["forge", 2.5, 3.0], ["forge", -2.5, -3.0]], 'forge-pair');
