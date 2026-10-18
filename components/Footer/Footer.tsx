"use client";

import { ScrambleText } from "@/components/Animations/ScrambleText";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Magnetic } from "@/components/Animations/Magnetic";
import { Logo } from "@/components/Chrome/Logo";
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
                <span key={w} className="flex items-center text-title tracking-[-0.04em]">
                  {/* the second pass of the loop is drawn by CSS, so the words are in the page once */}
                  {k === 0 ? <span className="px-8">{w}</span> : <span data-w={w} className="px-8 before:content-[attr(data-w)]" />}
                  <span className="font-accent text-accent">✳</span>
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>

      <div className="gutter mx-auto grid max-w-[1600px] grid-cols-2 gap-10 py-14 md:grid-cols-12">
        <div className="col-span-2 md:col-span-5">
          {/* The nav's lockup, at the nav's size. */}
          <Link
            href="/"
            onClick={(e) => {
              if (!isHome) return;
              e.preventDefault();
              scrollTo("home");
            }}
            className="inline-flex items-center gap-3 text-bone"
            aria-label={`${site.name.first} ${site.name.last} — back to top`}
          >
            <Logo className="h-6 w-auto" />
            <span className="text-small font-medium uppercase tracking-[0.18em]">{site.name.first}</span>
          </Link>
          <p className="mt-4 text-bone/60">{site.role}</p>
          <a href={`mailto:${site.email}`} className="mt-6 inline-block text-bone/80 underline decoration-bone/20 underline-offset-8 transition-colors hover:decoration-accent">
            <ScrambleText text={site.email} />
          </a>
        </div>
        <nav aria-label="Footer" className="md:col-span-2 md:col-start-7">
          <p className="label mb-4">Navigate</p>
          <ul className="flex flex-col gap-2">
            {navItems.map((n) => (
              <li key={n.id}>
                <Link
                  href={"href" in n && n.href ? n.href : `/#${n.id}`}
                  onClick={(e) => {
                    if ("href" in n && n.href) return; // a route, not an anchor
                    if (!isHome) return;
                    e.preventDefault();
                    scrollTo(n.id);
                  }}
                  className="text-bone/70 transition-colors hover:text-bone"
                >
                  <ScrambleText text={n.label} />
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
                  <ScrambleText text={s.label} />
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

      <div className="gutter mx-auto flex max-w-[1600px] flex-col gap-2 border-t border-line py-6 text-caption text-mute md:flex-row md:justify-between">
        <p>
          © {year} — All rights reserved.
        </p>
        <p>Designed &amp; built by {site.name.first}.</p>
      </div>
    </footer>
  );
}
