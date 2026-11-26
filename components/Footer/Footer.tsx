"use client";

import { useScrollTo } from "@/components/Providers/SmoothScroll";
import SlingButton from "@/components/SlingButton/SlingButton";
import { footerNav, site } from "@/lib/content";

const link = "text-soft transition-colors duration-300 hover:text-bone focus-visible:text-bone";

/** The footer: who I am, where to go on the page, how to reach me, and the way back to the top. */
export function Footer() {
  const scrollTo = useScrollTo();
  const social = (label: string) => site.socials.find((s) => s.label === label)!.href;
  return (
    <footer className="border-t border-line">
      <div className="gutter mx-auto grid max-w-[1920px] grid-cols-1 gap-x-5 gap-y-12 py-16 text-[length:var(--text-ui)] leading-[1.7] lg:gap-y-8 lg:py-10 lg:grid-cols-[28.5%_1fr]">
        <div>
          <p className="text-bone">{site.brand}</p>
          <p className="text-soft">{site.role}</p>
        </div>
        <div className="grid grid-cols-1 gap-x-5 gap-y-12 sm:grid-cols-3 sm:gap-y-8">
          <p className="max-w-[28ch] text-mute">{site.tagline}</p>
          <nav aria-label="Footer">
            <h2 className="label">Navigation</h2>
            <ul className="mt-4 flex flex-col gap-3 lg:mt-3 lg:gap-0">
              {footerNav.map((n) => (
                <li key={n.target}>
                  <button
                    type="button"
                    onClick={() => {
                      scrollTo(n.target);
                      history.replaceState(null, "", window.location.pathname);
                    }}
                    className={link}
                  >
                    {n.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
          <div>
            <h2 className="label">Connect</h2>
            <ul className="mt-4 flex flex-col gap-3 lg:mt-3 lg:gap-0">
              <li>
                <a href={`mailto:${site.email}`} className={link}>
                  Email
                </a>
              </li>
              <li>
                <a href={social("LinkedIn")} target="_blank" rel="noreferrer" className={link}>
                  LinkedIn
                </a>
              </li>
              <li>
                <a href={social("Behance")} target="_blank" rel="noreferrer" className={link}>
                  Behance
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>
      <div className="gutter mx-auto grid max-w-[1920px] grid-cols-1 gap-x-5 gap-y-3 py-8 lg:items-center lg:gap-y-1 lg:py-6 text-[length:var(--text-ui)] leading-[1.7] text-mute lg:grid-cols-[28.5%_1fr]">
        <p>&copy; {new Date().getFullYear()} {site.brand}. All rights reserved.</p>
        {/* back to the top: React Bits' SlingButton. Tap it, or pull it back and let go. */}
        <div className="flex items-center gap-4 lg:justify-end">
          <span aria-hidden className="text-bone">
            Back to top
          </span>
          <SlingButton
            onSend={() => {
              scrollTo("home");
              history.replaceState(null, "", window.location.pathname);
            }}
            ariaLabel="Back to top"
            padColor="var(--color-bone)"
            iconColor="var(--color-ink)"
            accentColor="var(--color-bone)"
            wellColor="var(--color-ink-3)"
            bandColor="var(--color-line-strong)"
            size={44}
          />
        </div>
      </div>
    </footer>
  );
}
