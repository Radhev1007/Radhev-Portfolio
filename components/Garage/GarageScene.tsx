"use client";

import { Environment } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Car } from "./Car";
import { ApproachPrompt, CollectionCard, InspectRig } from "./Inspect";
import { Display, PLINTH_AT, PLINTH_RANGE } from "./Display";
import { World } from "./World";
import { useControls } from "./useControls";

type Mode = "drive" | "inspect";

/**
 * The garage, mounted only once the visitor asks for it.
 *
 * Everything here is behind a dynamic import from the entry section, so the
 * portfolio itself never pays for the physics engine or the scene — the brief
 * was explicit that the main page has to stay light.
 */
export function GarageScene({ onExit }: { onExit: () => void }) {
  const [mode, setMode] = useState<Mode>("drive");
  const controls = useControls(mode === "drive");
  const [speed, setSpeed] = useState(0);
  const [near, setNear] = useState(false);
  const [tier, setTier] = useState<"high" | "low">("high");
  const state = useRef({ speed: 0, airborne: false });

  const onState = useCallback((s: { speed: number; airborne: boolean }) => {
    state.current = s;
  }, []);

  useEffect(() => {
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    setTier(coarse || window.innerWidth < 768 || (navigator.hardwareConcurrency ?? 4) <= 4 ? "low" : "high");
  }, []);

  // Escape backs out one level at a time — out of the inspector first, then
  // out of the garage — so it never throws away more than the visitor meant.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (mode === "inspect") setMode("drive");
        else onExit();
        return;
      }
      if (e.code === "KeyE" && mode === "drive" && near) setMode("inspect");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, near, onExit]);

  // The readout ticks a few times a second rather than once a frame.
  useEffect(() => {
    const id = setInterval(() => setSpeed(state.current.speed), 150);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="fixed inset-0 z-[100] bg-[#0b0b0c]">
      <Canvas
        shadows={tier === "high"}
        dpr={tier === "low" ? [1, 1.5] : [1, 2]}
        gl={{ antialias: tier === "high", powerPreference: "high-performance" }}
        camera={{ position: [0, 6, 14], fov: 42 }}
      >
        <color attach="background" args={["#0b0b0c"]} />
        <fog attach="fog" args={["#0b0b0c", 30, 85]} />

        <ambientLight intensity={0.5} />
        <directionalLight
          position={[14, 20, 8]}
          intensity={2.2}
          color="#fff2e4"
          castShadow={tier === "high"}
          shadow-mapSize={[1024, 1024]}
          shadow-camera-left={-40}
          shadow-camera-right={40}
          shadow-camera-top={40}
          shadow-camera-bottom={-40}
        />
        <directionalLight position={[-12, 8, -14]} intensity={0.7} color="#9fb6ff" />

        <Suspense fallback={null}>
          <Environment preset="warehouse" environmentIntensity={0.35} />
          {/* A fixed step, not "vary": a slow first frame under a variable step is a
              one-second physics tick, and a one-second tick puts the truck through
              the floor before anyone has touched a key. */}
          <Physics gravity={[0, -22, 0]} timeStep={1 / 60} paused={mode === "inspect"}>
            <World />
            <Display near={near} label={mode === "drive"} />
            <Car controls={controls} onState={onState} />
            {mode === "drive" && <Chase getState={() => state.current} onNear={setNear} />}
          </Physics>
          {mode === "inspect" && <InspectRig />}
        </Suspense>
      </Canvas>

      {mode === "drive" ? (
        <>
          <Hud speed={speed} onExit={onExit} />
          {near && <ApproachPrompt onExplore={() => setMode("inspect")} />}
        </>
      ) : (
        <CollectionCard onBack={() => setMode("drive")} />
      )}
    </div>
  );
}

/**
 * Third-person chase camera. It trails the car's position rather than its
 * heading, so reversing or spinning does not whip the view around — the lag
 * is the point. It also closes in when the truck is crawling and backs off
 * when it is moving, because the two situations want different framing.
 *
 * It does double duty as the proximity test for the display plinth: it is
 * already holding the car every frame, so nothing else has to look it up.
 */
function Chase({
  getState,
  onNear,
}: {
  getState: () => { speed: number; airborne: boolean };
  onNear: (near: boolean) => void;
}) {
  const { camera, scene } = useThree();
  const target = useRef(new THREE.Vector3(0, 1, 6));
  const look = useRef(new THREE.Vector3(0, 1, 6));
  const desired = useRef(new THREE.Vector3());
  const wasNear = useRef(false);
  const settled = useRef(false);

  useFrame((_, delta) => {
    const car = scene.getObjectByName("rc-car");
    const d = Math.min(delta, 0.05);
    if (car) target.current.copy(car.position);

    const pace = Math.min(getState().speed, 7) / 7;
    desired.current.set(
      target.current.x,
      target.current.y + 2.1 + pace * 1.1,
      target.current.z + 5.2 + pace * 2.2,
    );
    // Snap on the first frame that actually has the truck in it. Lerping in
    // from the default camera position means the scene opens on a distant
    // speck; snapping before the rigid body exists aims at the wrong place.
    if (!settled.current && car) {
      settled.current = true;
      camera.position.copy(desired.current);
      look.current.copy(target.current);
    }
    camera.position.lerp(desired.current, Math.min(1, 2.6 * d));
    look.current.lerp(target.current, Math.min(1, 5 * d));
    camera.lookAt(look.current);

    // Only tell React when the answer changes.
    const dx = target.current.x - PLINTH_AT[0];
    const dz = target.current.z - PLINTH_AT[2];
    const isNear = dx * dx + dz * dz < PLINTH_RANGE * PLINTH_RANGE;
    if (isNear !== wasNear.current) {
      wasNear.current = isNear;
      onNear(isNear);
    }
  });
  return null;
}

function Hud({ speed, onExit }: { speed: number; onExit: () => void }) {
  return (
    <div className="pointer-events-none absolute inset-0 p-6 font-sans text-white md:p-8">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-caption font-medium uppercase tracking-[0.16em]">Radhev R</p>
          <p className="mt-2 text-caption uppercase tracking-[0.16em] text-white/45">My Garage</p>
        </div>
        <button
          type="button"
          onClick={onExit}
          className="pointer-events-auto border border-white/20 px-4 py-2 text-caption uppercase tracking-[0.16em] transition-colors hover:bg-white/10"
        >
          Esc — Exit
        </button>
      </div>

      <div className="absolute inset-x-6 bottom-6 flex items-end justify-between md:inset-x-8 md:bottom-8">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-caption uppercase tracking-[0.16em] text-white/45">
          <dt className="text-white">W A S D</dt>
          <dd>Crawl</dd>
          <dt className="text-white">Space</dt>
          <dd>Brake</dd>
          <dt className="text-white">Shift</dt>
          <dd>Boost</dd>
          <dt className="text-white">R</dt>
          <dd>Reset</dd>
        </dl>
        <p className="text-caption uppercase tracking-[0.16em] tabular-nums text-white/45">
          <span className="text-white">{Math.round(speed * 8)}</span> km/h
        </p>
      </div>
    </div>
  );
}
