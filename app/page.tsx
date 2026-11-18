import { About } from "@/components/About/About";
import { Clients } from "@/components/Clients/Clients";
import { Contact } from "@/components/Contact/Contact";
import { Experience } from "@/components/Experience/Experience";
import { Focus } from "@/components/Focus/Focus";
import { Hero } from "@/components/Hero/Hero";
import { OpenTo } from "@/components/OpenTo/OpenTo";
import { Projects } from "@/components/Projects/Projects";
import { homeJsonLd, jsonLdString } from "@/lib/seo";

/**
 * Hero → selected work → recent engagements → about → focus → previously worked with → open to
 * conversations → connect. The reference's order, with the work straight under the introduction.
 */
export default function Home() {
  return (
    <main id="main">
      {/* structured data for search engines: the person, the site and the selected work (lib/seo.ts) */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(homeJsonLd()) }} />
      <Hero />
      <Projects />
      <div className="mt-10 lg:mt-[30px]">
        <Experience />
        <About />
        <Focus />
        <Clients />
        <OpenTo />
        <Contact />
      </div>
    </main>
  );
}
