"use client";

import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Magnetic } from "@/components/Animations/Magnetic";
import { useLenis, useScrollTo } from "@/components/Providers/SmoothScroll";
import { navItems, site, type SectionId } from "@/lib/content";
import { usePrefersReducedMotion } from "@/lib/hooks";
import { ease, intro } from "@/lib/motion";
import { Logo } from "@/components/Chrome/Logo";
import { SoundToggle } from "@/components/Chrome/SoundToggle";
import { StatusBadge } from "./StatusBadge";
import { ThemeToggle } from "./ThemeToggle";

/** 14px Geist, sentence case, −0.01em — the reference's nav type. */
function NavLink({
  item,
  active,
  onClick,
}: {
  item: (typeof navItems)[number];
  active: boolean;
  onClick: (e: React.MouseEvent) => void;
}) {
  return (
    <Magnetic strength={0.4}>
      <Link
        href={item.id === "home" ? "/" : `/#${item.id}`}
        onClick={onClick}
        aria-current={active ? "true" : undefined}
        className={`block text-small tracking-[-0.01em] transition-colors duration-300 ${
          active ? "text-bone" : "text-mute hover:text-bone"
        }`}
      >
        {item.label}
      </Link>
    </Magnetic>
  );
}

function useActiveSection(enabled: boolean) {
  const [active, setActive] = useState<SectionId>("home");
  useEffect(() => {
    if (!enabled) return;
    const els = navItems.map((n) => document.getElementById(n.id)).filter(Boolean) as HTMLElement[];
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => e.isIntersecting && setActive(e.target.id as SectionId));
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [enabled]);
  return active;
}

/**
 * Flanking groups either side of a centred wordmark, as on the reference.
 * "Home" is carried by the wordmark itself, so the two groups stay even.
 */
const leftItems = navItems.filter((n) => n.id === "work" || n.id === "process");
const rightItems = navItems.filter((n) => n.id === "about" || n.id === "contact");

export function Navigation() {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const reduced = usePrefersReducedMotion();
  const scrollTo = useScrollTo();
  const lenis = useLenis();
  const active = useActiveSection(isHome);

  const { scrollY } = useScroll();
  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useMotionValueEvent(scrollY, "change", (y) => {
    const prev = scrollY.getPrevious() ?? 0;
    setScrolled(y > 40);
    setHidden(y > prev && y > 240 && !menuOpen);
  });

  useEffect(() => {
    if (menuOpen) lenis?.stop();
    else lenis?.start();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen, lenis]);

  const go = (id: SectionId) => (e: React.MouseEvent) => {
    if (!isHome) return; // let the Link navigate to /#id
    e.preventDefault();
    setMenuOpen(false);
    lenis?.start(); // the open menu pauses Lenis; resume before scrolling
    scrollTo(id);
  };

  // Reveal once the hero intro has played (immediately elsewhere).
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), isHome && !reduced ? intro.nav * 1000 : 0);
    return () => clearTimeout(t);
  }, [isHome, reduced]);

  return (
    <>
      <motion.header
        className="fixed inset-x-0 top-0 z-50"
        initial={{ y: -40, opacity: 0 }}
        animate={{ y: !ready ? -40 : hidden ? -110 : 0, opacity: ready ? 1 : 0 }}
        transition={{ duration: 0.8, ease: ease.outExpo }}
      >
        <div
          className={`transition-[background-color,backdrop-filter] duration-700 ${
            scrolled || menuOpen ? "bg-ink/70 backdrop-blur-xl" : "bg-transparent"
          }`}
        >
        <nav
          aria-label="Primary"
          className="mx-auto grid h-[88px] max-w-[1600px] grid-cols-[1fr_auto_1fr] items-center gutter"
        >
          <ul className="hidden items-center gap-12 md:flex">
            {leftItems.map((item) => (
              <li key={item.id}>
                <NavLink item={item} active={isHome && active === item.id} onClick={go(item.id)} />
              </li>
            ))}
          </ul>

          {/* Placement sits on the grid child itself: the link groups are
              display:none below md, which drops them out of auto-placement and
              would otherwise pull the mark into the first column. */}
          <div className="col-start-2 justify-self-center">
            <Magnetic strength={0.3}>
              <Link
                href="/"
                onClick={go("home")}
                className="block text-bone"
                aria-label={`${site.name.first} ${site.name.last} — home`}
              >
                <Logo className="h-7 w-auto" />
              </Link>
            </Magnetic>
          </div>

          <div className="col-start-3 flex items-center justify-end gap-12">
            <ul className="hidden items-center gap-12 md:flex">
              {rightItems.map((item) => (
                <li key={item.id}>
                  <NavLink item={item} active={isHome && active === item.id} onClick={go(item.id)} />
                </li>
              ))}
            </ul>

            <div className="flex items-center gap-2">
              <SoundToggle />
              <ThemeToggle />
              <button
                type="button"
                className="relative grid size-5 place-items-center"
                aria-expanded={menuOpen}
                aria-controls="mobile-menu"
                aria-label={menuOpen ? "Close menu" : "Open menu"}
                onClick={() => setMenuOpen((v) => !v)}
              >
                <span
                  className={`absolute h-px w-4 bg-bone transition-transform duration-500 ${menuOpen ? "rotate-45" : "-translate-y-[3px]"}`}
                />
                <span
                  className={`absolute h-px w-4 bg-bone transition-transform duration-500 ${menuOpen ? "-rotate-45" : "translate-y-[3px]"}`}
                />
              </button>
            </div>
          </div>
        </nav>
        </div>
      </motion.header>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            id="mobile-menu"
            className="fixed inset-0 z-40 flex flex-col justify-between bg-ink gutter pb-10 pt-32"
            initial={{ clipPath: "inset(0 0 100% 0)" }}
            animate={{ clipPath: "inset(0 0 0% 0)" }}
            exit={{ clipPath: "inset(0 0 100% 0)" }}
            transition={{ duration: 0.8, ease: ease.inOutQuart }}
          >
            <ul className="flex flex-col gap-2">
              {navItems.map((item, i) => (
                <li key={item.id} className="overflow-hidden">
                  <motion.div
                    initial={{ y: "110%" }}
                    animate={{ y: 0 }}
                    exit={{ y: "110%" }}
                    transition={{ duration: 0.8, ease: ease.outExpo, delay: 0.15 + i * 0.05 }}
                  >
                    <Link
                      href={item.id === "home" ? "/" : `/#${item.id}`}
                      onClick={(e) => {
                        setMenuOpen(false);
                        go(item.id)(e);
                      }}
                      className="flex items-baseline gap-4 py-2 text-headline font-medium leading-[1.05] tracking-[-0.04em] md:text-headline"
                    >
                      <span className="label">0{i + 1}</span>
                      {item.label}
                    </Link>
                  </motion.div>
                </li>
              ))}
            </ul>
            <motion.div
              className="flex flex-col gap-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { delay: 0.5 } }}
              exit={{ opacity: 0 }}
            >
              {site.available && <StatusBadge className="inline-flex self-start" />}
              <a href={`mailto:${site.email}`} className="text-lead">
                {site.email}
              </a>
              <div className="flex gap-4">
                {site.socials.map((s) => (
                  <a key={s.label} href={s.href} target="_blank" rel="noreferrer" className="label !text-bone">
                    {s.label}
                  </a>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

