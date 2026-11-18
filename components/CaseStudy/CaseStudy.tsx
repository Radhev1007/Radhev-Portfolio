import Image from "next/image";
import Link from "next/link";
import { Arrow } from "@/components/Animations/Button";
import { Chip, Ext, Section } from "@/components/Section/Section";
import { workPath, type Project } from "@/lib/content";

type Props = { project: Project; next: Project };

const underline =
  "underline decoration-line-strong underline-offset-4 transition-colors duration-300 hover:decoration-bone focus-visible:decoration-bone";

/**
 * A project's own page, set in the homepage's system: a grey label in the left rail and the content in the
 * wide column, hairlines between sections, no cards. It carries the title and what the work is, the cover, the
 * overview, what each screen covers, the design decisions visible in them, a line on what the page does and
 * does not claim, the way on to the full set of screens on Behance, and the next project.
 *
 * A server component with no entrance animation, so the heading, the copy and the cover are in the HTML and
 * painted at once: the page exists to be read by people arriving from search, and by search itself.
 */
export function CaseStudy({ project, next }: Props) {
  const { story } = project;
  const facts: [string, string][] = [
    ["Role", project.role],
    ["Published", story.published],
    ["Discipline", project.categories.join(", ")],
    ["Tools", story.tools.join(", ")],
  ];

  return (
    <main id="main">
      <article>
        <header className="gutter mx-auto max-w-[1920px] pb-12 pt-[calc(67px+clamp(64px,12svh,120px))]">
          <div className="grid grid-cols-1 gap-x-5 gap-y-5 lg:grid-cols-[28.5%_1fr]">
            <Link
              href="/#work"
              className="label inline-flex items-center gap-2 self-start transition-colors duration-300 hover:text-bone focus-visible:text-bone"
            >
              <Arrow className="size-3 rotate-180" /> Selected work
            </Link>
            <div>
              <p className="label flex items-center gap-2">
                Project {project.number}
                {project.status && <Chip>{project.status}</Chip>}
              </p>
              <h1 className="mt-3 max-w-[26ch] text-[length:var(--text-h1)] leading-[1.1] tracking-[-0.033em] text-bone">
                {project.title}
              </h1>
              <p className="mt-3 max-w-[56ch] text-[length:var(--text-ui)] leading-[1.7] text-mute">{project.description}</p>
            </div>
          </div>
        </header>

        <div className="gutter mx-auto grid max-w-[1920px] grid-cols-1 gap-x-5 gap-y-8 pb-10 lg:grid-cols-[28.5%_1fr] lg:items-end">
          <div className="order-2 text-[length:var(--text-ui)] leading-[1.7] lg:order-1">
            <dl className="flex flex-col gap-3">
              {facts.map(([k, v]) => (
                <div key={k}>
                  <dt className="text-mute">{k}</dt>
                  <dd className="text-bone">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-5">
              <a href={project.href} target="_blank" rel="noreferrer" className={`text-bone ${underline}`}>
                All screens on Behance
                <Ext />
              </a>
            </p>
          </div>
          {project.image && (
            <figure className="relative order-1 aspect-[808/632] overflow-hidden rounded-card bg-ink-2 lg:order-2">
              <Image
                src={project.image}
                alt={project.imageAlt ?? `${project.title} cover`}
                fill
                quality={90}
                preload
                fetchPriority="high"
                sizes="(min-width: 1024px) 70vw, 100vw"
                className="object-cover"
              />
            </figure>
          )}
        </div>

        <Section id="overview" title="Overview">
          <div className="flex max-w-[640px] flex-col gap-4 text-[length:var(--text-ui)] leading-[1.7]">
            {story.overview.map((para, i) => (
              <p key={i} className={i === 0 ? "text-bone" : "text-soft"}>
                {para}
              </p>
            ))}
          </div>
        </Section>

        <Section id="screens" title="What the design covers">
          <dl className="text-[length:var(--text-ui)] leading-[1.7]">
            {story.screens.map((sc) => (
              <div
                key={sc.title}
                className="grid grid-cols-1 gap-x-5 border-t border-line py-5 first:border-t-0 first:pt-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]"
              >
                <dt className="text-bone">{sc.title}</dt>
                <dd className="text-soft">{sc.body}</dd>
              </div>
            ))}
          </dl>
        </Section>

        <Section id="decisions" title="Design decisions">
          <ol className="flex max-w-[640px] list-none flex-col gap-3 text-[length:var(--text-ui)] leading-[1.7] text-soft">
            {story.decisions.map((d, i) => (
              <li key={d} className="flex gap-4">
                <span aria-hidden className="w-5 shrink-0 text-mute tabular-nums">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span>{d}</span>
              </li>
            ))}
          </ol>
          <p className="mt-8 max-w-[640px] border-t border-line pt-5 text-[length:var(--text-ui)] leading-[1.7] text-mute">{story.scope}</p>
        </Section>

        <Section id="behance" title="On Behance">
          <p className="max-w-[26ch] text-[length:var(--text-h1)] leading-[1.1] tracking-[-0.033em] text-bone">Every screen, on Behance.</p>
          <p className="mt-3 max-w-[56ch] text-[length:var(--text-ui)] leading-[1.7] text-mute">
            The full {project.title} case study, with the complete set of screens and flows.
          </p>
          <p className="mt-5 text-[length:var(--text-ui)] leading-[1.7]">
            <a href={project.href} target="_blank" rel="noreferrer" className={`text-bone ${underline}`}>
              View on Behance
              <Ext />
            </a>
          </p>
        </Section>
      </article>

      <nav aria-label="Next project">
        <Section id="next" title={`Next project · ${next.number}`}>
          <Link href={workPath(next)} className="group flex items-center justify-between gap-6">
            <span className="max-w-[26ch] text-[length:var(--text-h1)] leading-[1.1] tracking-[-0.033em] text-bone transition-transform duration-700 ease-[var(--ease-out-expo)] group-hover:translate-x-2">
              {next.title}
            </span>
            <span aria-hidden className="text-bone transition-transform duration-500 group-hover:-rotate-45">
              <Arrow className="size-5" />
            </span>
          </Link>
        </Section>
      </nav>
    </main>
  );
}
