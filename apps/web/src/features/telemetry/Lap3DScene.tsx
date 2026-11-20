import type { Schema } from "@stintline/api-types";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import { type Group, type PerspectiveCamera, Vector3 } from "three";

import { Car3D } from "./Car3D";
import { type CameraMode, moveCamera } from "./cameraRig";
import { CircuitWorld, Label } from "./CircuitWorld";
import type { CarStyle } from "./colours";
import type { ReplayClock } from "./playback";
import { carPose, type Pose, sideBySide } from "./track3d";

type Compare = Schema<"TelemetryCompare">;
export type { CameraMode } from "./cameraRig";

export interface Lap3DSceneProps {
  data: Compare;
  styles: readonly CarStyle[];
  clock: ReplayClock;
  camera: CameraMode;
  /** Car the chase and trackside cameras follow (index in `data.cars`). */
  follow: number;
  background: string;
  label: string;
}

/** The lap in 3D: the track with its relief, every car on its own line, three cameras. */
export default function Lap3DScene(props: Lap3DSceneProps) {
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

function World({ data, styles, clock, camera, follow, background }: Lap3DSceneProps) {
  const cars = useRef<(Group | null)[]>([]);
  const markers = useRef<(Group | null)[]>([]);
  const target = useRef(new Vector3());
  const { camera: view } = useThree();
  const span = Math.max(data.width, data.height);
  const unit = 1 / data.metres_per_unit;

  useFrame((_, delta) => {
    const time = clock.tick(delta);
    const poses: Pose[] = sideBySide(
      data,
      data.cars.map((car) => carPose(data, car, time)),
    );
    poses.forEach((pose, index) => {
      const group = cars.current[index];
      if (group) {
        group.position.set(pose.x, pose.y, pose.z);
        group.rotation.set(0, pose.yaw, pose.pitch, "YZX");
      }
      markers.current[index]?.position.set(pose.x, pose.y, pose.z);
    });
    const followed = poses[follow] ?? poses[0];
    if (followed) {
      moveCamera(view as PerspectiveCamera, target.current, data, camera, followed, delta);
    }
  });

  return (
    <>
      <CircuitWorld data={data} background={background} />
      {data.cars.map((car, index) => (
        <group key={car.car_number}>
          <group
            ref={(node) => {
              cars.current[index] = node;
            }}
          >
            <Car3D
              colour={styles[index]?.colour ?? "#cccccc"}
              striped={styles[index]?.dashed ?? false}
              unit={unit}
            />
          </group>
          <group
            visible={camera === "top"}
            ref={(node) => {
              markers.current[index] = node;
            }}
          >
            <mesh position={[0, 4 * unit, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[span * 0.012, 24]} />
              <meshBasicMaterial color={styles[index]?.colour ?? "#cccccc"} />
            </mesh>
            <Label
              text={car.entry.driver.code ?? String(car.car_number)}
              colour={styles[index]?.colour ?? "#cccccc"}
              height={span * 0.04}
            />
          </group>
        </group>
      ))}
    </>
  );
}
