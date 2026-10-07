"use client";

import { Environment } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Car } from "./Car";
import { World } from "./World";
import { useControls } from "./useControls";

/**
 * The garage, mounted only once the visitor asks for it.
 *
 * Everything here is behind a dynamic import from the entry section, so the
 * portfolio itself never pays for the physics engine or the scene — the brief
 * was explicit that the main page has to stay light.
 */
export function GarageScene({ onExit }: { onExit: () => void }) {
  const controls = useControls();
  const [speed, setSpeed] = useState(0);
  const [tier, setTier] = useState<"high" | "low">("high");
  const state = useRef({ speed: 0, airborne: false });

  const onState = useCallback((s: { speed: number; airborne: boolean }) => {
    state.current = s;
  }, []);

  useEffect(() => {
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    setTier(coarse || window.innerWidth < 768 || (navigator.hardwareConcurrency ?? 4) <= 4 ? "low" : "high");
  }, []);

  // Escape leaves; the readout ticks a few times a second rather than per frame.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onExit();
    window.addEventListener("keydown", onKey);
    const id = setInterval(() => setSpeed(state.current.speed), 150);
    return () => {
      window.removeEventListener("keydown", onKey);
      clearInterval(id);
    };
  }, [onExit]);

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
          <Physics gravity={[0, -22, 0]} timeStep="vary">
            <World />
            <Car controls={controls} onState={onState} />
            <Chase getState={() => state.current} />
          </Physics>
        </Suspense>
      </Canvas>

      <Hud speed={speed} onExit={onExit} />
    </div>
  );
}

/**
 * Third-person chase camera. It trails the car's position rather than its
 * heading, so reversing or spinning does not whip the view around — the lag
 * is the point.
 */
function Chase({ getState }: { getState: () => { speed: number; airborne: boolean } }) {
  const { camera, scene } = useThree();
  const target = useRef(new THREE.Vector3(0, 1, 6));
  const look = useRef(new THREE.Vector3(0, 1, 6));
  const desired = useRef(new THREE.Vector3());

  useFrame((_, delta) => {
    const car = scene.getObjectByName("rc-car");
    const d = Math.min(delta, 0.05);
    if (car) target.current.copy(car.position);

    desired.current.set(
      target.current.x,
      target.current.y + 4.6 + Math.min(getState().speed, 12) * 0.12,
      target.current.z + 9.5,
    );
    camera.position.lerp(desired.current, Math.min(1, 2.4 * d));
    look.current.lerp(target.current, Math.min(1, 5 * d));
    camera.lookAt(look.current);
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
          <dd>Drive</dd>
          <dt className="text-white">Space</dt>
          <dd>Drift</dd>
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
