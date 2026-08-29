// Where do wave-1 leaks come from? DPS vs traverse check + wave-1-only sims.
import { buildPath, newState, startWave, placeTower, step, TOWERS, ENEMIES } from '../../src/02_sim.mjs';

const ctrl = [[-18, 4], [-12, 2], [-6, -2], [0, -1], [4, 2], [9, 1], [14, -1], [18, 0]];
const path = buildPath(ctrl);
console.log('PATH LEN =', path.len.toFixed(1));

// pure math: how fast does a wisp traverse with nothing killing it?
const wisp = ENEMIES.wisp;
console.log(`wisp traverse: ${(path.len / wisp.speed).toFixed(1)}s; beetle: ${(path.len / ENEMIES.beetle.speed).toFixed(1)}s`);

// wave-1 only, no upgrades, various 2-tower/3-tower openings, fresh 300g
function w1(build, gold = 300) {
  const s = newState(path);
  s.gold = gold;
  for (const [k, x, z] of build) {
    const r = placeTower(s, k, x, z);
    if (!r.ok) return { err: r.why };
  }
  startWave(s);
  for (let i = 0; i < 60000; i++) {
    if (s.phase === 'combat' && s.enemies.length === 0 && s.spawnq.length === 0) break;
    if (s.phase === 'defeat') break;
    step(s, 1 / 60);
  }
  return { lives: s.lives, kills: s.kills, phase: s.phase };
}

console.log('willow+forge   :', JSON.stringify(w1([["willow", -3, -4.5], ["forge", 2.5, -3.5]])));
console.log('willow+forge+? :', JSON.stringify(w1([["willow", -3, -4.5], ["forge", 2.5, -3.5], ["willow", 6.5, 3.4]], 340)));
console.log('forge+forge    :', JSON.stringify(w1([["forge", 2.5, 3.0], ["forge", -2.5, -3.0]], 340)));
console.log('willow+storm   :', JSON.stringify(w1([["willow", -3, -4.5], ["storm", 2.5, -3.5]], 340)));
console.log('frost+forge    :', JSON.stringify(w1([["frost", -3, -4.5], ["forge", 2.5, -3.5]], 340)));
