import { buildPath, newState, startWave, placeTower, step, TOWERS, ENEMIES, WAVES, START_GOLD } from '../../src/02_sim.mjs';
const path = buildPath([[-21, 6], [-13, 3.2], [-6.5, -1.8], [0, -0.6], [4.6, 2.2], [9.6, 0.8], [14.5, -1.6], [21, 0.2]]);
function waveDetail(comps){
  const s=newState(path); s.gold=START_GOLD;
  for(const [k,x,z] of comps){ const r=placeTower(s,k,x,z); if(!r.ok) return {placefail:r.why}; }
  startWave(s);
  let st=0; while(s.phase==='combat'&&st<60*120){step(s,1/60);st++;}
  return {livesLost:20-s.lives, kills:s.kills, gold:Math.floor(s.gold), phase:s.phase};
}
console.log('=== WAVE 1 ONLY (13 enemies: 8 wisp + 5 beetle) ===');
const tests={
  '2 willow':[['willow',-15,6],['willow',-5,2]],
  '2 willow + frost':[['willow',-15,6],['willow',-5,2],['frost',4,4]],
  '2 willow + (extra willow)':[['willow',-15,6],['willow',-5,2],['willow',4,5]],
  '3 willow':[['willow',-15,6],['willow',-5,2],['willow',4,5]],
  '2 forge':[['forge',-15,6],['forge',-5,2]],
};
for(const [label,comp] of Object.entries(tests)){
  const r=waveDetail(comp);
  console.log(`[${label}] ${r.placefail?('PLACEFAIL '+r.placefail):('livesLost='+r.livesLost+' kills='+r.kills+' gold='+r.gold+' -> '+r.phase)}`);
}
