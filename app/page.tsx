import { About } from "@/components/About/About";
import { SectionScene } from "@/components/Animations/SectionScene";
import { Contact } from "@/components/Contact/Contact";
import { DesignSystem } from "@/components/DesignSystem/DesignSystem";
import { Hero } from "@/components/Hero/Hero";
import { Process } from "@/components/Process/Process";
import { Projects } from "@/components/Projects/Projects";
import { Skills } from "@/components/Skills/Skills";

/** Each section is its own scene: it arrives over the previous one and recedes as the next arrives. */
export default function Home() {
  return (
    <main id="main">
      <SectionScene enter={false}>
        <Hero />
      </SectionScene>
      <SectionScene>
        <Projects />
      </SectionScene>
      <SectionScene>
        <DesignSystem />
      </SectionScene>
      <SectionScene>
        <Process />
      </SectionScene>
      <SectionScene>
        <About />
      </SectionScene>
      <SectionScene>
        <Skills />
      </SectionScene>
      <SectionScene exit={false}>
        <Contact />
      </SectionScene>
    </main>
  );
}
