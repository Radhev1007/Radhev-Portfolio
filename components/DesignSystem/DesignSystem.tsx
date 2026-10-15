"use client";

import { AnimatePresence, motion, useMotionValueEvent, useScroll, useTransform } from "framer-motion";
import Image from "next/image";
import { useRef, useState } from "react";
import { TextReveal } from "@/components/Animations/TextReveal";
import { SectionHeader } from "@/components/Projects/SectionHeader";
import { useMediaQuery } from "@/lib/hooks";
import { ease } from "@/lib/motion";

const layers = [
  { k: "Tokens", img: "/system/tokens.webp", d: "Colour, type, spacing and radius — the smallest decisions, made once." },
  { k: "Components", img: "/system/components.webp", d: "Buttons, inputs, toggles and cards with every state accounted for." },
  { k: "Patterns", img: "/system/patterns.webp", d: "Forms, navigation and lists that solve recurring problems." },
  { k: "Products", img: "/system/products.webp", d: "Screens and flows composed from the system, consistent by default." },
];

/**
 * From tablet up: a pinned stage that steps from tokens to finished
 * products as you scroll. On phones: a normal section with tappable layers.
 * The illustration redraws for each layer.
 */
export function DesignSystem() {
  const ref = useRef<HTMLElement>(null);
  const [step, setStep] = useState(0);
  const pinned = useMediaQuery("(min-width: 768px)", true);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const progressWidth = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    if (pinned) setStep(Math.min(layers.length - 1, Math.floor(v * layers.length)));
  });

  return (
    <section ref={ref} aria-label="Design beyond the screen" className="relative md:h-[280vh]">
      <div className="flex items-center md:sticky md:top-0 md:min-h-[100svh]">
        <div className="mx-auto grid w-full max-w-[1600px] grid-cols-1 items-center gap-12 gutter section-y md:grid-cols-12 md:gap-8">
          <div className="md:col-span-5">
            <SectionHeader index="02" label="Systems thinking" />
            <TextReveal
              as="h2"
              text="Design Beyond the Screen"
              className="section-title mt-8 max-w-[12ch] md:mt-12"
            />
            <p className="section-intro mt-6 md:mt-8">
              Interfaces are systems before they are screens. A shared set of decisions keeps products coherent as they grow.
            </p>

            <ol className="mt-10 flex flex-col gap-2" aria-label="Design system layers">
              {layers.map((l, i) => (
                <li key={l.k} className="flex items-baseline gap-4">
                  <span className="label w-6">0{i + 1}</span>
                  <motion.button
                    type="button"
                    onClick={() => setStep(i)}
                    aria-pressed={i === step}
                    className="text-left text-subtitle font-medium tracking-[-0.03em] md:text-subtitle"
                    animate={{ opacity: i === step ? 1 : 0.5, x: i === step ? 0 : -6 }}
                    transition={{ duration: 0.6, ease: ease.outExpo }}
                  >
                    {l.k}
                  </motion.button>
                </li>
              ))}
            </ol>
            <motion.p
              key={step}
              className="mt-4 min-h-[3em] max-w-sm text-small leading-relaxed text-mute"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: ease.outExpo }}
            >
              {layers[step].d}
            </motion.p>
            <div className="mt-4 hidden h-px w-full max-w-sm bg-line md:block">
              <motion.div className="h-px bg-accent" style={{ width: progressWidth }} />
            </div>
          </div>

          <div className="md:col-span-6 md:col-start-7">
            {/* One photograph per layer, crossfaded inside a fixed frame. */}
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-ink-3">
              <AnimatePresence initial={false}>
                <motion.div
                  key={step}
                  className="absolute inset-0"
                  initial={{ opacity: 0, scale: 0.96, y: 16 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 1.02, y: -8 }}
                  transition={{ duration: 0.8, ease: ease.outExpo }}
                >
                  <Image
                    src={layers[step].img}
                    alt={`${layers[step].k}: ${layers[step].d}`}
                    fill
                    sizes="(min-width: 768px) 50vw, 100vw"
                    unoptimized
                    className="object-cover"
                  />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
