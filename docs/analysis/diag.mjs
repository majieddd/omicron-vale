import { buildPath, newState, startWave, placeTower, step, TOWERS, ENEMIES, WAVES, START_GOLD, distToPath } from '../../src/02_sim.mjs';
const path = buildPath([[-21, 6], [-13, 3.2], [-6.5, -1.8], [0, -0.6], [4.6, 2.2], [9.6, 0.8], [14.5, -1.6], [21, 0.2]]);
const s = newState(path);

console.log('=== placement sanity ===');
for (const [x,z] of [[-10,5],[-4,4],[2,3],[-2,2],[4,3],[-9,5],[6,3]]) {
  const dp = distToPath(path,x,z).toFixed(2);
  console.log(`place(${x},${z}) distToPath=${dp}`);
}

console.log('\n=== C placement results ===');
const s2 = newState(path);
let r;
r=placeTower(s2,'willow',[-9,5]); console.log('willow',r);
r=placeTower(s2,'frost',[-2,2]); console.log('frost',r);
r=placeTower(s2,'storm',[4,3]); console.log('storm',r);
console.log('towers:',s2.towers.map(t=>`${t.type}@(${t.x},${t.z}) range=${t.range}`));

// Step during wave1, log when towers fire
startWave(s2);
let fireCount={willow:0,frost:0,storm:0};
for(let i=0;i<60*30;i++){ step(s2,1/60);
  for(const e of s2.events){ if(e.type==='fire'){ const t=s2.towers.find(q=>q.id===e.id); if(t) fireCount[t.type]++; } }
  s2.events.length=0;
}
console.log('fire counts (first 30s of wave1):', fireCount);
console.log('enemies:', s2.enemies.length, 'kills:', s2.kills, 'lives:', s2.lives);

// path sample points and enemy positions in range of each tower
console.log('\npath sample points:');
for(let d=0; d<path.len; d+=5){ const p=pathAtForPrint(path,d); }
function pathAtForPrint(path,d){ // inline
  const pts=path.pts; let lo=0,hi=pts.length-1; d=Math.max(0,Math.min(d,path.len));
  while(lo<hi){const mid=(lo+hi)>>1; if(pts[mid][2]<d)lo=mid+1; else hi=mid;}
  const i=Math.max(1,lo),a=pts[i-1],b=pts[i]; const seg=(b[2]-a[2])||1,t=(d-a[2])/seg;
  const x=((a[0])+(b[0]-a[0])*t).toFixed(1), z=((a[1])+(b[1]-a[1])*t).toFixed(1);
  console.log(`  d=${d.toFixed(0)} -> (${x},${z})`);
}
