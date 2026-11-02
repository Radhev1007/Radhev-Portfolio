"use client";

import { animate, motion, useMotionValue, useScroll, useSpring, useTransform, type MotionValue, type PanInfo } from "framer-motion";
import Image from "next/image";
import { useEffect, useRef } from "react";
import { Logo } from "@/components/Chrome/Logo";
import { linkedIn, site } from "@/lib/content";
import { useFinePointer, usePrefersReducedMotion } from "@/lib/hooks";
import { intro } from "@/lib/motion";
import { SocialGlyph } from "./SocialIcons";

/** Brushed steel, lit from the upper left: shared by the ring, the swivel and the clip. */
const STEEL = "linear-gradient(180deg, #f4f5f7 0%, #c9cdd2 38%, #8f949b 52%, #d8dbdf 78%, #a9adb3 100%)";

/**
 * The hero's ID badge, hung from the top of the viewport on a fabric lanyard.
 *
 * Everything that moves is a transform, so nothing reflows. The rig drops in on a spring and swings to rest
 * about its anchor at the top; a sheen crosses the photograph and the profile writes itself in as it lands.
 * After that it sways about a degree either side, as a badge does in moving air (a CSS animation, so it runs
 * on the compositor). On a mouse the pointer leans it and tilts the card, with the strap, portrait, panel and
 * wall shadow each moving by a different amount for depth; hovering sends light across the laminate. It can
 * be grabbed (mouse or finger) and pulled sideways: let go and it swings back and settles. Reduced motion
 * gets the badge at rest, with none of this.
 */
