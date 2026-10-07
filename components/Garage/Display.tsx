"use client";

import { Html } from "@react-three/drei";
import { heroVehicle } from "@/lib/garage";
import { type Detail, Scx30 } from "./Scx30";

/** Where the plinth stands, and where the player has to get to to inspect it. */
export const PLINTH_AT: [number, number, number] = [0, 0, -24.2];
export const PLINTH_RANGE = 5.5;
export const PLINTH_TOP = 0.42;
/** The display truck is parked at an angle, and the labels have to match. */
export const PLINTH_YAW = -0.5;

/**
 * The display plinth inside the garage: the same truck you drive, parked
 * under a spot, lit and labelled. It is the fixed point the whole room is
 * arranged around, so it gets a real light rather than a bright material.
 */
export function Display({
  near,
  label = true,
  detail = "game",
}: {
  near: boolean;
  label?: boolean;
  detail?: Detail;
}) {
  const top = PLINTH_TOP;

  return (
    <group position={PLINTH_AT}>
      {/* Plinth — static scenery, deliberately without a collider so nobody
          spends their visit wedged under the display stand. */}
      <mesh position={[0, top / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.5, 1.65, top, 40]} />
        <meshStandardMaterial color="#17171a" roughness={0.6} metalness={0.3} />
      </mesh>
      <mesh position={[0, top + 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.32, 1.46, 40]} />
        <meshStandardMaterial
          color="#f43c00"
          emissive="#f43c00"
          emissiveIntensity={near ? 2.4 : 0.9}
          toneMapped={false}
        />
      </mesh>

      {/* The model's origin is its own ground plane, so it sits on the plinth
          top with nothing to work out. */}
      <group position={[0, top, 0]} rotation={[0, PLINTH_YAW, 0]}>
        <Scx30 detail={detail} />
      </group>

      <spotLight
        position={[0, 5.2, 1.4]}
        target-position={[0, top, 0]}
        angle={0.5}
        penumbra={0.7}
        intensity={90}
        distance={14}
        color="#fff1dd"
        castShadow
      />

      {label && (
      <Html
        position={[0, 1.9, 0]}
        center
        distanceFactor={4}
        zIndexRange={[20, 0]}
        style={{ pointerEvents: "none", userSelect: "none" }}
      >
        <div style={{ textAlign: "center", whiteSpace: "nowrap", fontFamily: "inherit" }}>
          <p
            style={{
              margin: 0,
              color: "#fff",
              fontSize: 13,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              fontWeight: 500,
            }}
          >
            {heroVehicle.plinth[0]}
          </p>
          <p
            style={{
              margin: "4px 0 0",
              color: "rgba(255,255,255,0.5)",
              fontSize: 10,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
            }}
          >
            {heroVehicle.plinth[1]}
          </p>
          <p
            style={{
              margin: "2px 0 0",
              color: "#f43c00",
              fontSize: 10,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
            }}
          >
            {heroVehicle.plinth[2]}
          </p>
        </div>
      </Html>
      )}
    </group>
  );
}
