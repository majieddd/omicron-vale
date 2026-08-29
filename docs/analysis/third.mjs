import { buildPath, newState, startWave, placeTower, step, TOWERS, ENEMIES, WAVES, START_GOLD, WAVE_BONUS } from '../../src/02_sim.mjs';
const path = buildPath([[-21, 6], [-13, 3.2], [-6.5, -1.8], [0, -0.6], [4.6, 2.2], [9.6, 0.8], [14.5, -1.6], [21, 0.2]]);
function run(comps){ // comps=[start towers], then buy extra after wave1
  const s=newState(path); s.gold=START_GOLD;
  for(const [k,x,z] of comps){ const r=placeTower(s,k,x,z); if(!r.ok) return {phase:'placefail',fail:r.why}; }
  let w=0,guard=0, extra=[];
  while(s.phase!=='victory'&&s.phase!=='defeat'&&guard<200){
    guard++;
    if(s.phase==='build'){
      if(w===1 && extra.length){ for(const [k,x,z] of extra) placeTower(s,k,x,z); }
      startWave(s); w++;
    }
    let st=0; while(s.phase==='combat'&&st<60*120){step(s,1/60);st++;}
  }
  return {phase:s.phase, lives:s.lives, leaks:s.leaks, kills:s.kills, gold:Math.floor(s.gold), towers:s.towers.length};
}
const base=[['forge',-15,6],['forge',-5,2]];
const extras={
  'none':[],
  '+frost':[['frost',3,3]],
  '+willow':[['willow',3,4]],
  '+storm':[['storm',3,3]],
  '+lumen':[['lumen',3,3]],
  '+forge':[['forge',3,3]],
};
console.log('=== 2 forge start, add 1 tower after wave1 (the key decision) ===');
for(const [k,extra] of Object.entries(extras)){
  const r=run([...base,...extra]);
  console.log(`[2forge ${k}] phase=${r.phase} lives=${r.lives} leaks=${r.leaks} kills=${r.kills} towers=${r.towers} gold=${r.gold}`);
}

// Frost slow value in isolation: does a frost actually meaningfully slow the leak in wave1?
function frostTest(){
  const s=newState(path); s.gold=START_GOLD;
  placeTower(s,'willow',[-15,6]);
  placeTower(s,'willow',[-5,2]);
  const s2=newState(path); s2.gold=START_GOLD;
  placeTower(s2,'willow',[-15,6]); placeTower(s2,'willow',[-5,2]); placeTower(s2,'frost',[2,3]);
  function wave1(st){ startWave(st); let l=0; let lost=0; const lives0=st.lives; while(st.phase==='combat'&&l<60*120){step(st,1/60);l++;} return lives0-st.lives; }
  const wloss1=wave1(s); const wloss2=wave1(s2);
  console.log(`\n[wave1 leak] 2 willow alone: lost=${wloss1}  |  2 willow + frost: lost=${wloss2}`);
}
frostTest();