export function HangingBadge() {
  const reduced = usePrefersReducedMotion();
  const fine = useFinePointer();
  const still = reduced || !fine;

  // pointer position, −1…1 from the viewport centre, eased by a soft spring
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const sx = useSpring(px, { stiffness: 55, damping: 16, mass: 0.9 });
  const sy = useSpring(py, { stiffness: 55, damping: 16, mass: 0.9 });

  useEffect(() => {
    if (still) return;
    const move = (e: PointerEvent) => {
      if (e.pointerType === "touch" || window.scrollY > window.innerHeight) return;
      px.set((e.clientX / window.innerWidth) * 2 - 1);
      py.set((e.clientY / window.innerHeight) * 2 - 1);
    };
    const rest = () => { px.set(0); py.set(0); };
    window.addEventListener("pointermove", move, { passive: true });
    document.documentElement.addEventListener("pointerleave", rest);
    return () => {
      window.removeEventListener("pointermove", move);
      document.documentElement.removeEventListener("pointerleave", rest);
      rest();
    };
  }, [still, px, py]);

  // the whole rig leans toward the pointer about its anchor; the card turns a little further in 3D
  const lean = useTransform(sx, [-1, 1], [1.6, -1.6]);
  // grabbed and pulled: the angle the pull holds it at, then a lightly damped swing home on release
  const pulled = useMotionValue(0);
  const swing = useTransform([lean, pulled] as MotionValue<number>[], ([a, b]: number[]) => a + b);
  const ARM = 420; // px from the anchor to where the card is usually held
  const toDeg = (px: number) => (-Math.atan2(px, ARM) * 180) / Math.PI;
  const grab = {
    onPanStart: () => pulled.stop(),
    onPan: (_: PointerEvent, info: PanInfo) => pulled.set(Math.max(-16, Math.min(16, toDeg(info.offset.x)))),
    onPanEnd: (_: PointerEvent, info: PanInfo) =>
      animate(pulled, 0, { type: "spring", stiffness: 42, damping: 4.2, mass: 1, velocity: toDeg(info.velocity.x) }),
  };
  const turnY = useTransform(sx, [-1, 1], [-7, 7]);
  const turnX = useTransform(sy, [-1, 1], [5, -4]);
  // scrolling the badge off the top tips its foot back, as if the page drew it up and away (measured on the
  // badge itself, so on phones, where it sits under the headline, it arrives level)
  const rig = useRef<HTMLDivElement>(null);
  const { scrollYProgress: leaving } = useScroll({ target: rig, offset: ["start start", "end start"] });
  const tipBack = useTransform(leaving, [0, 1], [0, reduced ? 0 : 10]);
  const rotateX = useTransform([turnX, tipBack] as MotionValue<number>[], ([a, b]: number[]) => a + b);
  // depth: the photograph sits deepest, the wall shadow slides opposite, the glare crosses the laminate
  const photoX = useTransform(sx, [-1, 1], [7, -7]);
  const photoY = useTransform(sy, [-1, 1], [5, -5]);
  const panelX = useTransform(sx, [-1, 1], [-2, 2]);
  const shadowX = useTransform(sx, [-1, 1], [26, -10]);
  const shadowY = useTransform(sy, [-1, 1], [22, 36]);
  const glare = useTransform(sx, [-1, 1], ["-55%", "55%"]);

  // the profile writes itself in, line by line, as the badge lands
  const reveal = (i: number) => ({
    initial: reduced ? false : ({ opacity: 0, y: 10 } as const),
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] as const, delay: intro.objects + 0.85 + i * 0.1 },
  });

  return (
    <motion.div
      ref={rig}
      className="relative z-10 flex w-full flex-col items-center [--strap:2.5rem] md:[--strap:3.5rem]"
      style={{ transformOrigin: "50% 0%" }}
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: "-60%", rotate: -4 }}
      animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, rotate: 0 }}
      transition={
        reduced
          ? { duration: 0.6, delay: intro.objects }
          : {
              opacity: { duration: 0.5, delay: intro.objects },
              y: { type: "spring", stiffness: 70, damping: 15, mass: 1, delay: intro.objects },
              // under-damped, so it swings past rest twice, each time less, then hangs still
              rotate: { type: "spring", stiffness: 38, damping: 5.5, mass: 1, delay: intro.objects + 0.15 },
            }
      }
    >
      {/* idle sway, starting once the drop has settled */}
      <div
        className="flex w-full flex-col items-center [animation:badge-sway_7s_ease-in-out_infinite]"
        style={{ transformOrigin: "50% 0%", animationDelay: `${intro.objects + 2.4}s` }}
      >
      <motion.div className="flex w-full flex-col items-center" style={{ rotate: swing, transformOrigin: "50% 0%" }}>
        <Strap />
        <Ring />

        <div className="relative mt-[9px] w-full max-w-[20rem] [perspective:1400px] md:max-w-[clamp(15rem,36svh,23.25rem)]">
          {/* the badge's shadow on the wall behind it */}
          <motion.div
            aria-hidden
            className="absolute inset-x-5 bottom-2 top-16 rounded-[28px] bg-black/70 blur-2xl"
            style={{ x: shadowX, y: shadowY }}
          />

          <motion.div
            className="group/badge relative w-full touch-pan-y select-none rounded-[22px] shadow-[0_28px_56px_-24px_rgb(0_0_0/0.9),0_0_0_1px_rgb(255_255_255/0.08)] ring-1 ring-white/[0.08]"
            style={{ rotateX, rotateY: turnY, transformStyle: "preserve-3d" }}
            data-cursor="view"
            data-cursor-label="Swing"
            {...(reduced ? {} : grab)}
          >
            {/* the clip that grips the card's top edge */}
            <span
              aria-hidden
              className="absolute -top-3.5 left-1/2 z-20 h-7 w-12 -translate-x-1/2 rounded-[7px] shadow-[0_2px_4px_rgb(0_0_0/0.35),0_0_0_1px_rgb(0_0_0/0.22)]"
              style={{ background: STEEL }}
            >
              <span className="absolute left-1/2 top-1.5 h-1 w-6 -translate-x-1/2 rounded-full bg-[#2a2c30] shadow-[0_1px_0_rgb(255_255_255/0.6)]" />
              <span className="absolute bottom-1.5 left-2 size-1 rounded-full bg-[#6d7278] shadow-[0_1px_0_rgb(255_255_255/0.7)]" />
              <span className="absolute bottom-1.5 right-2 size-1 rounded-full bg-[#6d7278] shadow-[0_1px_0_rgb(255_255_255/0.7)]" />
            </span>

            {/* portrait */}
            <div className="relative aspect-[1/1.04] overflow-hidden rounded-t-[22px] bg-[#0b0b0b]">
              <motion.div className="absolute -inset-3" style={{ x: photoX, y: photoY }}>
                <Image
                  src="/radhev-portrait.webp"
                  alt="Black-and-white portrait of Radhev R in a light collared shirt"
                  fill
                  sizes="(min-width: 768px) 372px, 84vw"
                  loading="eager"
                  fetchPriority="high"
                  className="object-cover object-[50%_32%] contrast-[1.08] brightness-[1.05] grayscale"
                />
              </motion.div>
              <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/10" />
              {/* a glare that crosses the laminate as the card turns */}
              <motion.div
                aria-hidden
                className="absolute inset-y-0 -left-1/2 w-[200%] bg-[linear-gradient(112deg,transparent_38%,rgb(255_255_255/0.09)_47%,rgb(255_255_255/0.02)_53%,transparent_60%)]"
                style={{ x: glare }}
              />
              {/* light across the laminate: once as the badge lands, and again on each hover */}
              {!reduced && (
                <motion.span
                  aria-hidden
                  className="pointer-events-none absolute inset-y-0 -left-full w-full -skew-x-12 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                  initial={{ x: "0%" }}
                  animate={{ x: "260%" }}
                  transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1], delay: intro.objects + 0.9 }}
                />
              )}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-y-0 -left-full w-full -skew-x-12 bg-gradient-to-r from-transparent via-white/15 to-transparent transition-none group-hover/badge:translate-x-[260%] group-hover/badge:transition-transform group-hover/badge:duration-[1300ms] group-hover/badge:ease-[var(--ease-out-expo)]"
              />
              <div aria-hidden className="absolute inset-0 rounded-t-[22px] ring-1 ring-inset ring-white/10" />
              <span aria-hidden className="absolute right-5 top-5 font-medium text-[0.625rem] uppercase tracking-[0.24em] text-white/45">
                ID · 01
              </span>
            </div>

            {/* profile */}
            <motion.div
              className="relative rounded-b-[22px] bg-[linear-gradient(180deg,#f3f3f1_0%,#ebebe8_100%)] px-5 pb-5 pt-10 text-[#111] md:px-6 md:pb-6 md:pt-11"
              style={{ x: panelX }}
            >
              {/* the mark, set over the seam between photograph and panel */}
              <motion.span
                aria-hidden
                className="absolute left-5 top-0 grid size-14 -translate-y-1/2 place-items-center rounded-full bg-[#111] text-white shadow-[0_8px_18px_-6px_rgb(0_0_0/0.5)] ring-4 ring-[#f3f3f1] [--color-accent:#1685ff] md:left-6"
                initial={reduced ? false : { scale: 0.4, rotate: -90 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 220, damping: 14, delay: intro.objects + 0.7 }}
              >
                <Logo className="h-6 w-auto transition-transform duration-500 ease-[var(--ease-out-expo)] group-hover/badge:-rotate-12" />
              </motion.span>
              <motion.div className="flex items-start justify-between gap-4" {...reveal(0)}>
                <div>
                  <p className="text-[1.5rem] font-medium leading-[1.05] tracking-[-0.03em] md:text-[1.75rem]">Radhev R.</p>
                  <p className="mt-1.5 text-small tracking-[-0.01em] text-[#5e5e5e]">{site.role}</p>
                </div>
                <a
                  href={linkedIn.href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Radhev R on LinkedIn (opens in a new tab)"
                  data-cursor="hover"
                  className="grid size-11 shrink-0 place-items-center rounded-full border border-black/10 bg-white text-[#111] transition-colors duration-300 hover:border-[#0a6ad8] hover:bg-[#0a6ad8] hover:text-white md:size-10"
                >
                  <SocialGlyph name="linkedin" className="size-4" />
                </a>
              </motion.div>

              <motion.p className="mt-3 text-small leading-[1.6] text-[#4a4a4a]" {...reveal(1)}>
                {site.badgeIntro}
              </motion.p>

              <motion.address {...reveal(2)} className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 border-t border-black/10 pt-3.5 text-small not-italic text-[#5e5e5e]">
                <a
                  href={`mailto:${site.email}`}
                  className="inline-flex items-center gap-1.5 py-1 transition-colors duration-300 hover:text-[#0a6ad8]"
                >
                  <MailIcon />
                  {site.email}
                </a>
                <span className="inline-flex items-center gap-1.5 py-1">
                  <PinIcon />
                  {site.location}
                </span>
              </motion.address>
            </motion.div>
          </motion.div>
        </div>
      </motion.div>
      </div>
    </motion.div>
  );
}

