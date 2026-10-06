import { SectionScene } from "@/components/Animations/SectionScene";
import { Contact } from "@/components/Contact/Contact";
import { Hero } from "@/components/Hero/Hero";
import { Projects } from "@/components/Projects/Projects";

/**
 * The landing page is the work. Everything that describes rather than shows —
 * about, experience, process, systems, capabilities — lives at /about, so the
 * projects are not competing with five sections of self-description.
 */
export default function Home() {
  return (
    <main id="main">
      <SectionScene enter={false}>
        <Hero />
      </SectionScene>
      <SectionScene>
        <Projects />
      </SectionScene>
      <SectionScene exit={false}>
        <Contact />
      </SectionScene>
    </main>
  );
}
