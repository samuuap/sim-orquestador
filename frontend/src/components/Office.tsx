/**
 * Office environment.
 *
 * Built as layers, per the world-prop-kit approach: play (floor, desks), near (props the camera
 * passes), mid (partitions, shelving, meeting area) and far (window wall, skyline). The previous
 * version was a bare disc on an empty plane, which is why the scene read as unfinished.
 *
 * Cutaway convention: only the two far walls exist (-X and -Z). The near walls and the ceiling
 * slab are omitted so the isometric camera can see in; suspended light fixtures carry the
 * "indoors" read instead.
 *
 * Coordinates are the contract for behavior/officeMap.ts. Repeated elements — window mullions,
 * ceiling panels, skyline blocks, books — are InstancedMesh so they cost one draw call each.
 *
 * Real shadows are reserved for the characters. Props are grounded with cheap contact discs,
 * which is the single biggest shadow-pass saving in the scene.
 */

import { useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Text } from '@react-three/drei';
import type { AgentRole } from '@/types';
import { GEO, WORLD, screenMaterial } from '@/assets/materials';
import { ROOMS } from '@/behavior/officeMap';

const ROOM = { minX: -10.5, maxX: 10.5, minZ: -9.5, maxZ: 9.5, height: 3.9 };
const DESK_Y = 0.75;

/** Fills an InstancedMesh once on mount. Transforms never change, so this runs a single time. */
function useInstances(
  count: number,
  build: (dummy: THREE.Object3D, index: number) => void,
): React.RefObject<THREE.InstancedMesh> {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < count; i += 1) {
      dummy.position.set(0, 0, 0);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      build(dummy, i);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    // Flagged once after the whole batch, not per instance.
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [count, build]);
  return ref;
}

/** Flat dark disc standing in for a real shadow under small props. */
function Contact({ position, radius }: { position: [number, number, number]; radius: number }) {
  return (
    <mesh
      position={position}
      rotation={[-Math.PI / 2, 0, 0]}
      scale={radius}
      geometry={GEO.contactDisc}
      material={WORLD.contactShadow}
      renderOrder={-1}
    />
  );
}

function Desk({ position, role }: { position: [number, number]; role: AgentRole }) {
  const [x, z] = position;
  const screen = useMemo(() => screenMaterial(role), [role]);
  return (
    <group position={[x, 0, z]}>
      <mesh material={WORLD.deskTop} position={[0, DESK_Y, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.8, 0.065, 0.95]} />
      </mesh>
      {/* Panel-leg frame rather than four sticks: reads as furniture, and it is 2 meshes not 4. */}
      {[-0.82, 0.82].map((lx) => (
        <mesh key={lx} material={WORLD.deskFrame} position={[lx, DESK_Y / 2, 0]}>
          <boxGeometry args={[0.055, DESK_Y, 0.8]} />
        </mesh>
      ))}
      <mesh material={WORLD.deskFrame} position={[0, 0.14, -0.3]}>
        <boxGeometry args={[1.5, 0.04, 0.05]} />
      </mesh>
      {/* modesty panel */}
      <mesh material={WORLD.deskFrame} position={[0, DESK_Y - 0.26, -0.42]}>
        <boxGeometry args={[1.6, 0.36, 0.03]} />
      </mesh>

      {/* monitor on an arm, angled at whoever stands on the +Z side */}
      <group position={[0, DESK_Y + 0.04, -0.22]}>
        <mesh material={WORLD.monitorShell} position={[0, 0.02, 0]}>
          <cylinderGeometry args={[0.12, 0.14, 0.025, 10]} />
        </mesh>
        <mesh material={WORLD.monitorShell} position={[0, 0.17, -0.02]} rotation={[-0.12, 0, 0]}>
          <boxGeometry args={[0.04, 0.3, 0.04]} />
        </mesh>
        <mesh material={WORLD.monitorShell} position={[0, 0.44, 0.01]} rotation={[0.14, 0, 0]}>
          <boxGeometry args={[0.86, 0.5, 0.035]} />
        </mesh>
        <mesh material={screen} position={[0, 0.441, 0.032]} rotation={[0.14, 0, 0]}>
          <planeGeometry args={[0.79, 0.44]} />
        </mesh>
      </group>

      <mesh material={WORLD.peripheral} position={[0, DESK_Y + 0.045, 0.24]}>
        <boxGeometry args={[0.5, 0.022, 0.17]} />
      </mesh>
      <mesh material={WORLD.peripheral} position={[0.36, DESK_Y + 0.05, 0.24]} scale={[1, 0.55, 1.3]}>
        <sphereGeometry args={[0.038, 8, 6]} />
      </mesh>
      {/* mug: small props at desk height sell scale */}
      <mesh material={WORLD.paper} position={[-0.6, DESK_Y + 0.085, 0.16]}>
        <cylinderGeometry args={[0.045, 0.04, 0.1, 10]} />
      </mesh>

      {/* Task chair, rolled aside rather than tucked in: the standing waypoint is directly
          in front of the desk, and a chair there would intersect the character. */}
      <group position={[0.82, 0, 1.28]} rotation={[0, -0.5, 0]}>
        <mesh material={WORLD.peripheral} position={[0, 0.68, 0]}>
          <cylinderGeometry args={[0.24, 0.23, 0.08, 14]} />
        </mesh>
        <mesh material={WORLD.peripheral} position={[0, 0.94, -0.19]} rotation={[-0.18, 0, 0]}>
          <boxGeometry args={[0.4, 0.38, 0.055]} />
        </mesh>
        <mesh material={WORLD.metal} position={[0, 0.34, 0]}>
          <cylinderGeometry args={[0.035, 0.035, 0.68, 8]} />
        </mesh>
        {/* foot ring, the giveaway detail of a drafting stool */}
        <mesh material={WORLD.metal} position={[0, 0.3, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.2, 0.014, 6, 16]} />
        </mesh>
        <mesh material={WORLD.metal} position={[0, 0.03, 0]}>
          <cylinderGeometry args={[0.26, 0.28, 0.05, 10]} />
        </mesh>
        <Contact position={[0, 0.006, 0]} radius={0.32} />
      </group>

      <Contact position={[0, 0.006, 0]} radius={1.0} />
    </group>
  );
}

