import type { Schema } from "@stintline/api-types";
import { useEffect, useMemo } from "react";
import { BufferAttribute, BufferGeometry, CanvasTexture, SRGBColorSpace } from "three";

import { GROUND_LEVEL, startLine, TRACK_WIDTH_M, trackEmbankments, trackRibbon } from "./track3d";

type Compare = Schema<"TelemetryCompare">;

/** Edge lines sit this high above the track (scene units). */
const EDGE_LIFT = 0.08;
/** Fog from and to these distances (shares of the circuit's longest side): the edge of
 * the ground fades into the background, and the top view stays clear. */
const FOG_NEAR = 1.4;
const FOG_FAR = 3.5;
const GRASS = "#2c3a2e";
/** Ground size, in circuit lengths. */
const GROUND = 8;

/**
 * The circuit in 3D, shared by the lap and race views: the track with its relief and white
 * edges, the slopes under raised parts, the ground, the start line and the fog.
 */
export function CircuitWorld({ data, background }: { data: Compare; background: string }) {
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
    const count = vertices.length / 6 - 1;
    const lines = new Float32Array(count * 12);
    for (let i = 0; i < count; i++) {
      const next = i + 1;
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
  const start = startLine(data);

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
      <mesh
        position={[start.at.x, start.at.y + EDGE_LIFT, start.at.z]}
        rotation={[0, start.yaw, 0]}
      >
        <boxGeometry args={[1.2 * unit, 0.05, TRACK_WIDTH_M * unit]} />
        <meshStandardMaterial color="#f4f4f4" />
      </mesh>
    </>
  );
}

/** A driver code on a tag in the team colour, always facing the camera. */
export function Label({ text, colour, height }: { text: string; colour: string; height: number }) {
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
