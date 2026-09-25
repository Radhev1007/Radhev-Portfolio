/**
 * ─────────────────────────────────────────────────────────────
 *  SITE CONTENT
 *  All site copy lives in this file. The site carries no personal
 *  data (no location, years or employers). Placeholders: the hero
 *  name (`site.name`), contact email and profile links.
 * ─────────────────────────────────────────────────────────────
 */

export const site = {
  /**
   * Hero identity. Placeholder — replace with your name whenever you like.
   * `first` is set in the grotesk, `last` in the italic serif.
   */
  name: { first: "Your", last: "Name" },
  /** The hero's display line — `first` in Medium, `last` in Light. */
  heroTitle: { first: "UI UX", last: "Designer" },
  brand: "Portfolio",
  role: "UI/UX Designer",
  disciplines: ["UI/UX Design", "Product Design", "Interaction Design"],
  available: true,
  availabilityLabel: "Available for work",
  email: "hello@yourdomain.com",
  statement: "I design digital products and experiences that are intuitive, meaningful, and visually distinctive.",
  socials: [
    { label: "LinkedIn", href: "https://www.linkedin.com/in/your-profile" },
    { label: "Behance", href: "https://www.behance.net/your-profile" },
    { label: "Dribbble", href: "https://dribbble.com/your-profile" },
  ],
} as const;

export const navItems = [
  { id: "home", label: "Home" },
  { id: "work", label: "Work" },
  { id: "process", label: "Process" },
  { id: "about", label: "About" },
  { id: "contact", label: "Contact" },
] as const;

export type SectionId = (typeof navItems)[number]["id"];

/* ── Projects ───────────────────────────────────────────────── */

export type VisualKind = "dashboard" | "analytics" | "web" | "tablet" | "system";

export type Project = {
  slug: string;
  number: string;
  title: string;
  categories: string[];
  description: string;
  role: string;
  /** Optional real cover image in /public. When omitted, a generated interface composition is shown. */
  image?: string;
  imageAlt?: string;
  visual: VisualKind;
  /** Two-stop palette used for the project's visual and hover atmosphere. */
  palette: { from: string; to: string; ink: string };
};

export const projects: Project[] = [
  {
    slug: "government-digital-platform",
    number: "01",
    title: "Government Digital Platform",
    categories: ["UI/UX Design", "Product Design", "Dashboard"],
    description:
      "Restructuring a complex public-service platform so citizens and staff can complete critical tasks with clarity and confidence.",
    role: "UI/UX Designer",
    visual: "dashboard",
    palette: { from: "#1B2B4A", to: "#5A7BB8", ink: "#DCE6FF" },
  },
  {
    slug: "fitness-healthcare-dashboard",
    number: "02",
    title: "Fitness & Healthcare Dashboard",
    categories: ["UX/UI", "Data Visualization", "SaaS"],
    description:
      "Turning dense health and activity data into a calm, readable dashboard that supports everyday decisions.",
    role: "UI/UX Designer",
    visual: "analytics",
    palette: { from: "#12302A", to: "#3FB58E", ink: "#D6FFEF" },
  },
  {
    slug: "sports-education-platform",
    number: "03",
    title: "Sports & Education Platform",
    categories: ["UX/UI", "Web Experience", "Interaction Design"],
    description:
      "An energetic web experience connecting learners, coaches, and programs through clear journeys and expressive interaction.",
    role: "UI/UX Designer",
    visual: "web",
    palette: { from: "#3A1710", to: "#FF5A36", ink: "#FFE4DC" },
  },
  {
    slug: "real-estate-digital-experience",
    number: "04",
    title: "Real Estate Digital Experience",
    categories: ["Product Design", "Tablet", "Interaction"],
    description:
      "A tablet-first sales experience that helps people explore spaces, compare options, and understand a development at a glance.",
    role: "Product Designer",
    visual: "tablet",
    palette: { from: "#2E2718", to: "#C9A96A", ink: "#FFF3DA" },
  },
  {
    slug: "education-platform",
    number: "05",
    title: "Education Platform",
    categories: ["UX/UI", "Responsive Web", "Design System"],
    description:
      "A responsive learning platform built on a scalable design system, designed to stay consistent across every screen size.",
    role: "UI/UX Designer",
    visual: "system",
    palette: { from: "#221A3D", to: "#8E7BFF", ink: "#E9E4FF" },
  },
];

/* ── Case study ─────────────────────────────────────────────── */

export type CaseSectionVisual =
  | "none"
  | "insights"
  | "ia"
  | "flow"
  | "wireframes"
  | "visual"
  | "tokens"
  | "prototype"
  | "outcome";

export type CaseSection = {
  id: string;
  label: string;
  title: string;
  body: string;
  points?: string[];
  visual: CaseSectionVisual;
};

/**
 * Placeholder case-study structure shared by every project.
 * To write a real case study, add an entry to `caseStudyOverrides` keyed by slug.
 */
