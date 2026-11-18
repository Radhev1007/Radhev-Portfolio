"use client";

import { useScrollTo } from "@/components/Providers/SmoothScroll";
import { site } from "@/lib/content";

/** The reference's footer: the copyright in the left rail, the way back to the top on the right. */
export function Footer() {
  const scrollTo = useScrollTo();
  return (
    <footer className="border-t border-line">
      <div className="gutter mx-auto grid max-w-[1920px] grid-cols-[1fr_auto] gap-x-5 py-8 text-[length:var(--text-ui)] leading-[1.7] lg:grid-cols-[28.5%_1fr_auto]">
        <p className="text-mute">
          &copy; {new Date().getFullYear()} {site.brand}
        </p>
        <p className="col-span-2 order-last mt-2 text-mute lg:order-none lg:col-span-1 lg:mt-0">{site.location}</p>
        <button
          type="button"
          onClick={() => {
            scrollTo("home");
            history.replaceState(null, "", window.location.pathname);
          }}
          className="text-bone transition-colors duration-300 hover:text-soft"
        >
          Back to top <span aria-hidden>↑</span>
        </button>
      </div>
    </footer>
  );
}
