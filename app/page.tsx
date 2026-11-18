import { Contact } from "@/components/Contact/Contact";
import { Experience } from "@/components/Experience/Experience";
import { Hero } from "@/components/Hero/Hero";
import { Projects } from "@/components/Projects/Projects";
import { About, Approach } from "@/components/Sections/Sections";
import { homeJsonLd, jsonLdString } from "@/lib/seo";

/**
 * Hero → about → selected work → approach → experience → contact.
 */
export default function Home() {
  return (
    <main id="main">
      {/* structured data for search engines: the person, the site and the selected work (lib/seo.ts) */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(homeJsonLd()) }} />
      <Hero />
      <About />
      <Projects />
      <div className="mt-10 lg:mt-[30px]">
        <Approach />
        <Experience />
        <Contact />
      </div>
    </main>
  );
}
