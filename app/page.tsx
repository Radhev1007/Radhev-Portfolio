import Image from "next/image";
import { Reveal } from "@/components/Reveal";
import { about, experience, projects, site, skills } from "@/lib/content";

/**
 * One page, set like a printed portfolio: a masthead, the work at full
 * width, then the short written matter underneath.
 *
 * The covers are the only saturated thing here — there is no decorative
 * artwork, no section chrome and no scroll machinery competing with them.
 */
export default function Home() {
  return (
    <main id="main">
      <Masthead />
      <Work />
      <About />
      <Experience />
      <Colophon />
    </main>
  );
}

function Masthead() {
  return (
    <header className="gutter mx-auto flex min-h-[86svh] max-w-[1800px] flex-col justify-between pb-16 pt-10 md:pb-24">
      <div className="flex items-start justify-between gap-8">
        <p className="label">
          {site.name.first} {site.name.last}
        </p>
        <nav aria-label="Primary" className="flex gap-6">
          <a className="label transition-colors hover:!text-ink" href="#work">
            Work
          </a>
          <a className="label transition-colors hover:!text-ink" href="#about">
            About
          </a>
          <a className="label transition-colors hover:!text-ink" href={`mailto:${site.email}`}>
            Contact
          </a>
        </nav>
      </div>

      <div className="mt-20">
        <h1 className="max-w-[16ch] text-mast font-medium leading-[0.86] tracking-[-0.045em]">
          {site.heroTitle.first}
          <br />
          {site.heroTitle.last}
        </h1>

        <div className="mt-12 flex flex-col gap-8 md:mt-16 md:flex-row md:items-end md:justify-between">
          <p className="max-w-[46ch] text-lead leading-[1.35] text-mute">{site.statement}</p>
          <p className="label flex items-center gap-2 whitespace-nowrap">
            {site.available && <span aria-hidden className="size-1.5 rounded-full bg-accent" />}
            {site.availabilityLabel} · {site.location}
          </p>
        </div>
      </div>
    </header>
  );
}

function Work() {
  return (
    <section id="work" aria-label="Selected work" className="gutter mx-auto max-w-[1800px] pb-24 md:pb-40">
      <p className="label border-t border-rule pt-6">Selected work — {projects.length} projects</p>

      <ul className="mt-10 grid grid-cols-1 gap-x-10 gap-y-20 md:mt-16 md:grid-cols-2 md:gap-y-32">
        {projects.map((p, i) => (
          <Reveal
            as="li"
            key={p.slug}
            delay={(i % 2) * 90}
            /* The first of each pair drops to break the grid's regularity. */
            className={i % 2 === 0 ? "md:mt-0" : "md:mt-24"}
          >
            <a href={p.href} target="_blank" rel="noreferrer" className="group block">
              <div className="relative aspect-4/3 overflow-hidden bg-paper-2">
                <Image
                  src={p.image}
                  alt={p.imageAlt}
                  fill
                  sizes="(min-width: 768px) 46vw, 92vw"
                  priority={i < 2}
                  className="object-cover transition-transform duration-[1.2s] ease-[var(--ease-out-expo)] group-hover:scale-[1.03]"
                />
              </div>

              <div className="mt-6 flex items-baseline justify-between gap-6">
                <h2 className="text-title font-medium leading-[1.1] tracking-[-0.03em]">{p.title}</h2>
                <span className="label shrink-0">{p.number}</span>
              </div>
              <p className="label mt-3">{p.categories.join(" · ")}</p>
              <p className="mt-4 max-w-[48ch] text-small leading-relaxed text-mute">{p.description}</p>
              <span className="label mt-5 inline-block text-ink transition-colors group-hover:!text-accent">
                View on Behance ↗
              </span>
            </a>
          </Reveal>
        ))}
      </ul>
    </section>
  );
}

function About() {
  return (
    <section id="about" aria-label="About" className="gutter mx-auto max-w-[1800px] pb-24 md:pb-40">
      <p className="label border-t border-rule pt-6">About</p>
      <Reveal>
        <p className="mt-10 max-w-[30ch] text-display font-medium leading-[1.05] tracking-[-0.035em] md:mt-16">
          {about.intro}
        </p>
      </Reveal>

      <Reveal delay={120}>
        <ul className="mt-14 flex flex-wrap gap-x-10 gap-y-3 md:mt-20">
          {skills.map((s) => (
            <li key={s.label} className="text-body text-mute">
              {s.label}
            </li>
          ))}
        </ul>
      </Reveal>
    </section>
  );
}

function Experience() {
  return (
    <section aria-label="Experience" className="gutter mx-auto max-w-[1800px] pb-24 md:pb-40">
      <p className="label border-t border-rule pt-6">Experience</p>

      <ol className="mt-10 md:mt-16">
        {experience.map((role, i) => (
          <Reveal as="li" key={`${role.company}-${role.from}`} delay={i * 70}>
            <div className="grid grid-cols-1 gap-3 py-8 md:grid-cols-12 md:gap-8 md:py-10">
              <p className="label md:col-span-3">
                {role.from} — {role.to}
              </p>
              <div className="md:col-span-5">
                <h3 className="text-title font-medium leading-[1.15] tracking-[-0.03em]">{role.company}</h3>
                <p className="label mt-2">{role.location}</p>
              </div>
              <p className="text-body text-mute md:col-span-4">{role.title}</p>
            </div>
          </Reveal>
        ))}
      </ol>
    </section>
  );
}

function Colophon() {
  return (
    <footer className="gutter mx-auto max-w-[1800px] pb-12">
      <div className="border-t border-rule pt-10 md:pt-16">
        <a
          href={`mailto:${site.email}`}
          className="inline-block break-all text-display font-medium leading-[1] tracking-[-0.04em] transition-colors duration-500 hover:text-accent"
        >
          {site.email}
        </a>

        <div className="mt-14 flex flex-col gap-6 md:mt-20 md:flex-row md:items-center md:justify-between">
          <ul className="flex flex-wrap gap-8">
            {site.socials.map((s) => (
              <li key={s.label}>
                <a
                  className="label transition-colors hover:!text-accent"
                  href={s.href}
                  target="_blank"
                  rel="noreferrer"
                >
                  {s.label} ↗
                </a>
              </li>
            ))}
            <li>
              <a className="label transition-colors hover:!text-accent" href={site.resume} target="_blank" rel="noreferrer">
                Résumé ↗
              </a>
            </li>
          </ul>
          <p className="label">
            © {new Date().getFullYear()} {site.name.first} {site.name.last}
          </p>
        </div>
      </div>
    </footer>
  );
}
