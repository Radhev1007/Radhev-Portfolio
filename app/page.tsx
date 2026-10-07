import { About } from "@/components/About/About";
import { SectionScene } from "@/components/Animations/SectionScene";
import { Contact } from "@/components/Contact/Contact";
import { DesignSystem } from "@/components/DesignSystem/DesignSystem";
import { Experience } from "@/components/Experience/Experience";
import { Hero } from "@/components/Hero/Hero";
import { Process } from "@/components/Process/Process";
import { Projects } from "@/components/Projects/Projects";
import { Skills } from "@/components/Skills/Skills";

/**
 * Order follows the reference: a statement, then a short who-I-am, then what
 * I do, then the work as the largest block, then how I work, then the ask.
 * Each section is its own scene — it arrives over the previous one and
 * recedes as the next arrives.
 */
export default function Home() {
  return (
    <main id="main">
      <SectionScene enter={false}>
        <Hero />
      </SectionScene>
      <SectionScene>
        <About />
      </SectionScene>
      <SectionScene>
        <Skills />
      </SectionScene>
      <SectionScene>
        <DesignSystem />
      </SectionScene>
      <SectionScene>
        <Projects />
      </SectionScene>
      <SectionScene>
        <Process />
      </SectionScene>
      <SectionScene>
        <Experience />
      </SectionScene>
      <SectionScene exit={false}>
        <Contact />
      </SectionScene>
    </main>
  );
}
