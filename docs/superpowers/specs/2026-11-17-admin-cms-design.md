# Admin backend for editing portfolio content — design

Status: awaiting approval. Nothing built yet.

## Intent
The owner (a designer, not a developer) wants to change the site's text and images without editing code or redeploying. The site is hosted on Vercel, whose filesystem is read-only at runtime, so edits must live in external storage.

## Goals
- Password-protected `/admin` for one user (the owner).
- Edit text for: site info (name, role, statement, contact, socials, availability), the 6 projects (card text + full case study), experience, specialisms, process steps.
- Upload / replace images (project covers; any other image field).
- A save goes live immediately: no redeploy.
- If the database is empty or unreachable the site still renders from the current `lib/content.ts` defaults.

## Non-goals
- Multiple users, roles, comments, drafts/versioning, scheduled publishing.
- Editing layout, colours, animations or component code.
- Adding brand-new section types (editing the existing ones only).
- Migrating the RC Crawler game or `multiplayer-server`.

## Anti-goals (failure even if it "works")
- Admin edits can break the public site (bad data must be validated; fallback must always work).
- Secrets or the admin password in the repo or client bundle.
- A slower public site: public pages must stay statically cached, not hit the DB per request.

## Constraints and findings
- Content is one module, `lib/content.ts` (~500 lines): `site`, `navItems`, `projects` (with nested `story`), `experience`, `specialisms`, `processSteps`.
- 21 files import it directly as synchronous constants (Hero, Projects, ProjectCard, CaseStudy, Experience, Specialisms, Process, Contact, Footer, Navigation, StatusBar/Badge, IntroLoader, SocialLinks, layout, seo, sitemap, OG image, work/[slug]). Some are client components, so they cannot call an async fetch. This is the main refactor cost.
- `next.config.ts` supports a `build:static` export. A backend cannot run in a static export, so the admin and its API only exist in the normal (Vercel) build. The static build keeps working from `content.ts` defaults.
- Next.js here is a newer version than the author's training data (AGENTS.md): read `node_modules/next/dist/docs/` before writing route handlers, caching or cookie code.
- Project covers are 808px WebP today; uploads should be resized/converted on the way in.

## Approaches considered
- **A. Admin inside this Next app + Postgres + Vercel Blob (chosen by owner).** Instant updates, forms shaped to the owner's content, no third-party editor. Cost: we build and maintain the admin; two Vercel integrations to set up.
- B. Hosted CMS (Sanity etc.). Polished editor, but content and login live in another service; most setup; rejected.
- C. Git-based CMS (Decap/Tina). No DB, but each edit needs a redeploy and images bloat the repo; rejected.

## Design (my calls unless noted; the owner chose approach A only)
1. **Storage.** Neon Postgres via Vercel Marketplace; one table `content` holding the whole content set as a single validated JSON document (one row, plus `updated_at`). One document, not many tables, because the content is small, edited by one person, and read as a whole. Images in Vercel Blob; the JSON stores their public URLs.
2. **Single source of truth.** `lib/content.ts` stays as the typed default/seed. New `lib/content-store.ts` exposes `getContent()` (server only): reads the DB document, validates it against the existing TS shapes (a small schema, e.g. zod), falls back to defaults on empty/invalid/error, and is cached with a tag.
3. **Refactor.** Server components and pages call `getContent()` and pass data to client components as props (the 21 importers move over; types stay unchanged so layouts do not change). Pure helpers (`workPath`, `getProject`) take the data as an argument.
4. **Freshness.** Saving calls `revalidateTag` so the public pages regenerate on next request; visitors never wait on the DB.
5. **Auth.** One admin password in an env var (`ADMIN_PASSWORD`) plus a signing secret; successful login sets an HttpOnly, signed, expiring cookie; every admin page and write endpoint checks it server-side; basic rate limiting on login. No third-party auth library.
6. **Admin UI.** `/admin` (noindex, excluded from sitemap): left list of sections, a form per section, add/remove/reorder for list items (projects' screens and decisions, experience points, specialisms, process steps), image picker with upload and preview, Save with success/error state. Plain, accessible, light; not styled like the portfolio.
7. **Images.** Upload endpoint (auth required) accepts JPEG/PNG/WebP up to a size cap, converts/resizes to WebP (max width 1600), stores in Blob, returns the URL. Old images are not auto-deleted (cheap, safe).
8. **Seeding.** First admin visit offers "Load current content" which writes the `content.ts` defaults into the DB, so nothing is retyped. "Reset to defaults" is also available.
9. **Config.** `.env.example` documents `DATABASE_URL`, `BLOB_READ_WRITE_TOKEN`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`. Local dev works without them (falls back to defaults, admin shows "not configured").
10. **Static build.** `build:static` ignores the admin and DB; documented in README.

## Left to the builder
Exact form layout, schema library, resize library, login rate-limit numbers, cache-tag naming, and the file/folder structure under `app/admin`, `app/api/admin`, `lib/`.

## Owner setup (not code)
Add the Neon (Postgres) and Blob integrations to the Vercel project and set the four env vars. I will list exact steps after the build.

## Open risks
- The refactor touches many files; verify with typecheck, a production build, and a before/after visual check that the public site is unchanged.
- Editing JSON that includes colour/palette fields (per-project `palette`) needs simple colour inputs; included.