/** Floor-to-ceiling glazing on the -X wall, with a skyline behind it. */
function WindowWall() {
  const mullionCount = 9;
  const mullions = useInstances(
    mullionCount,
    (d, i) => {
      d.position.set(ROOM.minX + 0.06, ROOM.height / 2, ROOM.minZ + 1 + i * 2.1);
      d.scale.set(0.09, ROOM.height, 0.14);
    },
  );

  const buildingCount = 34;
  const buildings = useInstances(
    buildingCount,
    (d, i) => {
      // Deterministic pseudo-random so the skyline is stable across reloads.
      const r1 = Math.sin(i * 12.9898) * 43758.5453;
      const r2 = Math.sin(i * 78.233) * 12345.6789;
      const f1 = r1 - Math.floor(r1);
      const f2 = r2 - Math.floor(r2);
      const height = 2.5 + f1 * 11;
      const depth = -16 - f2 * 22;
      d.position.set(ROOM.minX - 4 - f2 * 6, height / 2 - 1.5, depth + i * 1.4);
      d.scale.set(1.4 + f2 * 1.8, height, 1.4 + f1 * 1.6);
    },
  );

  return (
    <group>
      <mesh material={WORLD.glass} position={[ROOM.minX + 0.02, ROOM.height / 2, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[ROOM.maxZ - ROOM.minZ, ROOM.height]} />
      </mesh>
      <instancedMesh ref={mullions} args={[GEO.unitBox, WORLD.wallTrim, mullionCount]} />
      {/* head and sill rails */}
      {[0.06, ROOM.height - 0.06].map((y) => (
        <mesh key={y} material={WORLD.wallTrim} position={[ROOM.minX + 0.06, y, 0]}>
          <boxGeometry args={[0.16, 0.12, ROOM.maxZ - ROOM.minZ]} />
        </mesh>
      ))}
      <instancedMesh ref={buildings} args={[GEO.unitBox, WORLD.skyline, buildingCount]} frustumCulled={false} />
    </group>
  );
}

function Shelving({ position }: { position: [number, number, number] }) {
  const bookCount = 26;
  const books = useInstances(bookCount, (d, i) => {
    const shelf = Math.floor(i / 9);
    const slot = i % 9;
    const r = Math.sin(i * 45.233) * 9876.54;
    const f = r - Math.floor(r);
    d.position.set(-0.55 + slot * 0.135, 0.52 + shelf * 0.58 + (0.14 + f * 0.1) / 2, 0);
    d.scale.set(0.06 + f * 0.05, 0.22 + f * 0.1, 0.2);
    d.rotation.z = f > 0.85 ? 0.22 : 0;
  });

  return (
    <group position={position}>
      {[0.42, 1.0, 1.58, 2.06].map((y) => (
        <mesh key={y} material={WORLD.deskTop} position={[0, y, 0]}>
          <boxGeometry args={[1.5, 0.05, 0.3]} />
        </mesh>
      ))}
      {[-0.74, 0.74].map((x) => (
        <mesh key={x} material={WORLD.deskFrame} position={[x, 1.05, 0]}>
          <boxGeometry args={[0.05, 2.1, 0.3]} />
        </mesh>
      ))}
      <instancedMesh ref={books} args={[GEO.unitBox, WORLD.floorInlay, bookCount]} />
      <Contact position={[0, 0.006, 0]} radius={0.9} />
    </group>
  );
}

function Plant({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      <mesh material={WORLD.plantPot} position={[0, 0.24, 0]}>
        <cylinderGeometry args={[0.24, 0.18, 0.48, 12]} />
      </mesh>
      <mesh material={WORLD.plantLeaf} position={[0, 0.82, 0]} scale={[1, 1.4, 1]}>
        <sphereGeometry args={[0.32, 10, 8]} />
      </mesh>
      <mesh material={WORLD.plantLeaf} position={[0.2, 0.66, 0.1]} scale={[0.72, 1.1, 0.72]}>
        <sphereGeometry args={[0.26, 8, 6]} />
      </mesh>
      <mesh material={WORLD.plantLeaf} position={[-0.17, 0.7, -0.12]} scale={[0.66, 1, 0.66]}>
        <sphereGeometry args={[0.24, 8, 6]} />
      </mesh>
      <Contact position={[0, 0.006, 0]} radius={0.42} />
    </group>
  );
}

/**
 * A glass partition wall: low solid base, glazing above, metal head rail.
 *
 * Length runs along X when `axis` is 'x', along Z otherwise. Walls stop short of their doorway;
 * the gaps are load-bearing for navigation, since behavior/officeMap models the same spans as
 * obstacles and a character can only enter through the gap.
 */
function GlassWall({
  center,
  length,
  axis,
  height = 2.5,
}: {
  center: [number, number];
  length: number;
  axis: 'x' | 'z';
  height?: number;
}) {
  const [cx, cz] = center;
  const size: [number, number, number] = axis === 'x' ? [length, 1, 0.08] : [0.08, 1, length];
  return (
    <group position={[cx, 0, cz]}>
      <mesh material={WORLD.wallTrim} position={[0, 0.07, 0]} scale={[size[0], 0.14, size[2]]} geometry={GEO.unitBox} />
      <mesh material={WORLD.glass} position={[0, height / 2 + 0.1, 0]} scale={[size[0], height - 0.2, size[2] * 0.6]} geometry={GEO.unitBox} />
      <mesh material={WORLD.wallTrim} position={[0, height + 0.04, 0]} scale={[size[0], 0.08, size[2]]} geometry={GEO.unitBox} />
    </group>
  );
}

/** A room sign, floated against the wall so the rooms read as rooms and not as glass boxes. */
function RoomSign({ position, rotation, label }: { position: [number, number, number]; rotation: number; label: string }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh material={WORLD.wallTrim}>
        <boxGeometry args={[1.5, 0.34, 0.05]} />
      </mesh>
      <Text position={[0, 0, 0.032]} fontSize={0.17} color="#cbd5e1" anchorX="center" anchorY="middle">
        {label}
      </Text>
    </group>
  );
}

