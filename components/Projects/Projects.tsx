import Link from "next/link";
import { Reveal } from "@/components/Animations/Reveal";
import { Chip, Ext } from "@/components/Section/Section";
import { projects, workPath, type Project } from "@/lib/content";
import { ProjectImage } from "./ProjectImage";

/**
 * The work, one large cover after another, as the reference runs it: the project's words in the left rail,
 * level with the bottom of the picture, and the picture in the wide column. The cover opens the case study.
 */
export function Projects() {
  return (
    <section id="work" aria-labelledby="work-title" className="scroll-mt-[67px]">
      <h2 id="work-title" className="sr-only">
        Selected work
      </h2>
      <ul className="gutter mx-auto flex max-w-[1920px] flex-col gap-10 lg:gap-[30px]">
        {projects.map((p, i) => (
          <li key={p.slug}>
            <Project p={p} first={i === 0} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function Project({ p, first }: { p: Project; first: boolean }) {
  const [discipline, kind, industry] = p.categories;
  const meta = [p.client, industry, p.story.year].filter(Boolean).join(" · ");
  return (
    <Reveal>
      <article className="grid grid-cols-1 gap-x-5 gap-y-5 lg:grid-cols-[28.5%_1fr] lg:items-end">
        <div className="order-2 flex flex-col gap-1 text-[length:var(--text-ui)] leading-[1.7] lg:order-1">
          <h3 className="text-bone">{p.title}</h3>
          <p className="text-soft">{p.description}</p>
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
            {[discipline, kind, industry].map((c) => (
              <li key={c}>
                <Chip>{c}</Chip>
              </li>
            ))}
          </ul>
          <p className="mt-3 flex flex-wrap gap-x-5 text-bone">
            <Link href={workPath(p)} className="underline decoration-line-strong underline-offset-4 transition-colors duration-300 hover:decoration-bone">
              Case study
            </Link>
            <a
              href={p.href}
              target="_blank"
              rel="noreferrer"
              className="underline decoration-line-strong underline-offset-4 transition-colors duration-300 hover:decoration-bone"
            >
              Behance
              <Ext />
            </a>
          </p>
        </div>
        <Link href={workPath(p)} aria-label={`Read the case study: ${p.title}`} className="order-1 block lg:order-2">
          <ProjectImage src={p.image ?? ""} alt={p.imageAlt ?? p.title} priority={first} />
        </Link>
      </article>
    </Reveal>
  );
}
