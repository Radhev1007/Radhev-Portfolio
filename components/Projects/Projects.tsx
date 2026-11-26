import Link from "next/link";
import { Reveal } from "@/components/Animations/Reveal";
import Magnet from "@/components/Magnet/Magnet";
import { Chip, Ext } from "@/components/Section/Section";
import { Headline, Lead, linkClass } from "@/components/Section/Parts";
import { projects, site, workPath, workSection, type Project } from "@/lib/content";
import { ProjectImage } from "./ProjectImage";

const behance = site.socials.find((s) => s.label === "Behance")!.href;
/** The profiles shown as pills under the intro, where the rest of the work lives. */
const profiles = site.socials.filter((s) => s.label === "Behance" || s.label === "Dribbble");

/**
 * Selected work: the section label, headline and intro, the profile pills and a round
 * "View all works" link in a left column that stays in view (from desktop up); the projects stacked in the
 * wide column beside it, each a cover with its title, description, details, tags and links underneath.
 * Hovering a cover brings up a round "View Project" mark. All text uses the site's existing type styles.
 */
export function Projects() {
  return (
    <section id="work" aria-labelledby="work-title" className="scroll-mt-[67px] border-t border-line">
      <div className="gutter mx-auto grid max-w-[1920px] grid-cols-1 gap-x-5 gap-y-14 py-20 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-x-[6vw] lg:py-24">
        <div className="lg:sticky lg:top-[calc(67px+40px)] lg:self-start">
          <Reveal>
            <h2 id="work-title" className="label flex items-center gap-4">
              <span aria-hidden className="h-px w-12 bg-line-strong" />
              {workSection.label}
            </h2>
            <div className="mt-8">
              <Headline>{workSection.headline}</Headline>
              <Lead className="mt-5">{workSection.description}</Lead>
            </div>
            <ul aria-label="More work on" className="mt-8 flex flex-wrap gap-2.5">
              {profiles.map((s) => (
                <li key={s.label}>
                  <a
                    href={s.href}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block rounded-full border border-line-strong px-4 py-2 text-[length:var(--text-ui)] leading-none text-soft transition-colors duration-300 hover:border-bone hover:text-bone focus-visible:border-bone focus-visible:text-bone"
                  >
                    {s.label}
                    <Ext />
                  </a>
                </li>
              ))}
            </ul>
            <div aria-hidden className="mt-10 h-px max-w-[560px] bg-line" />
            <div className="mt-12">
              <Magnet padding={80} magnetStrength={3}>
                <a
                  href={behance}
                  target="_blank"
                  rel="noreferrer"
                  className="group grid size-40 place-items-center rounded-full border border-line-strong text-center text-[length:var(--text-ui)] leading-[1.4] text-bone transition-colors duration-500 hover:border-bone hover:bg-bone hover:text-ink focus-visible:border-bone focus-visible:bg-bone focus-visible:text-ink"
                >
                  <span>
                    <span
                      aria-hidden
                      className="mb-1 block transition-transform duration-500 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                    >
                      ↗
                    </span>
                    View all works
                    <Ext />
                  </span>
                </a>
              </Magnet>
            </div>
          </Reveal>
        </div>

        <ul className="flex flex-col gap-20 lg:gap-24">
          {projects.map((p, i) => (
            <li key={p.slug}>
              <ProjectCard p={p} first={i === 0} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function ProjectCard({ p, first }: { p: Project; first: boolean }) {
  const [discipline, kind, industry] = p.categories;
  const meta = [p.client, industry].filter(Boolean).join(" · ");
  return (
    <Reveal>
      <article>
        <Link href={workPath(p)} aria-label={`Read the case study: ${p.title}`} className="group/card relative block">
          <ProjectImage src={p.image ?? ""} alt={p.imageAlt ?? p.title} priority={first} />
          {/* the round mark that comes up over the cover on hover (mouse and keyboard focus) */}
          <span
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 z-10 grid size-28 -translate-x-1/2 -translate-y-1/2 scale-50 place-items-center rounded-full bg-bone text-center text-[length:var(--text-ui)] leading-[1.3] text-ink opacity-0 transition-[opacity,scale] duration-500 ease-[var(--ease-out-expo)] group-hover/card:scale-100 group-hover/card:opacity-100 group-focus-visible/card:scale-100 group-focus-visible/card:opacity-100 motion-reduce:transition-none"
          >
            View
            <br />
            Project
          </span>
        </Link>
        <div className="mt-7 flex flex-col gap-2 text-[length:var(--text-ui)] leading-[1.7]">
          <div className="flex items-start justify-between gap-5">
            <h3 className="mb-1 max-w-[22ch] text-[length:var(--text-h1)] leading-[1.1] tracking-[-0.033em] text-bone">{p.title}</h3>
            <span className="mt-1 shrink-0">
              <Chip>{p.story.year}</Chip>
            </span>
          </div>
          <p className="max-w-[60ch] text-soft">{p.description}</p>
          <p className="text-mute">
            {meta}
            <span className="block">{p.role}</span>
          </p>
          <ul aria-label="Categories" className="mt-3 flex flex-wrap gap-1.5">
            {p.status && (
              <li>
                <Chip>{p.status}</Chip>
              </li>
            )}
            {[discipline, kind, industry].filter(Boolean).map((c) => (
              <li key={c}>
                <Chip>{c}</Chip>
              </li>
            ))}
          </ul>
          <p className="mt-3 flex flex-wrap gap-x-5">
            <Link href={workPath(p)} className={linkClass}>
              Explore project
            </Link>
            <a href={p.href} target="_blank" rel="noreferrer" className={linkClass}>
              Behance
              <Ext />
            </a>
          </p>
        </div>
      </article>
    </Reveal>
  );
}
