"use client";

import { motion } from "framer-motion";
import { Reveal } from "@/components/Animations/Reveal";
import { TextReveal } from "@/components/Animations/TextReveal";
import { IconLink } from "@/components/Hero/SocialLinks";
import type { SocialIcon } from "@/components/Hero/SocialIcons";
import { SectionHeader } from "@/components/Projects/SectionHeader";
import { site } from "@/lib/content";
import { ease } from "@/lib/motion";

/** The ways to reach me, most direct first. */
const channels = [
  { label: "Email", value: site.email, href: `mailto:${site.email}` },
  { label: "WhatsApp", value: site.phone, href: site.whatsapp, external: true },
  { label: "Phone", value: site.phone, href: `tel:${site.phone.replace(/\s/g, "")}` },
  { label: "Résumé", value: "View CV", href: site.resume, external: true },
];

const profiles = site.socials.flatMap((s) => ("icon" in s ? [{ ...s, icon: s.icon as SocialIcon }] : []));

/**
 * The close, in two columns.
 *
 * Left is the ask — headline, a line of context, whether I am taking work,
 * where I am, and the profiles. Right is the answer to "how": every channel
 * as a full-width row with its value written out, so nothing is hidden behind
 * an icon and each row is one click to act on. The section is sized by its
 * content rather than the viewport, which is what left it mostly empty.
 *
 * There is no inline form here on purpose: a form needs somewhere to submit
 * to, and a dead one that silently drops enquiries is worse than none.
 */
export function Contact() {
  return (
    <section id="contact" aria-label="Contact" className="relative gutter mx-auto max-w-[1600px] section-y">
      <SectionHeader index="06" label="Contact" />

      <div className="mt-8 grid grid-cols-1 gap-14 md:mt-12 lg:grid-cols-12 lg:gap-8">
        {/* ── The ask ─────────────────────────────── */}
        <div className="lg:col-span-6">
          <h2 className="section-title max-w-[16ch]">
            <TextReveal as="span" text="Let's build" className="block" />
            <TextReveal as="span" text="something good." delay={0.1} className="block font-accent text-bone/60" />
          </h2>

          <Reveal delay={0.15}>
            <p className="section-intro mt-6 md:mt-8">
              Have a complex product, ambitious idea or design challenge? Let&apos;s talk.
            </p>
          </Reveal>

          <Reveal delay={0.2}>
            <dl className="mt-12 grid max-w-md grid-cols-2 border-t border-line md:mt-16">
              <div className="border-r border-line py-5 pr-5">
                <dt className="label">Status</dt>
                <dd className="mt-2 flex items-center gap-2 text-body">
                  {site.available && (
                    <motion.span
                      aria-hidden
                      className="size-1.5 rounded-full bg-accent"
                      animate={{ opacity: [1, 0.3, 1] }}
                      transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                    />
                  )}
                  {site.available ? "Open to work" : "Not taking work"}
                </dd>
              </div>
              <div className="py-5 pl-5">
                <dt className="label">Based in</dt>
                <dd className="mt-2 text-body">{site.location} · IST</dd>
              </div>
            </dl>
          </Reveal>

          <Reveal delay={0.25} className="mt-10">
            <p className="label">Follow</p>
            <ul aria-label="Profiles" className="mt-4 flex flex-wrap gap-2">
              {profiles.map((p) => (
                <li key={p.label}>
                  <IconLink {...p} />
                </li>
              ))}
            </ul>
          </Reveal>
        </div>

        {/* ── The channels ────────────────────────── */}
        <ul className="border-b border-line lg:col-span-6 lg:col-start-7 lg:self-end">
          {channels.map((c, i) => (
            <li key={c.label} className="border-t border-line">
              <Reveal delay={0.15 + i * 0.06}>
                <a
                  href={c.href}
                  {...(c.external ? { target: "_blank", rel: "noreferrer" } : {})}
                  data-cursor="cta"
                  className="group grid grid-cols-[4.5rem_1fr_auto] items-center gap-3 py-6 sm:grid-cols-[6rem_1fr_auto] sm:gap-4 transition-colors duration-300 hover:text-accent md:grid-cols-[8rem_1fr_auto] md:py-8"
                >
                  <span className="label transition-colors duration-300 group-hover:!text-accent">{c.label}</span>
                  <span
                    className={`min-w-0 break-words font-medium leading-[1.1] tracking-[-0.03em] ${
                      i === 0 ? "text-lead text-accent sm:text-subtitle" : "text-lead md:text-[1.5rem]"
                    }`}
                  >
                    {c.value}
                  </span>
                  <span
                    aria-hidden
                    className="text-lead transition-transform duration-500 ease-[var(--ease-out-expo)] group-hover:-translate-y-1 group-hover:translate-x-1"
                  >
                    ↗
                  </span>
                </a>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
