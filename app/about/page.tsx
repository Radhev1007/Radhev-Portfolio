import type { Metadata } from "next";
import { About } from "@/components/About/About";
import { SectionScene } from "@/components/Animations/SectionScene";
import { DesignSystem } from "@/components/DesignSystem/DesignSystem";
import { Experience } from "@/components/Experience/Experience";
import { Process } from "@/components/Process/Process";
import { Skills } from "@/components/Skills/Skills";
import { site } from "@/lib/content";

export const metadata: Metadata = {
  title: "About",
  description: site.statement,
};

/**
 * Everything self-descriptive lives here rather than on the landing page,
 * which is given over to the work. Order runs from who, through where, to how.
 */
export default function AboutPage() {
  return (
    <main id="main" className="pt-24 md:pt-32">
      <SectionScene enter={false}>
        <About />
      </SectionScene>
      <SectionScene>
        <Experience />
      </SectionScene>
      <SectionScene>
        <Process />
      </SectionScene>
      <SectionScene>
        <DesignSystem />
      </SectionScene>
      <SectionScene exit={false}>
        <Skills />
      </SectionScene>
    </main>
  );
}
