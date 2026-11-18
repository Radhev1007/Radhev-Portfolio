"use client";

import { useState } from "react";
import { Reveal } from "@/components/Animations/Reveal";
import { CopySection } from "@/components/Section/Parts";
import { experience, experienceSection } from "@/lib/content";

/**
 * Work experience as an accordion: each role is a row of company, title and dates; opening it shows the
 * summary and key contributions. The current role starts open, and any number can be open at once.
 */
export function Experience() {
  const [open, setOpen] = useState<Set<string>>(
    () => new Set([experience[0].company]),
  );
  const toggle = (company: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (!next.delete(company)) next.add(company);
      return next;
    });

  return (
    <CopySection id="experience" copy={experienceSection}>
      <Reveal>
        <ul className="border-b border-line text-[length:var(--text-ui)] leading-[1.7]">
          {experience.map((r, i) => {
            const isOpen = open.has(r.company);
            const panel = `role-${i}`;
            return (
              <li key={r.company} className="border-t border-line">
                <h4>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={panel}
                    onClick={() => toggle(r.company)}
                    className="group grid w-full cursor-pointer grid-cols-[1fr_auto] items-start gap-x-5 py-7 text-left sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_13rem_1rem]"
                  >
                    <span className="text-bone">{r.company}</span>
                    <span
                      aria-hidden
                      className="relative mt-[0.6em] size-2.5 justify-self-end text-mute transition-colors duration-300 group-hover:text-bone sm:order-last"
                    >
                      <span className="absolute left-0 top-1/2 h-px w-full bg-current" />
                      <span
                        className={`absolute left-1/2 top-0 h-full w-px bg-current transition-transform duration-300 ${isOpen ? "scale-y-0" : ""}`}
                      />
                    </span>
                    <span className="col-span-2 text-soft sm:col-span-1">
                      {r.title}
                    </span>
                    <span className="col-span-2 text-mute sm:col-span-1 sm:text-right">
                      {r.from} – {r.to}
                    </span>
                  </button>
                </h4>
                <div
                  id={panel}
                  role="region"
                  aria-label={`${r.company}, details`}
                  className={`grid transition-[grid-template-rows] duration-500 ease-[var(--ease-out-expo)] motion-reduce:transition-none ${isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
                >
                  <div className="overflow-hidden" inert={!isOpen}>
                    <div className="pb-12">
                      <p className="text-mute">{r.location}</p>
                      <div className="mt-6 flex max-w-[640px] flex-col gap-5 text-soft">
                        {r.summary.map((p) => (
                          <p key={p}>{p}</p>
                        ))}
                      </div>
                      <p className="label mt-8">Key contributions</p>
                      <ul className="mt-4 flex max-w-[640px] list-disc flex-col gap-2.5 pl-5 lg:gap-1.5 text-soft marker:text-mute">
                        {r.points.map((pt) => (
                          <li key={pt}>{pt}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </Reveal>
    </CopySection>
  );
}
