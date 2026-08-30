import { buildPath, newState, startWave, placeTower, upgradeTower, step, TOWERS, ENEMIES, WAVES, START_GOLD, WAVE_BONUS } from '../../src/02_sim.mjs';
const path = buildPath([[-21, 6], [-13, 3.2], [-6.5, -1.8], [0, -0.6], [4.6, 2.2], [9.6, 0.8], [14.5, -1.6], [21, 0.2]]);
function run(comps, upgradePlan=[]){ // comps: array of [kind,x,z]
  const s=newState(path); s.gold=START_GOLD;
  for(const [k,x,z] of comps){ const r=placeTower(s,k,x,z); if(!r.ok){return{phase:'placefail:'+r.why,lives:0,leaks:0,kills:0,towers:s.towers.length,gold:Math.floor(s.gold)};} }
  let w=0,guard=0;
  while(s.phase!=='victory'&&s.phase!=='defeat'&&guard<200){
    guard++;
    if(s.phase==='build'){
      for(const u of upgradePlan){ if(u.afterWave===w){ const t=s.towers[u.i]; if(t) upgradeTower(s,t.id); } }
      startWave(s); w++;
    }
    let st=0; while(s.phase==='combat'&&st<60*90){step(s,1/60);st++;}
  }
  return {phase:s.phase, lives:s.lives, leaks:s.leaks, kills:s.kills, towers:s.towers.length, gold:Math.floor(s.gold)};
}
console.log('=== Compositions, no upgrades (lives out of 20) ===');
const comps={
  'willow x3':[['willow',-15,6],['willow',-7,1],['willow',1,3]],
  'willow+forge+storm':[['willow',-15,6],['forge',-7,1],['storm',2,3]],
  'willow+storm+frost':[['willow',-13,6],['storm',-1,1],['frost',4,3]],
  'forge x2':[['forge',-15,6],['forge',-5,2]],
  'storm+willow':[['storm',-13,6],['willow',-3,-1]],
  'willow+forge+frost(2willow+forge)':[['willow',-15,6],['willow',-7,1],['forge',2,3]],
};
for(const [label,comp] of Object.entries(comps)){
  const r=run(comp);
  console.log(`[${label}] phase=${r.phase} lives=${r.lives} leaks=${r.leaks} kills=${r.kills} towers=${r.towers} gold=${r.gold}`);
}
console.log('\n=== With upgrades ===');
const plans=[
  ['willow x3 +up willows',[['willow',-15,6],['willow',-7,1],['willow',1,3]],[{afterWave:0,i:0,to:1},{afterWave:0,i:1,to:1},{afterWave:1,i:0,to:2},{afterWave:1,i:1,to:2}]],
  ['nice mix +up',[['willow',-15,6],['forget',-7,1],['storm',2,3]],[]],
];
for(const [label,comp,plan] of plans){
  if(comp.some(c=>c[0]==='forget')){console.log(`[${label}] skip`);continue;}
  const r=run(comp,plan);
  console.log(`[${label}] phase=${r.phase} lives=${r.lives} leaks=${r.leaks} kills=${r.kills} towers=${r.towers} gold=${r.gold}`);
}
console.log('\nTotal revenue (+start+bonuses+all kills) =', START_GOLD+WAVE_BONUS[1]+WAVE_BONUS[2]+WAVE_BONUS[3]+WAVES.reduce((a,w)=>a+w.groups.reduce((x,g)=>x+g.n*ENEMIES[g.e].reward,0),0));
console.log('Wave3 total HP =', WAVES[2].groups.reduce((a,g)=>a+g.n*ENEMIES[g.e].hp,0), ' (boss='+ENEMIES.boss.hp+')');
