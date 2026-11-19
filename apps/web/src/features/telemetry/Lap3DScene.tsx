import type { Schema } from "@stintline/api-types";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  type Group,
  type PerspectiveCamera,
  SRGBColorSpace,
  Vector3,
} from "three";

import type { CarStyle } from "./colours";
import type { ReplayClock } from "./playback";
import {
  carPose,
  GROUND_LEVEL,
  heading,
  type Pose,
  trackEmbankments,
  trackPoint,
  trackRibbon,
  tracksidePost,
} from "./track3d";

type Compare = Schema<"TelemetryCompare">;
export type CameraMode = "chase" | "top" | "trackside";

/** Chase camera: this far behind the car and above it, looking this far ahead (metres). */
const CHASE_BACK_M = 14;
const CHASE_UP_M = 4.5;
const CHASE_AHEAD_M = 18;
/** Top camera: room kept around the circuit, and how far it leans back (radians from
 * straight down) so the relief still reads. */
const TOP_MARGIN = 1.15;
const TOP_TILT = 0.3;
/** Share of the gap to the target position the camera closes each frame at 60 fps. */
const CAMERA_EASE = 0.15;
/** Edge lines sit this high above the track (scene units). */
const EDGE_LIFT = 0.08;
/** Fog from and to these distances (shares of the circuit's longest side): the edge of
 * the ground fades into the background, and the top view stays clear. */
