import { buildPath, newState, placeTower, distToPath } from './src/02_sim.mjs';
const path = buildPath([[-21, 6], [-13, 3.2], [-6.5, -1.8], [0, -0.6], [4.6, 2.2], [9.6, 0.8], [14.5, -1.6], [21, 0.2]]);
const s=newState(path);
const comps={
  'willow x3':[['willow',-15,6],['willow',-7,1],['willow',1,3]],
  'willow+forge+frost':[['willow',-15,6],['forge',-7,1],['frost',2,3]],
  'storm+willow':[['storm',-13,6],['willow',-3,-1]],
};
for(const [label,comp] of Object.entries(comps)){
  const s2=newState(path);
  for(const [k,x,z] of comp){
    const dp=distToPath(path,x,z).toFixed(2);
    const r=placeTower(s2,k,x,z);
    console.log(`[${label}] ${k}@(${x},${z}) distToPath=${dp} -> ${JSON.stringify(r)}`);
  }
}
