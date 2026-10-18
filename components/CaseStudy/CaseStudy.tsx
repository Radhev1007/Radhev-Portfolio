import Image from "next/image";
import Link from "next/link";
import { Arrow, Button } from "@/components/Animations/Button";
import { workPath, type Project } from "@/lib/content";

type Props = { project: Project; next: Project };

/**
 * A project's own page: what it is, the cover, an overview, what each screen
 * covers, the design decisions visible in them, a line on what the page does
 * and does not claim, and the way on to the full set of screens on Behance.
 *
 * A server component with no entrance animation, so the heading, the copy
 * and the cover are in the HTML and painted at once — the page exists to be
 * read by people arriving from search, and by search itself.
 */
export function CaseStudy({ project, next }: Props) {
  const { story } = project;
  const heading = "text-subtitle font-light leading-[1.05] tracking-[-0.03em]";
  const prose = "mt-6 flex max-w-[62ch] flex-col gap-4 text-body leading-relaxed text-bone/75 md:text-lead md:leading-relaxed";

  return (
    <main id="main">
      <article>
        <header className="gutter mx-auto max-w-[1600px] pt-36 md:pt-44">
          <Link href="/#work" className="label inline-flex items-center gap-2 transition-colors duration-300 hover:!text-bone">
            <Arrow className="size-3 rotate-180" /> Selected work
          </Link>

          <div className="mt-10 grid grid-cols-1 gap-8 md:mt-14 md:grid-cols-12">
            <div className="md:col-span-8">
              <p className="label">
                Project {project.number}
                {project.status && <span className="ml-3 rounded-control border border-line px-2 py-1 !text-bone">{project.status}</span>}
              </p>
              <h1 className="section-title mt-6 max-w-[16ch]">{project.title}</h1>
            </div>
            <p className="section-intro md:col-span-4 md:self-end">{project.description}</p>
          </div>
        </header>

        <div className="gutter mx-auto mt-12 grid max-w-[1600px] grid-cols-1 gap-8 md:mt-16 md:grid-cols-12">
          {project.image && (
            <figure className="relative aspect-[101/79] overflow-hidden rounded-card bg-ink-3 md:col-span-8">
              <Image
                src={project.image}
                alt={project.imageAlt ?? `${project.title} cover`}
                fill
                preload
                sizes="(min-width: 768px) 66vw, 100vw"
                className="object-cover"
              />
            </figure>
          )}

          <div className="flex flex-col gap-6 border-t border-line pt-6 text-small md:col-span-4">
            <dl className="grid grid-cols-2 gap-6">
              {[
                ["Role", project.role],
                ["Published", story.published],
                ["Discipline", project.categories.join(", ")],
                ["Tools", story.tools.join(", ")],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="label mb-2">{k}</dt>
                  <dd className="text-bone/90">{v}</dd>
                </div>
              ))}
            </dl>
            <a
              href={project.href}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 self-start text-bone underline decoration-line underline-offset-4 transition-colors duration-300 hover:decoration-accent"
            >
              All screens on Behance <Arrow className="size-3 -rotate-45" />
            </a>
          </div>
        </div>

        <div className="gutter mx-auto flex max-w-[1600px] flex-col gap-20 section-y md:gap-28">
          <Chapter n="01" id="overview" title="Overview" heading={heading}>
            <div className={prose}>
              {story.overview.map((para, j) => (
                <p key={j}>{para}</p>
              ))}
            </div>
          </Chapter>

          <Chapter n="02" id="screens" title="What the design covers" heading={heading}>
            <dl className="mt-8 grid grid-cols-1 gap-x-10 gap-y-8 sm:grid-cols-2">
              {story.screens.map((sc) => (
                <div key={sc.title} className="border-t border-line pt-4">
                  <dt className="text-body font-medium text-bone">{sc.title}</dt>
                  <dd className="mt-2 text-body leading-relaxed text-bone/75">{sc.body}</dd>
                </div>
              ))}
            </dl>
          </Chapter>

          <Chapter n="03" id="decisions" title="Design decisions" heading={heading}>
            <ul className={prose}>
              {story.decisions.map((d) => (
                <li key={d} className="flex gap-4">
                  <span aria-hidden className="mt-[0.75em] h-px w-3 shrink-0 bg-accent" />
                  <span>{d}</span>
                </li>
              ))}
            </ul>
            <p className="mt-10 max-w-[62ch] border-t border-line pt-4 text-small leading-relaxed text-mute">{story.scope}</p>
          </Chapter>
        </div>

        <section aria-labelledby="behance-title" className="surface-invert relative">
          <div className="gutter mx-auto grid max-w-[1600px] grid-cols-1 gap-10 section-y md:grid-cols-12 md:gap-8">
            <h2 id="behance-title" className="section-title md:col-span-7">
              Every screen, on Behance.
            </h2>
            <div className="flex flex-col items-start gap-8 md:col-span-4 md:col-start-9 md:self-end">
              <p className="section-intro">The full {project.title} case study, with the complete set of screens and flows.</p>
              <Button href={project.href} external variant="ghost" cursorLabel="Behance">
                View on Behance
              </Button>
            </div>
          </div>
        </section>
      </article>

      <nav aria-label="Next project" className="gutter mx-auto max-w-[1600px] section-y">
        <Link href={workPath(next)} data-cursor="view" className="group flex items-end justify-between gap-6 border-t border-line pt-8">
          <span>
            <span className="label block">Next project · {next.number}</span>
            <span className="section-title mt-4 block transition-transform duration-700 ease-[var(--ease-out-expo)] group-hover:translate-x-2">
              {next.title}
            </span>
          </span>
          <span
            aria-hidden
            className="mb-2 grid size-12 shrink-0 place-items-center rounded-full border border-line transition-all duration-500 group-hover:-rotate-45 group-hover:bg-bone group-hover:text-ink md:size-16"
          >
            <Arrow />
          </span>
        </Link>
      </nav>
    </main>
  );
}

/** One numbered chapter of the page: its number on the left, the heading and body on the right. */
function Chapter({ n, id, title, heading, children }: { n: string; id: string; title: string; heading: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={`${id}-title`} className="grid grid-cols-1 gap-6 border-t border-line pt-8 md:grid-cols-12 md:gap-8">
      <p aria-hidden className="label md:col-span-3">{n}</p>
      <div className="md:col-span-7 md:col-start-5">
        <h2 id={`${id}-title`} className={heading}>
          {title}
        </h2>
        {children}
      </div>
    </section>
  );
}