export function Office() {
  const panelCount = 10;
  const panels = useInstances(panelCount, (d, i) => {
    const col = i % 5;
    const row = Math.floor(i / 5);
    d.position.set(-7 + col * 3.5, ROOM.height - 0.22, -6 + row * 6);
    d.scale.set(2.2, 0.06, 0.7);
  });

  // Meeting chairs: 6 in the meeting room, 2 in the office. Instanced in three batches so eight
  // chairs cost three draw calls instead of twenty-four.
  // Read straight from the navigation map: a chair drawn anywhere other than where an agent is
  // routed to sit is a bug nobody notices until someone sits on the floor.
  const chairSpots = useMemo(
    () =>
      Object.values(ROOMS).flatMap((room) =>
        room.seats.map((seat) => ({
          seat: [seat.x, seat.z] as [number, number],
          focus: [room.focus.x, room.focus.z] as [number, number],
          height: room.seatHeight,
        })),
      ),
    [],
  );

  const seatBuilder = useCallback(
    (d: THREE.Object3D, i: number) => {
      const { seat, focus, height } = chairSpots[i];
      d.position.set(seat[0], height - 0.035, seat[1]);
      d.rotation.y = Math.atan2(focus[0] - seat[0], focus[1] - seat[1]);
      d.scale.set(0.46, 0.07, 0.44);
    },
    [chairSpots],
  );
  const backBuilder = useCallback(
    (d: THREE.Object3D, i: number) => {
      const { seat, focus, height } = chairSpots[i];
      const yaw = Math.atan2(focus[0] - seat[0], focus[1] - seat[1]);
      // Backrest sits behind the occupant, i.e. away from the table.
      d.position.set(seat[0] - Math.sin(yaw) * 0.2, height + 0.27, seat[1] - Math.cos(yaw) * 0.2);
      d.rotation.y = yaw;
      d.scale.set(0.44, 0.48, 0.06);
    },
    [chairSpots],
  );
  const stemBuilder = useCallback(
    (d: THREE.Object3D, i: number) => {
      const { seat, height } = chairSpots[i];
      d.position.set(seat[0], (height - 0.07) / 2, seat[1]);
      d.scale.set(0.07, height - 0.07, 0.07);
    },
    [chairSpots],
  );

  const seats = useInstances(chairSpots.length, seatBuilder);
  const backs = useInstances(chairSpots.length, backBuilder);
  const stems = useInstances(chairSpots.length, stemBuilder);

  return (
    <group>
      {/* ---------- floor ---------- */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} material={WORLD.floor} receiveShadow>
        <planeGeometry args={[ROOM.maxX - ROOM.minX, ROOM.maxZ - ROOM.minZ]} />
      </mesh>
      {/* Carpet inside each enclosed room, so the rooms read from above. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-6.45, 0.006, -6.72]} material={WORLD.rug} receiveShadow>
        <planeGeometry args={[6.1, 4.25]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[6.95, 0.006, -7.22]} material={WORLD.rug} receiveShadow>
        <planeGeometry args={[5.1, 3.25]} />
      </mesh>
      {/* Lounge rug in the open plan */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008, 5.2]} material={WORLD.floorInlay} receiveShadow>
        <circleGeometry args={[2.3, 28]} />
      </mesh>

      {/* ---------- open-plan desks ---------- */}
      {/* Coordinates mirror DESKS in behavior/officeMap; moving one without the other strands
          its owner in front of empty floor. */}
      <Desk position={[-3, 2]} role="ceo" />
      <Desk position={[3, 2]} role="project_manager" />
      <Desk position={[-6.5, -1.5]} role="designer" />
      <Desk position={[6.5, -1.5]} role="developer" />

      {/* ---------- meeting room (back left) ---------- */}
      <group>
        {/* South wall stops at x=-5.8; the gap from there to the east wall is the doorway. */}
        <GlassWall center={[-7.65, -4.6]} length={3.7} axis="x" />
        <GlassWall center={[-3.4, -6.72]} length={4.25} axis="z" />
        <RoomSign position={[-3.4, 2.15, -5.0]} rotation={Math.PI / 2} label="MEETING ROOM" />

        {/* long table */}
        <mesh material={WORLD.deskTop} position={[-6.5, 0.74, -6.7]} castShadow receiveShadow>
          <boxGeometry args={[2.6, 0.08, 1.1]} />
        </mesh>
        {[[-1.1, -0.4], [1.1, -0.4], [-1.1, 0.4], [1.1, 0.4]].map(([dx, dz]) => (
          <mesh key={`${dx}-${dz}`} material={WORLD.deskFrame} position={[-6.5 + dx, 0.37, -6.7 + dz]}>
            <boxGeometry args={[0.07, 0.74, 0.07]} />
          </mesh>
        ))}
        {/* Whiteboard on the building wall inside the room */}
        <group position={[-6.5, 0, ROOM.minZ + 0.06]}>
          <mesh material={WORLD.wallTrim} position={[0, 1.6, 0]}>
            <boxGeometry args={[3.2, 1.9, 0.06]} />
          </mesh>
          <mesh material={WORLD.paper} position={[0, 1.6, 0.04]}>
            <planeGeometry args={[3.0, 1.72]} />
          </mesh>
        </group>
        <Contact position={[-6.5, 0.01, -6.7]} radius={1.6} />
      </group>

      {/* ---------- office / despacho (back right) ---------- */}
      <group>
        <GlassWall center={[6.0, -5.6]} length={3.2} axis="x" />
        <GlassWall center={[4.4, -7.22]} length={3.25} axis="z" />
        <RoomSign position={[4.4, 2.15, -5.95]} rotation={-Math.PI / 2} label="OFFICE" />

        <mesh material={WORLD.deskTop} position={[7.0, 0.74, -7.6]} castShadow receiveShadow>
          <boxGeometry args={[1.2, 0.08, 0.8]} />
        </mesh>
        <mesh material={WORLD.deskFrame} position={[7.0, 0.37, -7.6]}>
          <cylinderGeometry args={[0.09, 0.22, 0.74, 12]} />
        </mesh>
        {/* A single framed print: the detail that makes a glass box read as someone's office. */}
        <mesh material={WORLD.wallTrim} position={[7.0, 1.7, ROOM.minZ + 0.06]}>
          <boxGeometry args={[1.0, 0.72, 0.05]} />
        </mesh>
        <mesh material={WORLD.panelLight} position={[7.0, 1.7, ROOM.minZ + 0.09]}>
          <planeGeometry args={[0.86, 0.58]} />
        </mesh>
        <Contact position={[7.0, 0.01, -7.6]} radius={0.9} />
      </group>

      {/* Chairs for both rooms, three instanced batches. */}
      <instancedMesh ref={seats} args={[GEO.unitBox, WORLD.peripheral, chairSpots.length]} />
      <instancedMesh ref={backs} args={[GEO.unitBox, WORLD.peripheral, chairSpots.length]} />
      <instancedMesh ref={stems} args={[GEO.unitBox, WORLD.metal, chairSpots.length]} />

      {/* ---------- open-plan props ---------- */}
      {/* lounge */}
      <group position={[0, 0, 5.2]}>
        <mesh material={WORLD.deskTop} position={[0, 0.42, 0]}>
          <cylinderGeometry args={[0.66, 0.62, 0.07, 18]} />
        </mesh>
        <mesh material={WORLD.metal} position={[0, 0.2, 0]}>
          <cylinderGeometry args={[0.08, 0.18, 0.42, 10]} />
        </mesh>
        <Contact position={[0, 0.012, 0]} radius={0.75} />
      </group>

      {/* water cooler */}
      <group position={[9.6, 0, 3.1]}>
        <mesh material={WORLD.peripheral} position={[0, 0.46, 0]} castShadow>
          <boxGeometry args={[0.38, 0.92, 0.38]} />
        </mesh>
        <mesh material={WORLD.glass} position={[0, 1.2, 0]}>
          <cylinderGeometry args={[0.19, 0.21, 0.52, 14]} />
        </mesh>
        <Contact position={[0, 0.01, 0]} radius={0.34} />
      </group>

      <Shelving position={[9.6, 0, 6.6]} />
      <Plant position={[-9.6, 0, 7.6]} scale={1.15} />
      <Plant position={[9.6, 0, -2.6]} scale={0.95} />

      {/* ---------- building shell ---------- */}
      <mesh material={WORLD.wall} position={[0, ROOM.height / 2, ROOM.minZ]} receiveShadow>
        <planeGeometry args={[ROOM.maxX - ROOM.minX, ROOM.height]} />
      </mesh>
      <mesh material={WORLD.wallTrim} position={[0, 0.07, ROOM.minZ + 0.03]}>
        <boxGeometry args={[ROOM.maxX - ROOM.minX, 0.14, 0.06]} />
      </mesh>

      <WindowWall />

      {/* Suspended light fixtures. No ceiling slab: it would hide the room from this camera. */}
      <instancedMesh ref={panels} args={[GEO.unitBox, WORLD.panelLight, panelCount]} />
    </group>
  );
}
