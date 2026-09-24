/**
 * Navigation regression check for the office floor plan.
 *
 * Runs headless: verifies every waypoint is usable, that A* routes between all of them
 * arrive without walking a character through furniture, and that a query stays cheap
 * enough to run on every destination decision.
 *
 * Run after moving furniture in components/Office.tsx or a waypoint in
 * behavior/officeMap.ts -- those two files are a contract, and nothing else catches a
 * desk that moved out from under its standing spot.
 *
 *   npm run check:nav
 */

import * as THREE from 'three';
import { ARRIVAL_EPSILON, CORNER_EPSILON, DESKS, ROOMS, SHARED_WAYPOINTS, isBlocked, randomWanderPoint, findPath, furnitureClearance, yawToward } from '@/behavior/officeMap';

const BODY = 0.26; // character body radius; a clip is clearance < BODY
let fail = 0;
const check = (l:string, ok:boolean, d='') => { if(!ok) fail++; console.log(`  ${ok?'PASS':'FAIL'} ${l}${d?'  '+d:''}`); };
// Meeting seats are destinations too, and they sit inside enclosed rooms reached through a
// single doorway — the case most likely to be unreachable after a layout change.
const seatPoints = Object.values(ROOMS).flatMap((room) =>
  room.seats.map((seat, index) => ({
    id: `${room.id}-seat-${index}`,
    position: seat,
    lookAt: room.focus,
  })),
);
const all = [...Object.values(DESKS), ...SHARED_WAYPOINTS, ...seatPoints];

console.log('=== waypoints: walkable, and clear of the furniture they serve ===');
for (const w of all) {
  const c = furnitureClearance(w.position);
  check(`${w.id} clearance ${c.toFixed(2)}`, c >= BODY);
}

console.log('\n=== facing on arrival ===');
for (const w of all) {
  const yaw = yawToward(w.position, w.lookAt);
  const f = new THREE.Vector3(Math.sin(yaw),0,Math.cos(yaw));
  const t = w.lookAt.clone(); t.y=0;
  check(w.id, w.position.clone().addScaledVector(f,0.3).distanceTo(t) < w.position.distanceTo(t));
}

console.log('\n=== 3000 wander samples legal ===');
let bad=0; for(let i=0;i<3000;i++) if(isBlocked(randomWanderPoint())) bad++;
check('all legal', bad===0, `${bad} illegal`);

console.log('\n=== A* routes: arrive, with real body clearance throughout ===');
function sim(from: THREE.Vector3, to: THREE.Vector3) {
  const path = findPath(from,to); const pos=from.clone();
  let idx=0, steps=0, worst=Infinity;
  while(steps++<6000){
    const corner = path[idx] ?? to;
    const isFinal = idx >= path.length-1;
    const d = corner.clone().sub(pos); d.y=0; const dist=d.length();
    if (dist < (isFinal ? ARRIVAL_EPSILON : CORNER_EPSILON)) { if(isFinal) return {ok:true,worst,corners:path.length}; idx++; continue; }
    pos.addScaledVector(d.divideScalar(dist), Math.min(1.35/60, dist));
    // exclude the destination approach: waypoints intentionally sit right at their furniture
    // Both ends are excluded: destinations sit right at their desk or seat by design, and the
    // same is true of the origin when a route starts from one.
    if (pos.distanceTo(to) > 1.0 && pos.distanceTo(from) > 1.0) {
      worst = Math.min(worst, furnitureClearance(pos));
    }
  }
  return {ok:false,worst,corners:path.length};
}
let inc=0, clip=0, routes=0, globalWorst=Infinity, ex='';
// Extra free-floor origins, filtered: an origin sitting inside furniture would report a
// clearance failure that belongs to the test, not to the pathfinder.
const extraOrigins = [
  new THREE.Vector3(0, 0, 7.4),
  new THREE.Vector3(-8, 0, 0),
  new THREE.Vector3(8, 0, 5),
  new THREE.Vector3(0, 0, 0),
].filter((p) => !isBlocked(p) && furnitureClearance(p) >= BODY);
const origins = [...all.map((w) => w.position), ...extraOrigins];
for(const a of origins) for(const b of all){
  if(a.distanceTo(b.position)<0.2) continue;
  routes++; const r=sim(a,b.position);
  if(!r.ok) inc++;
  globalWorst = Math.min(globalWorst, r.worst);
  if(r.worst < BODY){ clip++; if(!ex) ex=`${a.toArray().map(n=>n.toFixed(1)).join(',')} -> ${b.id} (${r.worst.toFixed(2)})`; }
}
check(`all ${routes} routes arrive`, inc===0, `${inc} stuck`);
check(`body never clips furniture (min clearance ${globalWorst.toFixed(2)} >= ${BODY})`, clip===0, clip?`${clip}/${routes}, e.g. ${ex}`:'');

console.log('\n=== A* cost ===');
const t0=performance.now();
for(let i=0;i<1000;i++) findPath(randomWanderPoint(), all[i%all.length].position);
const per=(performance.now()-t0)/1000;
check('under 1ms per query', per<1.0, `${per.toFixed(3)} ms avg`);

console.log(fail===0?'\nNAV PASSED':`\nNAV FAILED (${fail})`);
process.exit(fail===0?0:1);
