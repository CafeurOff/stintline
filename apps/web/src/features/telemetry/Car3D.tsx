import { useEffect, useMemo } from "react";
import { BufferAttribute, BufferGeometry, Quaternion, Vector3 } from "three";

import {
  ARMS,
  CHASSIS,
  ENGINE_COVER,
  FLOOR,
  loft,
  type Mesh,
  PLATES,
  SIDEPODS,
  WHEELS,
} from "./carShape";

const CARBON = "#1b1d23";
const TYRE = "#121316";
const RIM = "#8a8f99";
const HELMET = "#f2f2f2";
const ARM_RADIUS = 0.018;

function geometry(mesh: Mesh): BufferGeometry {
  const out = new BufferGeometry();
  out.setAttribute("position", new BufferAttribute(mesh.positions, 3));
  out.setIndex(new BufferAttribute(mesh.indices, 1));
  out.computeVertexNormals();
  return out;
}

/** Shapes shared by every car: built once, painted per car. */
function useBodywork() {
  const parts = useMemo(
    () => ({
      chassis: geometry(loft(CHASSIS)),
      sidepods: geometry(loft(SIDEPODS)),
      cover: geometry(loft(ENGINE_COVER)),
      floor: geometry(loft(FLOOR, 16, 6)),
    }),
    [],
  );
  useEffect(
    () => () => {
      Object.values(parts).forEach((part) => {
        part.dispose();
      });
    },
    [parts],
  );
  return parts;
}

/** Where and how to place a thin rod between two points (a suspension arm). */
function rod(from: readonly number[], to: readonly number[]) {
  const a = new Vector3(from[0], from[1], from[2]);
  const b = new Vector3(to[0], to[1], to[2]);
  const direction = b.clone().sub(a);
  const length = direction.length();
  const rotation = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), direction.normalize());
  const middle = a.add(b).multiplyScalar(0.5);
  return { middle, length, rotation };
}

/**
 * Our own low-poly single-seater in the team colour (shapes in `carShape.ts`): lofted
 * nose, survival cell, sidepods and engine cover; floor, wings and endplates; tyres with
 * rims; wishbones; halo and helmet; a soft shadow. A team-mate gets a white stripe.
 * `unit` is scene units per metre.
 */
export function Car3D({
  colour,
  striped,
  unit,
}: {
  colour: string;
  striped: boolean;
  unit: number;
}) {
  const body = useBodywork();
  const arms = useMemo(() => ARMS.map((arm) => rod(arm.from, arm.to)), []);
  const paint = { color: colour, roughness: 0.35, metalness: 0.25 } as const;
  const carbon = { color: CARBON, roughness: 0.55, metalness: 0.2 } as const;
  return (
    <group scale={unit}>
      <mesh
        position={[-0.1, 0.01, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[3.1, 1.25, 1]}
        renderOrder={-1}
      >
        <circleGeometry args={[1, 32]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.3} depthWrite={false} />
      </mesh>
      <mesh geometry={body.floor}>
        <meshStandardMaterial {...carbon} />
      </mesh>
      <mesh geometry={body.chassis}>
        <meshStandardMaterial {...paint} />
      </mesh>
      <mesh geometry={body.sidepods}>
        <meshStandardMaterial {...paint} />
      </mesh>
      <mesh geometry={body.cover}>
        <meshStandardMaterial {...paint} />
      </mesh>
      {striped && (
        <mesh position={[-0.6, 0.9, 0]} rotation={[0, 0, -0.18]}>
          <boxGeometry args={[1.4, 0.02, 0.1]} />
          <meshStandardMaterial color="#ffffff" roughness={0.4} />
        </mesh>
      )}
      {PLATES.map((plate, index) => (
        <mesh key={index} position={plate.at} rotation={[0, 0, plate.pitch ?? 0]}>
          <boxGeometry args={plate.size} />
          <meshStandardMaterial {...(plate.paint === "team" ? paint : carbon)} />
        </mesh>
      ))}
      {arms.map((arm, index) => (
        <mesh key={index} position={arm.middle} quaternion={arm.rotation}>
          <cylinderGeometry args={[ARM_RADIUS, ARM_RADIUS, arm.length, 6]} />
          <meshStandardMaterial {...carbon} />
        </mesh>
      ))}
      {WHEELS.map((wheel) => (
        <group
          key={`${String(wheel.x)}:${String(wheel.z)}`}
          position={[wheel.x, wheel.radius, wheel.z]}
        >
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[wheel.radius, wheel.radius, wheel.width, 24]} />
            <meshStandardMaterial color={TYRE} roughness={0.9} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry
              args={[wheel.radius * 0.62, wheel.radius * 0.62, wheel.width + 0.01, 16]}
            />
            <meshStandardMaterial color={RIM} roughness={0.3} metalness={0.8} />
          </mesh>
        </group>
      ))}
      <mesh position={[0.32, 0.7, 0]}>
        <sphereGeometry args={[0.13, 16, 12]} />
        <meshStandardMaterial color={HELMET} roughness={0.3} />
      </mesh>
      <mesh position={[0.4, 0.8, 0]} rotation={[-Math.PI / 2, 0, -Math.PI / 2]}>
        <torusGeometry args={[0.32, 0.035, 8, 24, Math.PI]} />
        <meshStandardMaterial {...carbon} />
      </mesh>
      <mesh position={[0.74, 0.7, 0]} rotation={[0, 0, -0.35]}>
        <boxGeometry args={[0.05, 0.22, 0.05]} />
        <meshStandardMaterial {...carbon} />
      </mesh>
    </group>
  );
}
