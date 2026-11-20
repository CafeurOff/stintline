import { lazy, Suspense, useState } from "react";

import { PillSwitch } from "@/components/layout/Glass";
import { Skeleton } from "@/components/ui/Skeleton";
import { useTelemetryCompare, useTelemetryLaps } from "@/features/telemetry/api";
import type { CameraMode } from "@/features/telemetry/cameraRig";
import { ELEVATION_EXAGGERATION, trackElevation } from "@/features/telemetry/track3d";
import { hasWebGL } from "@/features/telemetry/webgl";
import { useI18n } from "@/lib/i18n/context";

import type { RaceCar3D } from "../race3d";

const Race3DScene = lazy(() => import("./Race3DScene"));

function background(): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue("--color-panel");
  return value.trim() || "#101014";
}

/**
 * The race in 3D on the relief of the circuit. The track comes from the fastest lap's
 * positions and altitude (ADR 0021), so a race without telemetry, or a browser without
 * WebGL, keeps the map.
 */
export function Race3DView({
  sessionId,
  cars,
  ghost,
  circuit,
  onSelect,
}: {
  sessionId: number;
  cars: readonly RaceCar3D[];
  ghost: { fraction: number; code: string } | null;
  circuit: string;
  onSelect: (carNumber: number) => void;
}) {
  const { t } = useI18n();
  const [camera, setCamera] = useState<CameraMode>("top");
  const webgl = hasWebGL();
  const laps = useTelemetryLaps(sessionId, webgl);
  const reference = laps.data?.[0]?.entry.car_number;
  const track = useTelemetryCompare(sessionId, reference === undefined ? [] : [reference]);

  if (!webgl) return <Unavailable text={t("race3d.noWebgl")} />;
  if (laps.isError || track.isError || laps.data?.length === 0) {
    return <Unavailable text={t("race3d.noTelemetry")} />;
  }
  if (!track.data)
    return <Skeleton className="h-[calc(100vh-26rem)] min-h-72" label={t("race3d.loading")} />;
  const flat = trackElevation(track.data) === null;

  return (
    <div className="flex flex-col gap-3">
      <div className="relative h-[calc(100vh-26rem)] min-h-72 overflow-hidden rounded-[16px]">
        <Suspense fallback={<Skeleton className="h-full" />}>
          <Race3DScene
            data={track.data}
            cars={cars}
            ghost={ghost}
            camera={camera}
            background={background()}
            label={t("race3d.label", { circuit })}
            onSelect={onSelect}
          />
        </Suspense>
        <p className="pointer-events-none absolute top-2 right-3 rounded bg-bg/70 px-2 py-0.5 text-xs text-muted">
          {flat ? t("telemetry.3d.flat") : t("telemetry.3d.relief", { n: ELEVATION_EXAGGERATION })}
        </p>
        <div className="absolute bottom-3 left-3">
          <PillSwitch
            label={t("telemetry.3d.camera")}
            value={camera}
            options={[
              ["top", t("race3d.camera.top")],
              ["chase", t("telemetry.3d.cam.chase")],
              ["trackside", t("telemetry.3d.cam.trackside")],
            ]}
            onChange={setCamera}
          />
        </div>
      </div>
    </div>
  );
}

function Unavailable({ text }: { text: string }) {
  return (
    <p role="status" className="rounded-[16px] border border-line p-4 text-sm text-muted">
      {text}
    </p>
  );
}