function defaultCaseStudy(p: Project): CaseSection[] {
  return [
    {
      id: "overview",
      label: "Overview",
      title: "Overview",
      body: `${p.description} Replace this paragraph with a short summary of the product, the team, your role and the scope of the engagement.`,
      visual: "none",
    },
    {
      id: "problem",
      label: "Problem",
      title: "What wasn't working",
      body: "Describe the core problem in one or two sentences. Who was struggling, where, and why it mattered to the business.",
      points: ["[Pain point one]", "[Pain point two]", "[Pain point three]"],
      visual: "none",
    },
    {
      id: "research",
      label: "Research",
      title: "Research",
      body: "Summarise the methods used — interviews, analytics review, stakeholder workshops, competitive analysis — and what you set out to learn.",
      points: ["[Method]", "[Method]", "[Method]", "[Method]"],
      visual: "none",
    },
    {
      id: "insights",
      label: "User insights",
      title: "User insights",
      body: "The most important things research revealed. Keep each insight short and actionable.",
      visual: "insights",
    },
    {
      id: "ia",
      label: "Information architecture",
      title: "Information architecture",
      body: "Explain how content and features were grouped, prioritised and named so people can predict where things live.",
      visual: "ia",
    },
    {
      id: "flow",
      label: "User flow",
      title: "User flow",
      body: "Walk through the primary journey and the decisions that removed friction from it.",
      visual: "flow",
    },
    {
      id: "wireframes",
      label: "Wireframes",
      title: "Wireframes",
      body: "Low-fidelity explorations used to test structure and hierarchy before visual design.",
      visual: "wireframes",
    },
    {
      id: "visual-design",
      label: "Visual design",
      title: "Visual design",
      body: "Describe the visual language — typography, colour, imagery — and how it supports the product's personality and usability.",
      visual: "visual",
    },
    {
      id: "design-system",
      label: "Design system",
      title: "Design system",
      body: "Tokens, components and patterns that keep the product consistent and let the team scale it.",
      visual: "tokens",
    },
    {
      id: "prototype",
      label: "Prototype",
      title: "Prototype",
      body: "How interactive prototypes were used to validate interactions with users and stakeholders.",
      visual: "prototype",
    },
    {
      id: "solution",
      label: "Final solution",
      title: "Final solution",
      body: "Present the shipped experience and the key screens that bring the solution together.",
      visual: "visual",
    },
    {
      id: "outcome",
      label: "Outcome",
      title: "Outcome",
      body: "Share what changed — only include results you can verify. Qualitative feedback is just as valid as numbers.",
      visual: "outcome",
    },
  ];
}

const caseStudyOverrides: Partial<Record<string, CaseSection[]>> = {};

export function getCaseStudy(p: Project): CaseSection[] {
  return caseStudyOverrides[p.slug] ?? defaultCaseStudy(p);
}

export function getProject(slug: string) {
  return projects.find((p) => p.slug === slug);
}

/* ── Process ────────────────────────────────────────────────── */

export const processSteps = [
  { n: "01", title: "Discover", body: "Understand users, business objectives, constraints, and context." },
  { n: "02", title: "Define", body: "Identify problems, opportunities, and product priorities." },
  { n: "03", title: "Structure", body: "Build information architecture, user flows, and wireframes." },
  { n: "04", title: "Design", body: "Create visual systems, components, and high-fidelity interfaces." },
  { n: "05", title: "Prototype", body: "Build realistic interactions and validate the experience." },
  { n: "06", title: "Refine", body: "Iterate based on feedback, testing, and product requirements." },
] as const;

/* ── About ──────────────────────────────────────────────────── */

export const about = {
  headline: ["Designer.", "Problem Solver.", "Digital Experience Creator."],
  intro:
    "I'm a UI/UX designer focused on turning complex requirements into products that feel simple, considered and human. I work across research, structure, interaction and visual design — and care about how every decision holds up once it ships.",
  secondary:
    "I work closely with product managers, engineers and stakeholders — turning research into structure, and structure into interfaces people enjoy using.",
  disciplines: [
    "UI/UX Design",
    "Product Design",
    "Interaction Design",
    "Design Systems",
    "Prototyping",
    "Visual Design",
  ],
};

/* ── Skills ─────────────────────────────────────────────────── */

export const skills = [
  { label: "UX Design", note: "Research, journeys & usability" },
  { label: "UI Design", note: "Interfaces with clear hierarchy" },
  { label: "Interaction Design", note: "Motion, states & feedback" },
  { label: "Product Design", note: "Balancing users & business" },
  { label: "Design Systems", note: "Tokens, components, governance" },
  { label: "Prototyping", note: "High-fidelity, testable flows" },
  { label: "Dashboard Design", note: "Making data legible" },
  { label: "Responsive Design", note: "Intentional at every width" },
  { label: "Visual Design", note: "Type, colour & composition" },
  { label: "Information Architecture", note: "Structure people can predict" },
] as const;
