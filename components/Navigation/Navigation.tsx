"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { GarageLauncher } from "@/components/Garage/Garage";
import { useLenis, useScrollTo } from "@/components/Providers/SmoothScroll";
import { navItems, site, type SectionId } from "@/lib/content";
import { ease } from "@/lib/motion";

/**
 * The reference's header: a 67px black bar with a hairline, the name on the left and the links on the
 * right. On the homepage the links scroll smoothly to their section and the current one turns white;
 * on a case study they go to the homepage section. Below `md` the links move into a full-screen menu.
 */
export function Navigation() {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const scrollTo = useScrollTo();
  const lenis = useLenis();
  const [active, setActive] = useState<SectionId>("home");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const firstLink = useRef<HTMLAnchorElement>(null);

  // which section is under the reading line
  useEffect(() => {
    if (!isHome) return;
    const els = navItems.map((n) => document.getElementById(n.id)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive(e.target.id as SectionId)),
      { rootMargin: "-35% 0px -60% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [isHome]);

  // the open menu pauses smooth scrolling, closes on Escape and hands focus back to its button
  useEffect(() => {
    if (!menuOpen) return;
    const fullScreen = !window.matchMedia("(min-width: 768px)").matches;
    if (fullScreen) lenis?.stop();
    firstLink.current?.focus();
    const button = menuButton.current;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    // the desktop menu is a small drop-down, so a press anywhere outside the header closes it
    const onPress = (e: PointerEvent) => {
      if (!fullScreen && !(e.target as Element).closest("header")) setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPress);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPress);
      lenis?.start();
      button?.focus({ preventScroll: true });
    };
  }, [menuOpen, lenis]);

  const go = (id: SectionId) => (e: React.MouseEvent) => {
    if (!isHome) return; // the link itself navigates to /#id
    e.preventDefault();
    setMenuOpen(false);
    lenis?.start();
    scrollTo(id);
    history.replaceState(null, "", id === "home" ? "/" : `/#${id}`);
  };

  const linkClass = (id: SectionId) =>
    `transition-colors duration-300 hover:text-bone focus-visible:text-bone ${active === id ? "text-bone" : "text-mute"}`;

  return (
    <header className="fixed inset-x-0 top-0 z-50 h-[67px] border-b border-line bg-ink">
      <nav aria-label="Primary" className="gutter mx-auto flex h-full max-w-[1920px] items-center justify-between text-[length:var(--text-ui)] leading-[1.7]">
        <Link href="/" onClick={go("home")} className="text-bone">
          {site.brand}
          <span className="hidden text-mute sm:inline"> · Senior UX Designer / Product Designer</span>
        </Link>

        <div className="flex items-center gap-5 md:gap-7">
          <a
            href={`mailto:${site.email}`}
            className="hidden text-bone underline decoration-line-strong underline-offset-4 transition-colors duration-300 hover:decoration-bone md:inline"
          >
            Email
          </a>
          <GarageLauncher className="opacity-60" />
          <button
            ref={menuButton}
            type="button"
            aria-expanded={menuOpen}
            aria-controls="site-menu"
            onClick={() => setMenuOpen((o) => !o)}
            className="group -mr-2 flex items-center gap-2 px-2 py-3 text-[13px] font-bold uppercase leading-none tracking-[0.03em] text-bone"
          >
            Menu
            <DotGrid open={menuOpen} />
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            id="site-menu"
            className="fixed inset-x-0 bottom-0 top-[67px] z-40 overflow-y-auto bg-ink md:absolute md:inset-x-auto md:bottom-auto md:right-[var(--gutter)] md:top-full md:overflow-visible md:border md:border-t-0 md:border-line md:px-6 md:py-5"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.35, ease: ease.outExpo }}
          >
            {/* phones: a full-screen list; from tablet up, a compact right-aligned stack under the button */}
            <ul className="gutter flex flex-col pt-6 md:items-end md:gap-1.5 md:p-0">
              {navItems.map((n, i) => (
                <li key={n.id} className="border-b border-line md:border-0">
                  <Link
                    ref={i === 0 ? firstLink : undefined}
                    href={`/#${n.id}`}
                    onClick={go(n.id)}
                    aria-current={active === n.id ? "location" : undefined}
                    className={`block py-5 text-[length:var(--text-h1)] leading-none tracking-[-0.033em] transition-colors duration-300 hover:text-bone focus-visible:text-bone md:py-0 md:text-[13px] md:font-bold md:uppercase md:leading-[1.35] md:tracking-[0.03em] ${active === n.id ? "text-bone" : "text-soft"}`}
                  >
                    {n.label}
                  </Link>
                </li>
              ))}
              <li className="md:mt-3">
                <a href={`mailto:${site.email}`} className="block py-5 text-[length:var(--text-ui)] text-mute transition-colors duration-300 hover:text-bone md:py-0">
                  {site.email}
                </a>
              </li>
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

/** Four squares in a two-by-two grid, as on the reference menu button; they turn into diamonds when the menu opens. */
function DotGrid({ open }: { open: boolean }) {
  return (
    <motion.svg
      aria-hidden
      viewBox="0 0 6 6"
      className="size-3"
      fill="currentColor"
      animate={{ rotate: open ? 45 : 0 }}
      transition={{ duration: 0.45, ease: ease.outExpo }}
    >
      <rect width="2" height="2" />
      <rect x="4" width="2" height="2" />
      <rect y="4" width="2" height="2" />
      <rect x="4" y="4" width="2" height="2" />
    </motion.svg>
  );
}