const FOG_NEAR = 1.4;
const FOG_FAR = 3.5;
const GRASS = "#2c3a2e";
/** Ground size, in circuit lengths. */
const GROUND = 8;
/** Trackside posts: one every this many metres, set back and raised (metres). */
const TRACKSIDE_EVERY_M = 180;
const TRACKSIDE_SET_BACK_M = 30;
const TRACKSIDE_HEIGHT_M = 6;
/** Vertical field of view in degrees: a long lens by the track, a wider one behind. */
const TRACKSIDE_FOV = 24;
const CHASE_FOV = 50;

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
  const ribbon = useMemo(() => {
    const { positions, indices } = trackRibbon(data);
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    geometry.setIndex(new BufferAttribute(indices, 1));
    // The track is drawn almost flat: normals straight up keep it evenly lit, even where
    // the ribbon folds over itself in a hairpin (computed normals flip there and go black).
    const normals = new Float32Array(positions.length);
    for (let i = 1; i < normals.length; i += 3) normals[i] = 1;
    geometry.setAttribute("normal", new BufferAttribute(normals, 3));
    return geometry;
  }, [data]);
  // White lines along both edges of the track: they give the sense of speed and shape.
  const edges = useMemo(() => {
    const vertices = ribbon.getAttribute("position").array;
    const count = vertices.length / 6;
    const lines = new Float32Array(count * 12);
    for (let i = 0; i < count; i++) {
      const next = (i + 1) % count;
      for (const side of [0, 3]) {
        lines.set(vertices.slice(i * 6 + side, i * 6 + side + 3), i * 12 + side * 2);
        lines.set(vertices.slice(next * 6 + side, next * 6 + side + 3), i * 12 + side * 2 + 3);
      }
    }
    // Just above the asphalt, so the lines never flicker into it.
    for (let i = 1; i < lines.length; i += 3) lines[i] = (lines[i] ?? 0) + EDGE_LIFT;
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(lines, 3));
    return geometry;
  }, [ribbon]);
  const hills = useMemo(() => {
    const { positions, indices } = trackEmbankments(
      ribbon.getAttribute("position").array as Float32Array,
    );
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    geometry.setIndex(new BufferAttribute(indices, 1));
    geometry.computeVertexNormals();
    // Slopes face the sky: one side is wound the other way, so its normals point down.
    const normals = geometry.getAttribute("normal");
    for (let i = 0; i < normals.count; i++) {
      if (normals.getY(i) < 0) {
        normals.setXYZ(i, -normals.getX(i), -normals.getY(i), -normals.getZ(i));
      }
    }
    return geometry;
  }, [ribbon]);
  useEffect(
    () => () => {
      ribbon.dispose();
      edges.dispose();
      hills.dispose();
    },
    [ribbon, edges, hills],
  );
  const span = Math.max(data.width, data.height);
  const unit = 1 / data.metres_per_unit;
  const start = trackPoint(data, 0);

  useFrame((_, delta) => {
    const time = clock.tick(delta);
    const poses: Pose[] = data.cars.map((car) => carPose(data, car, time));
    poses.forEach((pose, index) => {
      const group = cars.current[index];
      if (group) {
        group.position.set(pose.x, pose.y, pose.z);
        group.rotation.set(0, pose.yaw, pose.pitch, "YZX");
      }
      markers.current[index]?.position.set(pose.x, pose.y, pose.z);
    });
    const followed = poses[follow] ?? poses[0];
    if (!followed) return;
    const ease = 1 - Math.pow(1 - CAMERA_EASE, delta * 60);
    const perspective = view as PerspectiveCamera;
    if (camera === "top") {
      // Far enough for the whole circuit to fit the panel, whatever its shape.
      const half = Math.tan((perspective.fov * Math.PI) / 360);
      const fit = Math.max(data.height / 2, data.width / 2 / perspective.aspect) / half;
      const distance = fit * TOP_MARGIN;
      perspective.position.lerp(
        new Vector3(0, distance * Math.cos(TOP_TILT), distance * Math.sin(TOP_TILT)),
        ease,
      );
      target.current.lerp(new Vector3(0, 0, 0), ease);
    } else if (camera === "chase") {
      const ahead = heading(followed);
      perspective.position.lerp(
        new Vector3(
          followed.x - ahead.x * CHASE_BACK_M * unit,
          followed.y + CHASE_UP_M * unit,
          followed.z - ahead.z * CHASE_BACK_M * unit,
        ),
        ease,
      );
      target.current.set(
        followed.x + ahead.x * CHASE_AHEAD_M * unit,
        followed.y,
        followed.z + ahead.z * CHASE_AHEAD_M * unit,
      );
    } else {
      const post = tracksidePost(
        data,
        followed.index,
        TRACKSIDE_EVERY_M,
        TRACKSIDE_SET_BACK_M,
        TRACKSIDE_HEIGHT_M,
      );
      perspective.position.set(post.x, post.y, post.z);
      target.current.set(followed.x, followed.y, followed.z);
    }
    const fov = camera === "trackside" ? TRACKSIDE_FOV : CHASE_FOV;
    if (Math.abs(perspective.getEffectiveFOV() - fov) > 0.01) {
      // A method call, not a field write: it also updates the projection.
      perspective.setFocalLength(
        (0.5 * perspective.getFilmHeight()) / Math.tan((fov * Math.PI) / 360),
      );
    }
    perspective.lookAt(target.current);
  });

  return (
    <>
      <fog attach="fog" args={[background, span * FOG_NEAR, span * FOG_FAR]} />
      <mesh geometry={hills}>
        <meshStandardMaterial color={GRASS} roughness={1} side={2} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, GROUND_LEVEL, 0]}>
        <planeGeometry args={[span * GROUND, span * GROUND]} />
        <meshStandardMaterial color={GRASS} roughness={1} />
      </mesh>
      <mesh geometry={ribbon}>
        <meshStandardMaterial color="#3d4048" roughness={0.9} side={2} />
      </mesh>
      <lineSegments geometry={edges}>
        <lineBasicMaterial color="#e8e8e8" />
      </lineSegments>
      <mesh position={[start.x, start.y + 0.05, start.z]}>
        <boxGeometry args={[1.2 * unit, 0.1, 16 * unit]} />
        <meshStandardMaterial color="#f4f4f4" />
      </mesh>
      {data.cars.map((car, index) => (
        <group key={car.car_number}>
          <group
            ref={(node) => {
              cars.current[index] = node;
            }}
          >
            <CarModel
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

/**
 * An original low-poly single-seater, built from boxes and cylinders at real size
 * (5.6 m long, 2 m wide): nose, chassis, sidepods, engine cover, wings, wheels and halo.
 * Local axes: +x forward, +y up. `unit` is scene units per metre.
 */
function CarModel({ colour, striped, unit }: { colour: string; striped: boolean; unit: number }) {
  const dark = "#15171c";
  const parts: { size: [number, number, number]; at: [number, number, number]; colour: string }[] =
    [
      { size: [4.6, 0.06, 1.4], at: [0, 0.08, 0], colour: dark },
      { size: [2.7, 0.55, 0.8], at: [0.1, 0.45, 0], colour },
      { size: [1.7, 0.28, 0.36], at: [2.0, 0.32, 0], colour },
      { size: [1.6, 0.42, 1.5], at: [-0.3, 0.36, 0], colour },
      { size: [1.5, 0.5, 0.42], at: [-0.9, 0.85, 0], colour },
      { size: [0.45, 0.05, 1.9], at: [2.75, 0.15, 0], colour: dark },
      { size: [0.08, 0.2, 1.9], at: [2.95, 0.22, 0], colour },
      { size: [0.35, 0.06, 1.05], at: [-2.45, 0.95, 0], colour },
      { size: [0.5, 0.45, 0.04], at: [-2.4, 0.8, 0.52], colour: dark },
      { size: [0.5, 0.45, 0.04], at: [-2.4, 0.8, -0.52], colour: dark },
    ];
  if (striped) parts.push({ size: [2.6, 0.02, 0.18], at: [0.6, 0.73, 0], colour: "#ffffff" });
  const wheels: [number, number][] = [
    [1.8, 0.8],
    [1.8, -0.8],
    [-1.6, 0.8],
    [-1.6, -0.8],
  ];
  return (
    <group scale={unit}>
      {parts.map((part, index) => (
        <mesh key={index} position={part.at}>
          <boxGeometry args={part.size} />
          <meshStandardMaterial color={part.colour} roughness={0.5} metalness={0.2} />
        </mesh>
      ))}
      {wheels.map(([x, z]) => (
        <mesh
          key={`${String(x)}${String(z)}`}
          position={[x, 0.36, z]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <cylinderGeometry args={[0.36, 0.36, 0.38, 14]} />
          <meshStandardMaterial color={dark} roughness={0.8} />
        </mesh>
      ))}
      <mesh position={[0.55, 0.92, 0]} rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[0.36, 0.04, 6, 16, Math.PI]} />
        <meshStandardMaterial color={dark} />
      </mesh>
    </group>
  );
}

/** Driver code above a car in the top view, always facing the camera. */
function Label({ text, colour, height }: { text: string; colour: string; height: number }) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 64;
    const context = canvas.getContext("2d");
    if (context) {
      context.fillStyle = colour;
      context.beginPath();
      context.roundRect(4, 4, 120, 56, 12);
      context.fill();
      context.fillStyle = "#0b0d12";
      context.font = "bold 36px sans-serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(text, 64, 34);
    }
    const out = new CanvasTexture(canvas);
    out.colorSpace = SRGBColorSpace;
    return out;
  }, [text, colour]);
  useEffect(
    () => () => {
      texture.dispose();
    },
    [texture],
  );
  return (
    <sprite position={[0, height * 1.1, 0]} scale={[height * 2, height, 1]}>
      <spriteMaterial map={texture} depthTest={false} />
    </sprite>
  );
}
