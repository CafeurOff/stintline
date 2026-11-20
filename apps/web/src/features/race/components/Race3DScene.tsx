import type { Schema } from "@stintline/api-types";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { type Group, type PerspectiveCamera, Vector3 } from "three";

import { Car3D } from "@/features/telemetry/Car3D";
import { type CameraMode, moveCamera } from "@/features/telemetry/cameraRig";
import { CircuitWorld, Label } from "@/features/telemetry/CircuitWorld";

import { type RaceCar3D, racePoses } from "../race3d";

type Compare = Schema<"TelemetryCompare">;

/** The overview leans further back than the lap view: twenty cars read better at an angle. */
const OVERVIEW_TILT = 0.55;
/** Size of the ring under the followed car and of the ghost's ring (metres). */
const RING_M = 3.5;

export interface Race3DSceneProps {
  data: Compare;
  cars: readonly RaceCar3D[];
  /** Where the simulated car would be, as a share of its lap; `null` without simulation. */
  ghost: { fraction: number; code: string } | null;
  camera: CameraMode;
  background: string;
  label: string;
  onSelect: (carNumber: number) => void;
}

/** The race replay in 3D: every car on the track with its relief, three cameras. */
export default function Race3DScene(props: Race3DSceneProps) {
  return (
    <Canvas
      aria-label={props.label}
      role="img"
      camera={{ fov: 50, near: 0.5, far: 20000, position: [0, 800, 600] }}
      dpr={[1, 2]}
      gl={{ antialias: true }}
    >
      <color attach="background" args={[props.background]} />
      <hemisphereLight args={["#ffffff", "#40465a", 1.4]} />
      <directionalLight position={[400, 900, 300]} intensity={1.6} />
      <World {...props} />
    </Canvas>
  );
}

function World({ data, cars, ghost, camera, background, onSelect }: Race3DSceneProps) {
  const groups = useRef(new Map<number, Group>());
  const ghostGroup = useRef<Group>(null);
  const target = useRef(new Vector3());
  // The page re-renders on every replay frame; the frame loop reads the latest cars here.
  const latest = useRef({ cars, ghost });
  useEffect(() => {
    latest.current = { cars, ghost };
  });
  const { camera: view } = useThree();
  const span = Math.max(data.width, data.height);
  const unit = 1 / data.metres_per_unit;

  useFrame((_, delta) => {
    const now = latest.current;
    const poses = racePoses(data, [
      ...now.cars.map((car) => car.fraction),
      ...(now.ghost ? [now.ghost.fraction] : []),
    ]);
    now.cars.forEach((car, index) => {
      const pose = poses[index];
      const group = groups.current.get(car.carNumber);
      if (pose && group) {
        group.position.set(pose.x, pose.y, pose.z);
        group.rotation.set(0, pose.yaw, pose.pitch, "YZX");
      }
    });
    const ghostPose = now.ghost ? poses[now.cars.length] : undefined;
    if (ghostGroup.current) {
      ghostGroup.current.visible = Boolean(ghostPose);
      if (ghostPose) ghostGroup.current.position.set(ghostPose.x, ghostPose.y, ghostPose.z);
    }
    const followed =
      poses[
        Math.max(
          now.cars.findIndex((car) => car.selected),
          0,
        )
      ];
    if (followed) {
      moveCamera(
        view as PerspectiveCamera,
        target.current,
        data,
        camera,
        followed,
        delta,
        OVERVIEW_TILT,
      );
    }
  });

  return (
    <>
      <CircuitWorld data={data} background={background} />
      {cars.map((car) => (
        <group
          key={car.carNumber}
          ref={(node) => {
            if (node) groups.current.set(car.carNumber, node);
            else groups.current.delete(car.carNumber);
          }}
          onClick={(event) => {
            event.stopPropagation();
            onSelect(car.carNumber);
          }}
        >
          <Car3D colour={car.colour} striped={false} unit={unit} />
          {car.selected && (
            <mesh position={[0, 0.2 * unit, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[RING_M * 0.8 * unit, RING_M * unit, 32]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
          )}
          {camera === "top" && <Label text={car.code} colour={car.colour} height={span * 0.035} />}
        </group>
      ))}
      <group ref={ghostGroup} visible={false}>
        <mesh position={[0, 0.2 * unit, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[RING_M * 0.7 * unit, RING_M * unit, 32]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.6} />
        </mesh>
        {ghost && (
          <Label
            text={ghost.code}
            colour="#ffffff"
            height={camera === "top" ? span * 0.035 : 3 * unit}
          />
        )}
      </group>
    </>
  );
}
