"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { Reveal } from "@/components/Animations/Reveal";
import { SectionHeader } from "@/components/Projects/SectionHeader";
import { useContent } from "@/components/Providers/ContentProvider";
import type { Role } from "@/lib/content";
import { ease } from "@/lib/motion";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * "Jan 2025" → months since year 0; "Present" → the current month; anything else → null
 * (the schema only admits those two forms, but the component must not throw on stored data it cannot read).
 */
function toMonth(label: string): number | null {
  if (label === "Present") {
    const now = new Date();
    return now.getFullYear() * 12 + now.getMonth();
  }
  const [m, y] = label.split(" ");
  const month = MONTHS.indexOf(m);
  const year = Number(y);
  return month < 0 || !Number.isFinite(year) || y === "" ? null : year * 12 + month;
}

/** Tenure is inclusive of both end months, as a CV reads it; null when a date cannot be read. */
function tenure(role: Role): number | null {
  const from = toMonth(role.from);
  const to = toMonth(role.to);
  return from === null || to === null ? null : Math.max(to - from + 1, 0);
}

function formatTenure(months: number | null) {
  if (months === null || months <= 0) return "";
  const y = Math.floor(months / 12);
  const m = months % 12;
  return [y && `${y} yr${y > 1 ? "s" : ""}`, m && `${m} mo${m > 1 ? "s" : ""}`].filter(Boolean).join(" ");
}

/**
 * Employment history as a summary column beside an accordion of roles.
 *
 * The left column carries the career at a glance — total time, number of
 * roles and a proportional timeline — and stays pinned while the list
 * scrolls. Each role is a single scannable row (dates, company, title,
 * tenure); opening it reveals the responsibilities. The current role starts
 * open, so the most relevant detail is visible without a click. Hovering a
 * row or a timeline segment highlights its counterpart.
 */
