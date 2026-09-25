"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Magnetic } from "./Magnetic";

type Props = {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  variant?: "primary" | "ghost";
  icon?: boolean;
  external?: boolean;
  /** Custom-cursor state and label while hovering (defaults to the "cta" state). */
  cursor?: "cta" | "view";
  cursorLabel?: string;
};

/** Pill button with a rolling-label hover and magnetic pull. */
export function Button({ children, href, onClick, variant = "primary", icon = true, external, cursor = "cta", cursorLabel }: Props) {
  const base =
    "group relative inline-flex h-12 items-center gap-3 overflow-hidden rounded-full pl-6 text-[14px] md:h-14 md:pl-7 md:text-[15px] font-medium tracking-tight transition-colors duration-500";
  const styles =
    variant === "primary"
      ? "bg-bone pr-1.5 text-ink hover:bg-bone/90 md:pr-2"
      : "border border-line pr-6 text-bone hover:border-accent/50 hover:shadow-[0_0_32px_-6px_color-mix(in_srgb,var(--color-accent)_45%,transparent)] md:pr-7";

  const inner = (
    <>
      <span className="relative block overflow-hidden">
        <span className="block transition-transform duration-500 ease-[var(--ease-out-expo)] group-hover:-translate-y-full">
          {children}
        </span>
        <span
          aria-hidden
          className="absolute inset-0 block translate-y-full transition-transform duration-500 ease-[var(--ease-out-expo)] group-hover:translate-y-0"
        >
          {children}
        </span>
      </span>
      {icon && variant === "primary" && (
        <span className="grid size-9 place-items-center rounded-full bg-ink text-bone md:size-10 transition-transform duration-500 ease-[var(--ease-out-expo)] group-hover:rotate-[-45deg]">
          <Arrow />
        </span>
      )}
    </>
  );

  const shared = { className: `${base} ${styles}`, "data-cursor": cursor, "data-cursor-label": cursorLabel };

  return (
    <Magnetic strength={0.25}>
      {href ? (
        external || href.startsWith("mailto:") ? (
          <a href={href} {...shared} {...(external ? { target: "_blank", rel: "noreferrer" } : {})}>
            {inner}
          </a>
        ) : (
          <Link href={href} {...shared} onClick={onClick}>
            {inner}
          </Link>
        )
      ) : (
        <button type="button" onClick={onClick} {...shared}>
          {inner}
        </button>
      )}
    </Magnetic>
  );
}

export function Arrow({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden>
      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
