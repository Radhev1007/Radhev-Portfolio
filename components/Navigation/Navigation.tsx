"use client";

import { ScrambleText } from "@/components/Animations/ScrambleText";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Magnetic } from "@/components/Animations/Magnetic";
import { useLenis, useScrollTo } from "@/components/Providers/SmoothScroll";
import { navItems, site, type SectionId } from "@/lib/content";
import { usePrefersReducedMotion } from "@/lib/hooks";
import { ease, intro } from "@/lib/motion";
import { GarageLauncher } from "@/components/Garage/Garage";
import { Logo } from "@/components/Chrome/Logo";
import { StatusBadge } from "./StatusBadge";

/** 14px Host Grotesk, sentence case, −0.01em — the reference's nav type. */
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
        href={"href" in item && item.href ? item.href : `/#${item.id}`}
        onClick={"href" in item && item.href ? undefined : onClick}
        aria-current={active ? "true" : undefined}
        className={`block text-small tracking-[-0.01em] transition-colors duration-300 ${
          active ? "text-bone" : "text-mute hover:text-bone"
        }`}
      >
        <ScrambleText text={item.label} />
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
/** All four sit together on the right; the wordmark takes the left. */
const items = navItems;

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

  // While the menu is open it is the page for keyboard and screen-reader users too: what is behind it is inert,
  // focus moves to its first link, and returns to the toggle when it closes.
  const toggle = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const behind = [...document.querySelectorAll<HTMLElement>("main, footer")];
    behind.forEach((el) => (el.inert = true));
    const t = setTimeout(() => document.querySelector<HTMLElement>("#mobile-menu a")?.focus(), 50);
    const button = toggle.current;
    return () => {
      clearTimeout(t);
      behind.forEach((el) => (el.inert = false));
      button?.focus();
    };
  }, [menuOpen]);

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
          className="mx-auto flex h-[88px] max-w-[1600px] items-center justify-between gutter"
        >
          {/* The wordmark leads, as a masthead rather than a centred emblem. */}
          <Magnetic strength={0.3}>
            <Link
              href="/"
              onClick={go("home")}
              className="flex items-center gap-3 text-bone"
              aria-label={`${site.name.first} ${site.name.last} — home`}
            >
              <Logo className="h-6 w-auto" />
              <span className="text-small font-medium uppercase tracking-[0.18em]">
                {site.name.first}
              </span>
            </Link>
          </Magnetic>

          <div className="flex items-center gap-8 md:gap-10">
            <ul className="hidden items-center gap-10 md:flex">
              {items.map((item) => (
                <li key={item.id}>
                  <NavLink item={item} active={isHome && active === item.id} onClick={go(item.id)} />
                </li>
              ))}
            </ul>

            {/* The one action the nav is for: straight into a WhatsApp chat. */}
            <a
              href={site.whatsapp}
              target="_blank"
              rel="noreferrer"
              aria-label="Let's talk on WhatsApp"
              data-cursor="cta"
              className="group hidden items-center gap-2 rounded-control border border-line px-4 py-2 text-small tracking-[-0.01em] text-bone transition-colors duration-300 hover:border-bone/45 hover:bg-bone/5 md:inline-flex"
            >
              <ScrambleText text="Let's talk" />
              <span
                aria-hidden
                className="transition-transform duration-500 ease-[var(--ease-out-expo)] group-hover:translate-x-1"
              >
                →
              </span>
            </a>

            <div className="flex items-center gap-5">
              {/* A toggle rather than a nav item: there is nothing to scroll
                  to and nothing to deep-link. */}
              <GarageLauncher className="opacity-60" />
              {/* a 44px target around the 16px glyph */}
              <button
                ref={toggle}
                type="button"
                className="relative -m-3 grid size-11 place-items-center"
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
                      href={"href" in item && item.href ? item.href : `/#${item.id}`}
                      onClick={(e) => {
                        setMenuOpen(false);
                        if (!("href" in item && item.href)) go(item.id)(e);
                      }}
                      className="flex items-baseline gap-4 py-2 text-headline font-light leading-[1.05] tracking-[-0.03em] md:text-headline"
                    >
                      <span className="label">0{i + 1}</span>
                      <ScrambleText text={item.label} onMount />
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
              <a
                href={site.resume}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 self-start rounded-control border border-line px-4 py-3 text-small uppercase tracking-[0.12em]"
              >
                View résumé <span aria-hidden>↗</span>
              </a>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {site.socials.map((s) => (
                  <a key={s.label} href={s.href} target="_blank" rel="noreferrer" className="label !text-bone">
                    <ScrambleText text={s.label} />
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

