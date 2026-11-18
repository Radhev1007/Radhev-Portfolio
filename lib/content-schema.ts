import { z } from "zod";
import type { ContentData } from "@/lib/content";

const text = z.string().trim().min(1, "Required");
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a #RRGGBB colour");
const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Lowercase letters, digits and single hyphens only");
const canParse = (v: string) => URL.canParse(v);
/** An absolute http(s) URL that `new URL` accepts (so a stored value can never make URL parsing throw). */
const url = z
  .string()
  .regex(/^https?:\/\/\S+$/, "Must be an http(s) URL")
  .refine(canParse, "Not a valid URL");

/** The site's own origin: https, nothing after the host (no path, query, hash or trailing slash). */
const siteUrl = z
  .string()
  .refine(canParse, "Not a valid URL (check the host and port)")
  .refine((v) => !canParse(v) || new URL(v).protocol === "https:", "Must start with https://")
  .refine(
    (v) => !canParse(v) || v === new URL(v).origin,
    "Use just the address, like https://www.example.com (no trailing slash, path, query or #)",
  );

/** Hosts next/image is allowed to optimise (next.config.ts remotePatterns). */
export const IMAGE_HOST_SUFFIX = ".public.blob.vercel-storage.com";
const imagePath = z.string().refine((v) => {
  if (v.startsWith("/")) return !v.startsWith("//") && !/\s/.test(v);
  if (!v.startsWith("https://") || !canParse(v) || /\s/.test(v)) return false;
  return new URL(v).hostname.endsWith(IMAGE_HOST_SUFFIX);
}, `Use a path starting with "/" or an image uploaded here (https://…${IMAGE_HOST_SUFFIX})`);

/** "Jan 2025": the only date format the Experience section can read. */
const monthYear = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4}$/;
const startDate = z.string().regex(monthYear, 'Use the format "Jan 2025" (three-letter month, then year)');
const endDate = z
  .string()
  .refine((v) => v === "Present" || monthYear.test(v), 'Use the format "Jan 2025", or "Present"');

const caseStudy = z.object({
  seoTitle: text,
  seoDescription: text,
  published: text,
  year: text,
  tools: z.array(text),
  overview: z.array(text),
  screens: z.array(z.object({ title: text, body: text })),
  decisions: z.array(text),
  scope: text,
});

const project = z.object({
  slug,
  href: url,
  number: text,
  title: text,
  status: z.literal("Concept").optional(),
  categories: z.array(text),
  description: text,
  role: text,
  story: caseStudy,
  image: imagePath.optional(),
  imageAlt: z.string().optional(),
  visual: z.enum(["dashboard", "analytics", "web", "tablet", "system"]),
  palette: z.object({ from: hex, to: hex, ink: hex }),
});

const role = z.object({
  company: text,
  location: text,
  title: text,
  from: startDate,
  to: endDate,
  points: z.array(text),
});

const specialism = z.object({ id: text, title: text, blurb: text });
const processStep = z.object({ n: text, title: text, body: text });

const site = z.object({
  name: z.object({ first: text, last: text }),
  heroTitle: z.object({ lead: text, mid: text, tail: text, accent: text }),
  brand: text,
  role: text,
  url: siteUrl,
  available: z.boolean(),
  availabilityLabel: text,
  email: text,
  phone: text,
  whatsapp: url,
  resume: url,
  location: text,
  statement: text,
  heroCtas: z.object({ secondary: z.object({ label: text, target: text }) }),
  socials: z.array(z.object({ label: text, href: url, icon: text })),
});

export const contentSchema = z
  .object({
    site,
    projects: z.array(project),
    experience: z.array(role).min(1, "Keep at least one role"),
    specialisms: z.array(specialism),
    processSteps: z.array(processStep),
  })
  .superRefine((c, ctx) => {
    const seen = new Map<string, number>();
    c.projects.forEach((p, i) => {
      if (seen.has(p.slug)) {
        ctx.addIssue({
          code: "custom",
          path: ["projects", i, "slug"],
          message: `Slug must be unique (also used by project ${seen.get(p.slug)! + 1})`,
        });
      } else seen.set(p.slug, i);
    });
    const ids = new Map<string, number>();
    c.specialisms.forEach((sp, i) => {
      if (ids.has(sp.id)) {
        ctx.addIssue({
          code: "custom",
          path: ["specialisms", i, "id"],
          message: `Each specialism needs its own icon (also used by specialism ${ids.get(sp.id)! + 1})`,
        });
      } else ids.set(sp.id, i);
    });
  });

export type ParseResult =
  | { ok: true; data: ContentData }
  | { ok: false; issues: { path: string; message: string }[] };

export function parseContent(input: unknown): ParseResult {
  const r = contentSchema.safeParse(input);
  if (r.success) return { ok: true, data: r.data };
  return {
    ok: false,
    issues: r.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
  };
}

/* Compile-time check: the schema and ContentData must stay in sync, in both directions. */
type Inferred = z.infer<typeof contentSchema>;
type Assert<T extends true> = T;
export type _SchemaMatchesType = Assert<Inferred extends ContentData ? true : false>;
export type _TypeMatchesSchema = Assert<ContentData extends Inferred ? true : false>;
