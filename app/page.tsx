import { About } from "@/components/About/About";
import { SectionScene } from "@/components/Animations/SectionScene";
import { Contact } from "@/components/Contact/Contact";
import { DesignSystem } from "@/components/DesignSystem/DesignSystem";
import { Experience } from "@/components/Experience/Experience";
import { Hero } from "@/components/Hero/Hero";
import { Process } from "@/components/Process/Process";
import { Projects } from "@/components/Projects/Projects";
import { Impact } from "@/components/Impact/Impact";
import { Specialisms } from "@/components/Specialisms/Specialisms";

/**
 * Person → work → expertise → experience → contact.
 *
 * The work comes second, directly under the positioning statement, because
 * it is the thing worth looking at. The previous order put three sections of
 * self-description in front of it, which reads as a CV rather than a
 * portfolio. Each section is its own scene — it arrives over the previous one
 * and recedes as the next arrives.
 */
export default function Home() {
  return (
    <main id="main">
      <SectionScene>
        <Hero />
      </SectionScene>
      <SectionScene>
        <Projects />
      </SectionScene>
      <SectionScene>
        <DesignSystem />
      </SectionScene>
      <SectionScene>
        <Specialisms />
      </SectionScene>
      <SectionScene>
        <Impact />
      </SectionScene>
      <SectionScene>
        <About />
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
