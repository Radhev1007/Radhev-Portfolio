"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Magnetic } from "@/components/Animations/Magnetic";
import { useScrollTo } from "@/components/Providers/SmoothScroll";
import { navItems, site } from "@/lib/content";

export function Footer() {
  const scrollTo = useScrollTo();
  const isHome = usePathname() === "/";
  const year = new Date().getFullYear();

  return (
    <footer className="relative overflow-hidden border-t border-line pt-10">
      {/* Marquee */}
      <div aria-hidden className="flex overflow-hidden whitespace-nowrap border-b border-line pb-10">
        <div className="flex shrink-0 [animation:marquee_38s_linear_infinite]">
          {Array.from({ length: 2 }, (_, k) => (
            <span key={k} className="flex shrink-0 items-center">
              {["Product Design", "Interaction", "Design Systems", "Prototyping", "Visual Design"].map((w) => (
                <span key={w} className="flex items-center text-[clamp(2rem,5vw,4.5rem)] tracking-[-0.04em]">
                  <span className="px-8">{w}</span>
                  <span className="font-accent text-accent">✳</span>
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>

      <div className="gutter mx-auto grid max-w-[1600px] grid-cols-2 gap-10 py-14 md:grid-cols-12">
        <div className="col-span-2 md:col-span-5">
          <p className="text-2xl font-medium tracking-[-0.03em]">
            {site.name.first} <span className="font-accent ">{site.name.last}</span>
          </p>
          <p className="text-bone/60">{site.role}</p>
          <a href={`mailto:${site.email}`} className="mt-6 inline-block text-bone/80 underline decoration-bone/20 underline-offset-8 transition-colors hover:decoration-accent">
            {site.email}
          </a>
        </div>
        <nav aria-label="Footer" className="md:col-span-2 md:col-start-7">
          <p className="label mb-4">Navigate</p>
          <ul className="flex flex-col gap-2">
            {navItems.map((n) => (
              <li key={n.id}>
                <Link
                  href={n.id === "home" ? "/" : `/#${n.id}`}
                  onClick={(e) => {
                    if (!isHome) return;
                    e.preventDefault();
                    scrollTo(n.id);
                  }}
                  className="text-bone/70 transition-colors hover:text-bone"
                >
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="md:col-span-2">
          <p className="label mb-4">Elsewhere</p>
          <ul className="flex flex-col gap-2">
            {site.socials.map((s) => (
              <li key={s.label}>
                <a href={s.href} target="_blank" rel="noreferrer" className="text-bone/70 transition-colors hover:text-bone">
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div className="col-span-2 flex items-start md:col-span-1 md:justify-end">
          <Magnetic strength={0.4}>
            <button
              type="button"
              onClick={() => scrollTo("home")}
              aria-label="Back to top"
              data-cursor="cta"
              className="grid size-16 place-items-center rounded-full border border-line transition-colors duration-500 hover:border-accent hover:bg-accent hover:text-ink"
            >
              ↑
            </button>
          </Magnetic>
        </div>
      </div>

      {/* Interactive signature — each letter rises on hover */}
      <div className="gutter mx-auto max-w-[1600px]">
        <p aria-hidden className="flex select-none justify-between text-[clamp(4rem,19vw,20rem)] font-medium leading-[0.75] tracking-[-0.06em] text-bone/[0.12]">
          {`${site.name.first} ${site.name.last}`.split("").map((c, i) => (
            <span
              key={i}
              className="inline-block transition-[transform,color] duration-700 ease-[var(--ease-out-expo)] hover:-translate-y-[0.12em] hover:text-accent"
            >
              {c === " " ? " " : c}
            </span>
          ))}
        </p>
      </div>

      <div className="gutter mx-auto flex max-w-[1600px] flex-col gap-2 border-t border-line py-6 text-xs text-mute md:flex-row md:justify-between">
        <p>
          © {year} — All rights reserved.
        </p>
        <p>Designed & built with care.</p>
      </div>
    </footer>
  );
}
