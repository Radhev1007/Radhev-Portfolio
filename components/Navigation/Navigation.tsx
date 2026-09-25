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
import { StatusBadge } from "./StatusBadge";
import { ThemeToggle } from "./ThemeToggle";

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
        className="fixed inset-x-0 top-0 z-50 gutter pt-4 md:pt-5"
        initial={{ y: -40, opacity: 0 }}
        animate={{ y: !ready ? -40 : hidden ? -110 : 0, opacity: ready ? 1 : 0 }}
        transition={{ duration: 0.8, ease: ease.outExpo }}
      >
        <nav
          aria-label="Primary"
          className={`mx-auto flex h-14 max-w-[1600px] items-center justify-between rounded-full border pl-2 pr-2 transition-[background-color,border-color,backdrop-filter] duration-700 md:h-[52px] md:pl-2.5 ${
            scrolled || menuOpen ? "border-bone/10 bg-ink/60 backdrop-blur-xl" : "border-bone/[0.06] bg-transparent"
          }`}
        >
          <Magnetic strength={0.3}>
            <Link
              href="/"
              onClick={go("home")}
              className="flex items-center gap-3 rounded-full py-1 pl-1 pr-3"
              aria-label={`${site.name.first} ${site.name.last} — home`}
            >
              <span className="flex size-9 items-center justify-center rounded-full border border-bone/20 text-[13px] font-medium tracking-[-0.02em]">
                {site.name.first[0]}
                <span className="font-accent">{site.name.last[0]}</span>
              </span>
            </Link>
          </Magnetic>

          <ul className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => {
              const isActive = isHome && active === item.id;
              return (
                <li key={item.id}>
                  <Magnetic strength={0.4}>
                    <Link
                      href={item.id === "home" ? "/" : `/#${item.id}`}
                      onClick={go(item.id)}
                      aria-current={isActive ? "true" : undefined}
                      className={`relative block rounded-full px-4 py-1.5 text-[13px] transition-colors duration-300 ${
                        isActive ? "text-ink" : "text-bone/60 hover:text-bone"
                      }`}
                    >
                      {isActive && (
                        <motion.span
                          layoutId="nav-active"
                          className="absolute inset-0 -z-10 rounded-full bg-bone"
                          transition={{ duration: 0.6, ease: ease.outExpo }}
                        />
                      )}
                      {item.label}
                    </Link>
                  </Magnetic>
                </li>
              );
            })}
          </ul>

          <div className="flex items-center gap-2">
            {site.available && <StatusBadge className="hidden lg:flex" />}
            <ThemeToggle />
            <button
              type="button"
              className="relative grid size-11 place-items-center rounded-full bg-bone/10 md:hidden"
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
        </nav>
      </motion.header>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            id="mobile-menu"
            className="fixed inset-0 z-40 flex flex-col justify-between bg-ink gutter pb-10 pt-28 md:hidden"
            initial={{ clipPath: "inset(0 0 100% 0)" }}
            animate={{ clipPath: "inset(0 0 0% 0)" }}
            exit={{ clipPath: "inset(0 0 100% 0)" }}
            transition={{ duration: 0.8, ease: ease.inOutQuart }}
          >
            <ul className="flex flex-col gap-1">
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
                      className="flex items-baseline gap-4 py-1 text-[13vw] font-medium leading-[1.05] tracking-[-0.04em]"
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
              {site.available && <StatusBadge />}
              <a href={`mailto:${site.email}`} className="text-lg">
                {site.email}
              </a>
              <div className="flex gap-5">
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