export function Experience() {
  const { experience } = useContent();
  const [open, setOpen] = useState<number | null>(0);
  const [hover, setHover] = useState<number | null>(null);

  const focus = hover ?? open;
  if (experience.length === 0) return null;

  const now = toMonth("Present")!;
  const oldest = experience[experience.length - 1];
  // The earliest readable start, falling back to this month so an unreadable date cannot produce NaN.
  const starts = experience.map((r) => toMonth(r.from)).filter((m): m is number => m !== null);
  const start = starts.length ? Math.min(...starts) : now;
  const end = now + 1;
  const span = Math.max(end - start, 1);
  const years = Math.floor(span / 12);

  return (
    <section id="experience" aria-label="Experience" className="surface-invert relative section-y">
      <div className="gutter mx-auto max-w-[1600px]">
        <SectionHeader index="05" label="Experience" count={experience.length} countNoun="Roles" />

        <div className="mt-8 grid grid-cols-1 gap-12 md:mt-12 lg:grid-cols-12 lg:gap-8">
          {/* ── Summary ─────────────────────────────── */}
          <div className="lg:col-span-4 lg:sticky lg:top-28 lg:self-start">
            <Reveal>
              <h2 className="section-title max-w-[12ch]">
                Where I&apos;ve <span className="font-accent text-bone/60">worked</span>
              </h2>
            </Reveal>

            <dl className="mt-12 grid grid-cols-2 border-t border-line md:mt-16">
              <div className="border-r border-line py-6 pr-6">
                <dt className="label">Experience</dt>
                <dd className="mt-3 text-subtitle font-light leading-none tracking-[-0.03em]" suppressHydrationWarning>
                  {years}+<span className="font-accent text-mute"> yrs</span>
                </dd>
              </div>
              <div className="py-6 pl-6">
                <dt className="label">Companies</dt>
                <dd className="mt-3 text-subtitle font-light leading-none tracking-[-0.03em]">
                  {String(experience.length).padStart(2, "0")}
                </dd>
              </div>
            </dl>

            {/* Proportional timeline: one segment per role, gaps left empty. */}
            <div className="border-t border-line pt-6">
              <div className="relative h-2 overflow-hidden bg-ink-3" aria-hidden>
                {experience.map((role, i) => {
                  const from = toMonth(role.from);
                  const to = toMonth(role.to);
                  const readable = from !== null && to !== null;
                  const left = readable ? ((from - start) / span) * 100 : 0;
                  const width = readable ? (Math.max(to + (role.to === "Present" ? 1 : 0) - from, 0) / span) * 100 : 0;
                  return (
                    <motion.button
                      key={role.company}
                      type="button"
                      tabIndex={-1}
                      onClick={() => setOpen(i)}
                      onMouseEnter={() => setHover(i)}
                      onMouseLeave={() => setHover(null)}
                      className="absolute inset-y-0"
                      style={{ left: `${left}%`, width: `calc(${width}% - 4px)` }}
                      initial={false}
                      animate={{ backgroundColor: focus === i ? "var(--color-accent)" : "var(--color-faint)" }}
                      transition={{ duration: 0.4, ease: ease.outExpo }}
                    />
                  );
                })}
              </div>
              <div className="label mt-3 flex justify-between" suppressHydrationWarning>
                <span>{oldest.from}</span>
                <span>Today</span>
              </div>
            </div>
          </div>

          {/* ── Roles ───────────────────────────────── */}
          <ol className="border-b border-line lg:col-span-7 lg:col-start-6">
            {experience.map((role, i) => {
              const current = role.to === "Present";
              const isOpen = open === i;
              const lit = focus === i;
              return (
                <li
                  key={`${role.company}-${role.from}`}
                  className="border-t border-line"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                >
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={`role-${i}`}
                    onClick={() => setOpen(isOpen ? null : i)}
                    data-cursor="view"
                    className="group grid w-full grid-cols-[auto_1fr_auto] items-start gap-x-5 py-7 text-left md:gap-x-8 md:py-9"
                  >
                    <motion.span
                      className="label mt-2 tabular-nums"
                      initial={false}
                      animate={{ color: lit ? "var(--color-accent)" : "var(--color-mute)" }}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </motion.span>

                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
                        <span className="text-item font-normal leading-[1.1] tracking-[-0.03em]">
                          {role.company}
                        </span>
                        {current && (
                          <span className="label inline-flex items-center gap-2 rounded-control border border-line px-2 py-1 !text-bone">
                            <motion.span
                              aria-hidden
                              className="size-1.5 rounded-full bg-accent"
                              animate={{ opacity: [1, 0.3, 1] }}
                              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                            />
                            Current
                          </span>
                        )}
                      </span>
                      <span className="mt-3 block text-body text-bone">{role.title}</span>
                      <span className="label mt-1.5 block">{role.location}</span>
                    </span>

                    <span className="flex items-start gap-5">
                      <span className="hidden text-right sm:block">
                        <span className="label block !text-bone">
                          {role.from} — {role.to}
                        </span>
                        <span className="label mt-2 block" suppressHydrationWarning>
                          {formatTenure(tenure(role))}
                        </span>
                      </span>
                      <span
                        aria-hidden
                        className="relative mt-1 grid size-8 shrink-0 place-items-center rounded-control border border-line transition-colors duration-300 group-hover:border-bone"
                      >
                        <span className="absolute h-px w-3 bg-bone" />
                        <motion.span
                          className="absolute h-3 w-px bg-bone"
                          initial={false}
                          animate={{ scaleY: isOpen ? 0 : 1 }}
                          transition={{ duration: 0.4, ease: ease.outExpo }}
                        />
                      </span>
                    </span>
                  </button>

                  {/* Every role's details stay in the page, collapsed (and inert) when closed, so the whole work
                      history is in the HTML that search engines and a recruiter's tools read, not only the open one. */}
                      <motion.div
                        id={`role-${i}`}
                        initial={false}
                        animate={{ height: isOpen ? "auto" : 0, opacity: isOpen ? 1 : 0 }}
                        transition={{ duration: 0.6, ease: ease.outExpo }}
                        className="overflow-hidden"
                        inert={!isOpen}
                      >
                        {/* Dates repeat here on phones, where the row hides them: drawn by CSS, so they are in the
                            page's text once. */}
                        <p
                          aria-hidden
                          data-dates={`${role.from} — ${role.to} · ${formatTenure(tenure(role))}`}
                          className="label pb-4 !text-bone before:content-[attr(data-dates)] sm:hidden"
                          suppressHydrationWarning
                        />
                        <ul className="space-y-4 pb-10 sm:pl-[3.25rem] md:pl-[4rem]">
                          {role.points.map((point, p) => (
                            <motion.li
                              key={point}
                              className="flex max-w-[62ch] gap-4 text-body leading-relaxed text-mute"
                              initial={false}
                              animate={{ opacity: isOpen ? 1 : 0, y: isOpen ? 0 : 10 }}
                              transition={{ duration: 0.6, delay: isOpen ? 0.1 + p * 0.05 : 0, ease: ease.outExpo }}
                            >
                              <span aria-hidden className="mt-[0.6em] h-px w-3 shrink-0 bg-accent" />
                              <span>{point}</span>
                            </motion.li>
                          ))}
                        </ul>
                      </motion.div>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
