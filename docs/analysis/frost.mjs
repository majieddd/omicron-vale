import { buildPath, newState, startWave, placeTower, step, TOWERS, ENEMIES, WAVES, START_GOLD, WAVE_BONUS } from '../../src/02_sim.mjs';
const path = buildPath([[-21, 6], [-13, 3.2], [-6.5, -1.8], [0, -0.6], [4.6, 2.2], [9.6, 0.8], [14.5, -1.6], [21, 0.2]]);
function run(comps){
  const s=newState(path); s.gold=START_GOLD;
  for(const [k,x,z] of comps){ const r=placeTower(s,k,x,z); if(!r.ok) return {fail:r.why,phase:'placefail'}; }
  let w=0,guard=0;
  while(s.phase!=='victory'&&s.phase!=='defeat'&&guard<200){
    guard++; if(s.phase==='build'){ startWave(s); w++; }
    let st=0; while(s.phase==='combat'&&st<60*120){step(s,1/60);st++;}
  }
  return {phase:s.phase, lives:s.lives, leaks:s.leaks, kills:s.kills, gold:Math.floor(s.gold)};
}
// Frost value test: replace a willow with frost in a 3-tower build
const tests={
  'forge+forge (baseline)':[['forge',-15,6],['forge',-5,2]],
  'forge+forge+frost':[['forge',-15,6],['forge',-5,2],['frost',2,3]],
  'forge+forge+willow':[['forge',-15,6],['forge',-5,2],['willow',2,4]],
  'forge+forge+storm':[['forge',-15,6],['forge',-5,2],['storm',2,3]],
  'forge+forge+lumen':[['forge',-15,6],['forge',-5,2],['lumen',2,3]],
};
for(const [label,comp] of Object.entries(tests)){
  const r=run(comp);
  console.log(`[${label}] ${r.fail||('phase='+r.phase)} lives=${r.lives} kills=${r.kills} gold=${r.gold}`);
}

// Chain degeneration: average chain targets hit when firing storm at a single-file wave
const s=newState(path);s.gold=9999;
for(const [k,x,z] of [['storm',-13,6],['storm',-1,1]]) placeTower(s,k,x,z);
startWave(s);
let chainHits=[],total=0,shots=0;
for(let i=0;i<60*25;i++){ step(s,1/60);
  for(const e of s.events){ if(e.type==='fire'){ const t=s.towers.find(q=>q.id===e.id); if(t&&t.type==='storm'){shots++;/*count targets in range at fire*/const enemies=s.enemies.filter(en=>Math.hypot(en.x-t.x,en.z-t.z)<=t.range).length; total+=enemies;}}}
  s.events.length=0;
}
console.log(`\nStorm: shots=${shots}, avg enemies within storm range at fire time = ${(total/Math.max(1,shots)).toFixed(1)} (chain cap=3)`);
