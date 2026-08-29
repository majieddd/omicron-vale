// Balance harness: Omicron sim. Import pure logic, run strategies.
import { buildPath, newState, startWave, placeTower, upgradeTower, step, TOWERS, ENEMIES, WAVES, START_GOLD } from '../../src/02_sim.mjs';
const START_LIVES = 20;

const path = buildPath([[-21, 6], [-13, 3.2], [-6.5, -1.8], [0, -0.6], [4.6, 2.2], [9.6, 0.8], [14.5, -1.6], [21, 0.2]]);

function runStrategy(label, buildFn, perWaveCb){
  const s = newState(path);
  buildFn(s);
  let guard=0;
  while(s.phase!=='victory' && s.phase!=='defeat' && guard<200){
    guard++;
    if(s.phase==='build'){ startWave(s); }
    // step until phase settles out of combat or victory/defeat
    let steps=0;
    while(s.phase==='combat' && steps<60*90){ step(s,1/60); steps++; }
    if(perWaveCb) perWaveCb(s);
  }
  return s;
}

console.log('PATH LENGTH =', path.len.toFixed(1), 'units.');
console.log('\n=== lv0 dps/gold efficiency ===');
for (const [k,t] of Object.entries(TOWERS)) {
  console.log(`${k.padEnd(7)} dps=${(t.dmg*t.rate).toFixed(1)} cost=${t.cost} dps/gold=${((t.dmg*t.rate)/t.cost).toFixed(3)}`);
}

const results = [];

// Strategy A: 3 willow
results.push(['A: 3 Willow', runStrategy('A', s=>{
  [[-10,5],[-4,4],[2,3]].forEach(([x,z])=>placeTower(s,'willow',x,z));
})]);
// Strategy B: 2 willow + 1 forge
results.push(['B: 2Willow+1Forge', runStrategy('B', s=>{
  [[-10,5],[-2,4]].forEach(([x,z])=>placeTower(s,'willow',x,z));
  placeTower(s,'forge',[6,3]);
})]);
// Strategy C: willow+frost+storm (diverse), spending exactly 320
results.push(['C: Willow+Frost+Storm', runStrategy('C', s=>{
  placeTower(s,'willow',[-9,5]);
  placeTower(s,'frost',[-2,2]);
  placeTower(s,'storm',[4,3]);
})]);

// Strategy D: 3 willow + upgrade one (using wave1 gold)
results.push(['D: 3Willow+upgrade L1', runStrategy('D', s=>{
  const ids=[];
  [[-10,5],[-4,4],[2,3]].forEach(([x,z])=>ids.push(placeTower(s,'willow',x,z)));
  let count=0;
  return ids;
}, s=>{ /* callback runs after each wave; upgrade first willow */

})]);

for(const [label,s] of results){
  console.log(`\n[${label}] end=${s.phase} lives=${s.lives}/${START_LIVES} gold=${Math.floor(s.gold)} kills=${s.kills} leaks=${s.leaks} towers=${s.towers.length}`);
}
