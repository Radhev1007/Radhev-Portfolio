"use client";

import { Html, OrbitControls } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import * as THREE from "three";
import { heroVehicle, inspectPoints } from "@/lib/garage";
import { PLINTH_AT, PLINTH_TOP, PLINTH_YAW } from "./Display";

const CENTRE = new THREE.Vector3(PLINTH_AT[0], PLINTH_AT[1] + PLINTH_TOP + 0.38, PLINTH_AT[2]);

/**
 * Inspection mode: the camera leaves the car, settles on the plinth and hands
 * control to an orbit rig. Driving input is suspended while this is up — see
 * `useControls`, which is told to stop listening rather than being fought
 * frame by frame.
 */
export function InspectRig() {
  const { camera } = useThree();

  // Start from a three-quarter front view, which is the angle the truck reads
  // best from, rather than wherever the chase camera happened to be.
  useEffect(() => {
    camera.position.set(CENTRE.x + 2.5, CENTRE.y + 0.8, CENTRE.z + 3.1);
    camera.lookAt(CENTRE);
  }, [camera]);

  return (
    <>
      <OrbitControls
        target={[CENTRE.x, CENTRE.y, CENTRE.z]}
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        minDistance={2.1}
        maxDistance={8}
        minPolarAngle={0.25}
        maxPolarAngle={Math.PI / 2 - 0.04}
        rotateSpeed={0.7}
        zoomSpeed={0.8}
      />

      {/* A little extra fill, so the inspector is not reading a silhouette. */}
      {/* Enough light to inspect by. The driving scene is deliberately moody;
          a parts inspection is not the place for it. */}
      <pointLight position={[PLINTH_AT[0] + 3, 3.2, PLINTH_AT[2] + 3]} intensity={90} distance={16} color="#ffeedd" />
      <pointLight position={[PLINTH_AT[0] - 3, 2.4, PLINTH_AT[2] - 2]} intensity={60} distance={14} color="#b9ccff" />
      <pointLight position={[PLINTH_AT[0], 1.0, PLINTH_AT[2] + 3.5]} intensity={30} distance={10} color="#ffffff" />
      <ambientLight intensity={0.55} />

      <group position={[PLINTH_AT[0], PLINTH_AT[1] + PLINTH_TOP, PLINTH_AT[2]]} rotation={[0, PLINTH_YAW, 0]}>
        {inspectPoints.map((p) => (
          <Html
            key={p.label}
            position={p.at as unknown as [number, number, number]}
            center
            distanceFactor={2.2}
            zIndexRange={[30, 0]}
            style={{ pointerEvents: "none", userSelect: "none" }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                whiteSpace: "nowrap",
                color: "rgba(255,255,255,0.86)",
                fontSize: 11,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
              }}
            >
              <span
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: 999,
                  background: "#f43c00",
                  flex: "none",
                }}
              />
              {p.label}
            </div>
          </Html>
        ))}
      </group>
    </>
  );
}

/* ── Overlays ───────────────────────────────────────────────── */

/** Shown when the truck is parked within reach of the plinth. */
export function ApproachPrompt({ onExplore }: { onExplore: () => void }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-28 flex justify-center">
      <div className="pointer-events-auto border border-white/15 bg-black/55 px-6 py-4 text-center backdrop-blur-sm">
        <p className="text-caption font-medium uppercase tracking-[0.18em] text-white">
          {heroVehicle.name}
        </p>
        <p className="mt-2 max-w-[28ch] text-caption uppercase tracking-[0.14em] text-white/50">
          “{heroVehicle.tagline}”
        </p>
        <button
          type="button"
          onClick={onExplore}
          className="mt-4 border border-white/25 px-4 py-2 text-caption uppercase tracking-[0.18em] text-white transition-colors hover:bg-white/10"
        >
          E — Explore
        </button>
      </div>
    </div>
  );
}

/** The collection card, which is the whole of the inspection interface. */
export function CollectionCard({ onBack }: { onBack: () => void }) {
  const v = heroVehicle;
  const rows: [string, string][] = [
    ["Category", v.category],
    ["Scale", v.scale],
    ["Status", v.status],
  ];

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-end p-6 md:p-8">
      <div className="pointer-events-auto flex max-w-[17rem] flex-col border border-white/15 bg-black/65 p-5 backdrop-blur-sm">
        <p className="text-caption uppercase tracking-[0.22em] text-white/40">{v.number}</p>
        <h3 className="mt-1 text-subtitle font-medium leading-[1.05] tracking-[-0.02em] text-white">
          {v.name}
        </h3>

        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-5 gap-y-1 text-caption uppercase tracking-[0.16em]">
          {rows.map(([k, val]) => (
            <div key={k} className="contents">
              <dt className="text-white/40">{k}</dt>
              <dd className="text-white">{val}</dd>
            </div>
          ))}
        </dl>

        <p className="mt-4 text-caption leading-relaxed tracking-normal text-white/55">“{v.description}”</p>

        <button
          type="button"
          onClick={onBack}
          className="mt-5 self-start border border-white/25 px-4 py-2 text-caption uppercase tracking-[0.18em] text-white transition-colors hover:bg-white/10"
        >
          Esc — Back to driving
        </button>
      </div>

      <p className="pointer-events-none absolute inset-x-0 top-6 text-center text-caption uppercase tracking-[0.18em] text-white/35 md:top-8">
        Drag to rotate · Scroll to zoom
      </p>
    </div>
  );
}
