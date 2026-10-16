# Portfolio

A minimal, flat-vector portfolio for a UI/UX designer, built with Next.js 16, React 19, TypeScript, Tailwind CSS 4, Framer Motion and Lenis. There is no WebGL or 3D: every visual is crisp SVG artwork.

## Typography

Three self-hosted families, all wired through `next/font` in `app/layout.tsx` — no external font requests at runtime:

| Role | Family | Source |
| --- | --- | --- |
| Display (`h1`–`h3`, `font-accent`) | Cabinet Grotesk 500/700/800 | `public/fonts/cabinet-grotesk/`, Fontshare, ITF Free Font License |
| UI and body | Geist | `next/font/google` |
| Meta labels (`label` utility, status bar) | Geist Mono | `next/font/google` |

## Run

```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm start
```

Node was installed locally at `~/.local/node` for this project. Add it to your PATH with `export PATH=$HOME/.local/node/bin:$PATH`.

## RC Crawler multiplayer

The garage game (`public/rc-crawler`) has optional online multiplayer (up to 20 players) and voice chat. It needs
a separately deployed Node server in `multiplayer-server/`; see `multiplayer-server/README.md`. Set
`NEXT_PUBLIC_RC_MULTIPLAYER_URL` (see `.env.example`) to that server's `wss://` URL. Without it, the game and
the rest of the site work as before and the Multiplayer screen says no server is configured.

## RC Crawler vehicle bodies

Besides the SCX30 Wrangler shell, players can pick a hard body for the same RC chassis (title screen or
Settings; other players see it in multiplayer). Tyres, axles and handling are identical for every body.

| Body | Model | Licence |
| --- | --- | --- |
| `assets/vehicles/bronco.glb` | [“2022 Ford Bronco”](https://sketchfab.com/3d-models/2022-ford-bronco-9eda0b20a8454f7b936ac2a393d82e8f) by tonielpro520 | CC BY 4.0 |
| `assets/vehicles/cruiser.glb` | [“Older Matte Land Cruiser”](https://sketchfab.com/3d-models/older-matte-land-cruiser-6fc05e37e8174446884981282dbc7a0d) by jtressle | CC BY 4.0 |

Both are adapted: the Bronco is kept as modelled except its road wheels; the Land Cruiser also loses its running
gear and is simplified. Geometry and textures are recompressed. The game credits them in
Settings and Controls. `tools/rc-bodies.mjs` rebuilds a body from the downloaded model (usage at the top of the
file); its wheel positions go into `public/rc-crawler/src/vehicles/bodies.js`.

## Replacing the content

All copy lives in **`lib/content.ts`**. Content is populated from the owner's CV: name, role, contact, projects, skills and about copy all live in `site`, `projects`, `skills` and `about`. The nav initials, footer and page title all follow it.

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