/**
 * Black woven webbing down to the ring, the printed name repeating up it like a lanyard's. From tablet up the
 * badge has the right-hand column to itself, so the strap runs well past the top of the hero (which clips it)
 * and the drop-in and swing never show its end. On phones the badge follows the headline, so the strap is a
 * short length fading out above the ring rather than a line drawn up through the text.
 */
function Strap() {
  const print = "Radhev R ✦ Product Designer ✦ ".repeat(4);
  return (
    <div
      aria-hidden
      className="relative h-[var(--strap)] w-[26px] [mask-image:linear-gradient(to_bottom,transparent,black_75%)] md:-mt-[60vh] md:h-[calc(var(--strap)+60vh)] md:w-[30px] md:[mask-image:none]"
      style={{
        background:
          "linear-gradient(90deg, rgb(255 255 255/0.2) 0%, rgb(255 255 255/0.05) 22%, transparent 50%, rgb(0 0 0/0.4) 100%)," +
          "repeating-linear-gradient(0deg, rgb(255 255 255/0.04) 0 1px, transparent 1px 3px),#222222",
        boxShadow: "0 0 0 1px rgb(255 255 255/0.06)",
      }}
    >
      {/* stitched edges */}
      <span className="absolute inset-y-0 left-[3px] w-px bg-[repeating-linear-gradient(180deg,rgb(255_255_255/0.3)_0_4px,transparent_4px_8px)]" />
      <span className="absolute inset-y-0 right-[3px] w-px bg-[repeating-linear-gradient(180deg,rgb(255_255_255/0.22)_0_4px,transparent_4px_8px)]" />
      <span className="absolute inset-x-0 bottom-2.5 top-0 flex items-end justify-center overflow-hidden">
        <span className="rotate-180 whitespace-nowrap text-[0.5625rem] font-medium uppercase leading-none tracking-[0.32em] text-white/55 [writing-mode:vertical-rl]">
          {print}
        </span>
      </span>
    </div>
  );
}

