// Economy sweep: find reward set where (a) forge pair does NOT sail all 3 waves,
// (b) a reasonable willow+forge opening WITH frost/storm adds clears ~5+ lives left.
import { buildPath, newState, startWave, placeTower, upgradeTower, step, TOWERS, WAVES, ENEMIES, WAVE_BONUS } from '../../src/02_sim.mjs';

const ctrl = [[-18, 4], [-12, 2], [-6, -2], [0, -1], [4, 2], [9, 1], [14, -1], [18, 0]];
const path = buildPath(ctrl);

const COMBOS = {
  'forge-pair': [["forge", 2.5, 3.0], ["forge", -2.5, -3.0]],
  'willow-forge': [["willow", -3, -4.5], ["forge", 2.5, -3.5]],
  'willow-forge-frost': [["willow", -3, -4.5], ["forge", 2.5, -3.5], ["frost", 6.5, 3.4]],
  'full': [["willow", -3, -4.5], ["forge", 2.5, -3.5], ["frost", 6.5, 3.4], ["storm", 10.5, -3], ["lumen", 12.5, 2.5]]
};

const SPOTS = { frost: [6.5, 3.4], storm: [10.5, -3], lumen: [12.5, 2.5] };
const PRIORITY = ['frost', 'storm', 'lumen'];

function play(startGold, rewards, bonus, build) {
  const s = newState(path);
  // patch rewards
  for (const k of Object.keys(rewards)) s.__rew = s.__rew || {};
  s.gold = startGold;
  for (const [k, x, z] of build) placeTower(s, k, x, z);
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
    } else if (s.phase === 'combat' && s.gold > 220) {
      for (const t of s.towers) {
        const next = TOWERS[t.type].lv[t.lv + 1];
        if (next && next.cost <= s.gold - 60) upgradeTower(s, t.id);
      }
    } else if (s.phase === 'victory' || s.phase === 'defeat') {
      return { phase: s.phase, lives: s.lives, kills: s.kills, gold: Math.floor(s.gold) };
    }
    step(s, 1 / 60);
  }
  return { phase: s.phase, lives: s.lives, kills: s.kills, gold: Math.floor(s.gold) };
}

// Patch approach: temporarily mutate ENEMIES + WAVE_BONUS (module-level objects).

const REWARD_SETS = {
  'current': { wisp: 6, beetle: 12, ember: 9, stalker: 10, grunt: 16, boss: 150 },
  'mid':    { wisp: 8, beetle: 14, ember: 10, stalker: 12, grunt: 20, boss: 200 },
  'soft':   { wisp: 10, beetle: 16, ember: 12, stalker: 14, grunt: 24, boss: 250 }
};
const BONUSES = { 'tight': [50, 80, 140], 'balanced': [60, 90, 150], 'rich': [80, 110, 180] };
const STARTS = { 280: 280, 300: 300, 340: 340 };

for (const [rwName, rewards] of Object.entries(REWARD_SETS)) {
  for (const [stName, start] of Object.entries(STARTS)) {
    for (const [bnName, bonus] of Object.entries(BONUSES)) {
      // patch ENEMIES rewards + WAVE_BONUS
      const saved = {};
      for (const k of Object.keys(rewards)) { saved[k] = ENEMIES[k].reward; ENEMIES[k].reward = rewards[k]; }
      const savedB = [WAVE_BONUS[1], WAVE_BONUS[2], WAVE_BONUS[3]];
      WAVE_BONUS[1] = bonus[0]; WAVE_BONUS[2] = bonus[1]; WAVE_BONUS[3] = bonus[2];
      const pair = play(start, rewards, bonus, COMBOS['forge-pair']);
      const wf = play(start, rewards, bonus, COMBOS['willow-forge']);
      const wff = play(start, rewards, bonus, COMBOS['willow-forge-frost']);
      const full = play(start, rewards, bonus, COMBOS['full']);
      for (const k of Object.keys(saved)) ENEMIES[k].reward = saved[k];
      WAVE_BONUS[1] = savedB[0]; WAVE_BONUS[2] = savedB[1]; WAVE_BONUS[3] = savedB[2];
      const tag = `start=${start} rewards=${rwName} bonus=${bnName}`;
      const ok = !(pair.phase === 'victory' && pair.lives >= 14)
        && (wff.phase === 'victory' && wff.lives >= 5)
        && (full.phase === 'victory');
      console.log(`${ok ? 'PASS' : '....'} ${tag} | pair:${pair.phase}/${pair.lives}| wf:${wf.phase}/${wf.lives} | wff:${wff.phase}/${wff.lives} | full:${full.phase}/${full.lives}`);
    }
  }
}
