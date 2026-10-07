"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Button } from "@/components/Animations/Button";
import { Reveal } from "@/components/Animations/Reveal";
import { TextReveal } from "@/components/Animations/TextReveal";
import { SectionHeader } from "@/components/Projects/SectionHeader";

/**
 * Entry to the garage.
 *
 * The scene is behind a dynamic import with `ssr: false`, so the physics
 * engine and the 3D world are only fetched once someone asks to go in — the
 * portfolio's own payload is unaffected by any of it.
 */
const GarageScene = dynamic(() => import("./GarageScene").then((m) => m.GarageScene), {
  ssr: false,
  loading: () => <Loading />,
});

export function Garage() {
  const [open, setOpen] = useState(false);
  // Driving is keyboard-only for now, so a touch visitor is told before they
  // commit to the download rather than after it.
  const [keyboard, setKeyboard] = useState(true);

  useEffect(() => {
    setKeyboard(!window.matchMedia("(pointer: coarse)").matches);
  }, []);

  // The page must not scroll underneath the scene.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <section id="garage" aria-label="My garage" className="relative gutter mx-auto max-w-[1600px] py-24 md:py-32">
      <SectionHeader index="09" label="My garage" />

      <div className="mt-10 grid grid-cols-1 items-end gap-10 md:mt-16 md:grid-cols-12 md:gap-8">
        <Reveal className="md:col-span-7">
          <h2 className="text-headline font-medium leading-[0.86] tracking-[-0.05em]">
            <TextReveal as="span" text="Design is what I do." className="block" />
            <TextReveal as="span" text="RC cars are what I drive." delay={0.1} className="block text-bone/55" />
          </h2>
        </Reveal>

        <Reveal delay={0.2} className="md:col-span-4 md:col-start-9">
          <p className="max-w-sm text-body leading-relaxed text-mute">
            When I&apos;m not designing digital experiences, I&apos;m building, tuning and driving RC cars. This is a
            small world of that — drive it.
          </p>
          <div className="mt-8">
            <Button onClick={() => setOpen(true)} cursor="cta" cursorLabel="Drive">
              Enter the garage
            </Button>
            {!keyboard && (
              <p className="mt-4 text-caption uppercase tracking-[0.16em] text-mute">
                Needs a keyboard to drive
              </p>
            )}
          </div>
        </Reveal>
      </div>

      {open && <GarageScene onExit={() => setOpen(false)} />}
    </section>
  );
}

function Loading() {
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-[#0b0b0c] text-white">
      <div className="text-center">
        <p className="text-caption uppercase tracking-[0.18em] text-white/45">Radhev R — Garage</p>
        <p className="mt-4 text-caption uppercase tracking-[0.18em]">Loading experience…</p>
      </div>
    </div>
  );
}
