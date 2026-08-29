import { buildPath, newState, startWave, placeTower, step, TOWERS, ENEMIES, WAVES, START_GOLD } from './src/02_sim.mjs';
const path = buildPath([[-21, 6], [-13, 3.2], [-6.5, -1.8], [0, -0.6], [4.6, 2.2], [9.6, 0.8], [14.5, -1.6], [21, 0.2]]);

function runWaveDetail(comps){
  const s=newState(path); s.gold=START_GOLD;
  for(const [k,x,z] of comps){ const r=placeTower(s,k,x,z); if(!r.ok) return {fail:r.why}; }
  const perWave=[];
  let w=0,guard=0;
  while(s.phase!=='victory'&&s.phase!=='defeat'&&guard<200){
    guard++;
    if(s.phase==='build'){ const livesBefore=s.lives; startWave(s); w++;
      // step this wave
      let st=0; while(s.phase==='combat'&&st<60*120){step(s,1/60);st++;}
      perWave.push({wave:w, livesLost:livesBefore-s.lives, kills:s.kills, gold:Math.floor(s.gold), phase:s.phase});
    }
  }
  console.log(`\n=== Combo: ${comps.map(c=>c[0]).join('+')} === (startGold=${START_GOLD})`);
  for(const p of perWave) console.log(`  Wave${p.wave}: livesLost=${p.livesLost} kills=${p.kills} gold=${p.gold} -> ${p.phase}`);
  return s;
}

// Test variants of the forge double and variations with slight repositioning
runWaveDetail([['forge',-15,6],['forge',-5,2]]);
runWaveDetail([['forge',-13,6],['forge',0,2]]);
runWaveDetail([['forge',-15,6],['willow',-7,1]]);
runWaveDetail([['willow',-15,6],['willow',-7,1],['willow',1,3]]);
runWaveDetail([['storm',-13,6],['storm',-1,1]]);
runWaveDetail([['forge',-15,6],['storm',-5,2]]);
runWaveDetail([['lumen',-10,4],['willow',-2,0]]);

// Boss focus: is a single forge actually killing the 3200hp boss in time? measure boss dps vs boss traverse
// boss speed 0.95, path 46.5 => 48.9s in route. Total dps needed if boss ~whole load
console.log('\nBoss: 3200hp. A lv0 forge = 16.1 dps single, 2 forges=32.2. 3200/32.2=99s > 48.9s traverse. So 2 forges CANNOT solo-kill boss by raw dps.');
console.log('2 forges each splash 2.6 r hitting boss + add: net ~32 dps sustained -> 3200/32=100s. Boss lives 49s -> only ~1600 dmg. Boss MUST leak unless other towers focus it.');
