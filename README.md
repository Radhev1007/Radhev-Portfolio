# Portfolio

A minimal, flat-vector portfolio for a UI/UX designer, built with Next.js 16, React 19, TypeScript, Tailwind CSS 4, Framer Motion and Lenis. There is no WebGL or 3D: every visual is crisp SVG artwork.

## Run

```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm start
```

Node was installed locally at `~/.local/node` for this project. Add it to your PATH with `export PATH=$HOME/.local/node/bin:$PATH`.

## Replacing the content

All copy lives in **`lib/content.ts`**. The site carries **no personal data**: no location, years, employers or testimonials. The hero identity is a placeholder, `site.name = { first: "Your", last: "Name" }`: the first word is set in the grotesk and the second in the italic serif. The nav initials, footer and page title all follow it.

| What | Where |
| --- | --- |
| Hero name placeholder, role, disciplines eyebrow, statement, contact email and profile links | `site` |
| Projects (title, categories, description, role, palette, cover) | `projects` |
| Case-study chapters | `defaultCaseStudy()`, or add real ones to `caseStudyOverrides[slug]` |
| Process, About, Skills | the matching exports |

The placeholders are the hero name, the contact email and the profile URLs in `site`.

**Project images:** put a file in `public/images/projects/` and set `image: "/images/projects/<file>.jpg"` (plus `imageAlt`) on the project. Without an image, a generated interface composition is drawn instead (`components/ProjectCard/ProjectVisual.tsx`).

**Case-study visuals:** `components/CaseStudy/CaseVisual.tsx` renders a placeholder for each chapter. Swap any of them for `<Image>`.

## Architecture

```
app/                     routes (home, /work/[slug])
components/
  Navigation/            floating nav, active section, hide-on-scroll, mobile menu
  Hero/                  editorial opening: display type + flat illustration
  Projects/ ProjectCard/ showcase, tilt/drift hover, shared-element transition
  DesignSystem/          "Design Beyond the Screen": pinned on tablet/desktop, tabs on mobile
  Process/               horizontal scroll (desktop) / drawn path (mobile)
  About/ Skills/ Contact/ Footer/
  CaseStudy/             case-study page + chapter visuals
  Illustrations/         flat SVG illustration set (hero, design system, contact) + palette
  Animations/            TextReveal, Reveal, Magnetic, Parallax, Button
  Cursor/                custom cursor
  Providers/             Lenis smooth scroll, project transition
lib/                     content, motion tokens, hooks
styles/globals.css       design tokens (Tailwind @theme) and utilities
```

### Motion and visuals
- Easing, durations and the hero entrance timeline are in `lib/motion.ts`.
- Cursor states come from `data-cursor="view | cta | drag | hover"` (plus an optional `data-cursor-label`).
- Illustrations share one palette (`components/Illustrations/palette.ts`): black, off-white, grey and a cyan accent, all flat fills and thin strokes.
- Project covers are drawn in SVG. Add `image` to a project in `lib/content.ts` to use a real screenshot instead.

### Accessibility
The site has semantic landmarks, a skip link, visible focus rings, and a keyboard-operable menu (Esc closes it). Illustrations carry descriptive labels. `prefers-reduced-motion` disables smooth scroll, the custom cursor, parallax and transform animations.