/** The strap's end folded through a steel ring, and the swivel that drops to the clip. */
function Ring() {
  return (
    <svg aria-hidden viewBox="0 0 60 50" className="-mt-px block w-[52px] overflow-visible md:w-[60px]">
      <defs>
        <linearGradient id="badge-steel" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f5f6f8" />
          <stop offset="0.35" stopColor="#c3c7cc" />
          <stop offset="0.55" stopColor="#80858c" />
          <stop offset="0.8" stopColor="#dfe2e5" />
          <stop offset="1" stopColor="#9a9fa5" />
        </linearGradient>
        <linearGradient id="badge-fold" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#3a3a3a" />
          <stop offset="0.45" stopColor="#222222" />
          <stop offset="1" stopColor="#161616" />
        </linearGradient>
      </defs>
      {/* swivel */}
      <rect x="26.5" y="30" width="7" height="20" rx="3" fill="url(#badge-steel)" stroke="rgb(0 0 0/0.25)" strokeWidth="0.6" />
      {/* ring */}
      <circle cx="30" cy="24" r="10" fill="none" stroke="rgb(0 0 0/0.18)" strokeWidth="5.6" transform="translate(0.8 1.2)" />
      <circle cx="30" cy="24" r="10" fill="none" stroke="url(#badge-steel)" strokeWidth="4.2" />
      {/* the webbing folded over the ring's top, with its bar-tack stitching */}
      <path d="M17 0H43V10C43 17 37 19.5 30 19.5S17 17 17 10Z" fill="url(#badge-fold)" />
      <path d="M19.5 7H40.5" stroke="rgb(255 255 255/0.28)" strokeWidth="0.8" strokeDasharray="2 1.6" />
      <path d="M19.5 10H40.5" stroke="rgb(255 255 255/0.2)" strokeWidth="0.8" strokeDasharray="2 1.6" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className="size-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.3">
      <rect x="1.75" y="3.25" width="12.5" height="9.5" rx="1.5" />
      <path d="m2.5 4.25 5.5 4.25 5.5-4.25" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className="size-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.3">
      <path d="M8 14.5s4.75-4.2 4.75-8A4.75 4.75 0 0 0 3.25 6.5c0 3.8 4.75 8 4.75 8Z" />
      <circle cx="8" cy="6.5" r="1.6" />
    </svg>
  );
}
