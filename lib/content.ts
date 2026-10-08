/**
 * ─────────────────────────────────────────────────────────────
 *  SITE CONTENT
 *  All site copy lives in this file. The site carries no personal
 *  data (no location, years or employers). Placeholders: the hero
 *  name (`site.name`), contact email and profile links.
 * ─────────────────────────────────────────────────────────────
 */

export const site = {
  /** Hero identity. `first` is set in the display medium, `last` in the lighter voice. */
  name: { first: "Radhev", last: "R" },
  /**
   * The hero's positioning statement. Long enough that it sets at the display
   * step across three lines rather than the hero step across two — the hero
   * step is bound to viewport height and only fits a word or two.
   */
  heroTitle: {
    lead: "I design complex",
    mid: "digital products into",
    tail: "clear experiences.",
  },
  brand: "Radhev R",
  role: "UI/UX Designer",
  available: true,
  availabilityLabel: "Available for selected projects",
  email: "radhev1999@gmail.com",
  phone: "+91 808 982 1700",
  /** Hosted on Drive, so the CV can be updated without a deploy. */
  resume: "https://drive.google.com/file/d/1U4r89GXL9FD2KHwjFMjn_3RWmzFUPZU9/view?usp=sharing",
  location: "Kollam, Kerala",
  statement:
    "Product / UI/UX Designer specializing in enterprise SaaS, government platforms, dashboards, fintech products and scalable design systems.",
  /** The hero's two actions, in priority order. */
  heroCtas: {
    primary: { label: "View Selected Work", target: "work" },
    secondary: { label: "About Me", target: "about" },
  },
  socials: [
    { label: "LinkedIn", href: "https://www.linkedin.com/in/radhev-r-74481021a" },
    { label: "Behance", href: "https://www.behance.net/radhev1999707d" },
  ],
} as const;

export const navItems = [
  { id: "work", label: "Work" },
  { id: "about", label: "About" },
  { id: "experience", label: "Experience" },
  { id: "contact", label: "Contact" },
] as const;

/**
 * Every scrollable target, not only the ones the nav lists. "home" is reachable
 * from the wordmark and the footer without being a nav item.
 */
export type SectionId = (typeof navItems)[number]["id"] | "home";

/* ── Projects ───────────────────────────────────────────────── */

export type VisualKind = "dashboard" | "analytics" | "web" | "tablet" | "system";

export type Project = {
  slug: string;
  /** Where the full project lives. External, so the card links out. */
  href: string;
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
    slug: "university-admin-dashboard",
    image: "/projects/university-admin-dashboard.webp",
    imageAlt: "University admin dashboard concept screens",
    href: "https://www.behance.net/gallery/205423733/UIUX-Design-University-Admin-Dashboard-Concept",
    number: "01",
    title: "University Admin Dashboard",
    categories: ["UI/UX Design", "Dashboard", "Education"],
    description: "An administrative dashboard concept for a university, organising dense records and daily tasks into a readable interface.",
    role: "UI/UX Designer",
    visual: "dashboard",
    palette: { from: "#221A3D", to: "#8E7BFF", ink: "#E9E4FF" },
  },
  {
    slug: "dashboard-concept",
    image: "/projects/dashboard-concept.webp",
    imageAlt: "Dashboard concept interface",
    href: "https://www.behance.net/gallery/164544999/Dashboard-Concept",
    number: "02",
    title: "Dashboard Concept",
    categories: ["UI Design", "Dashboard", "Concept"],
    description: "A dashboard concept exploring hierarchy, density and the rhythm of a data-heavy screen.",
    role: "UI/UX Designer",
    visual: "system",
    palette: { from: "#2E2718", to: "#C9A96A", ink: "#FFF3DA" },
  },
  {
    slug: "thuna-mobile-ui",
    image: "/projects/thuna-mobile-ui.webp",
    imageAlt: "Thuna mobile app interface screens",
    href: "https://www.behance.net/gallery/128315087/UI-UX-Design-Thuna-Mobile-UI",
    number: "03",
    title: "Thuna Mobile UI",
    categories: ["UI/UX Design", "Mobile", "Product"],
    description: "Mobile interface design for Thuna, covering the core screens and the system behind them.",
    role: "UI/UX Designer",
    visual: "tablet",
    palette: { from: "#101C33", to: "#4F8BD6", ink: "#DCEAFF" },
  },
];

/* ── Case study ─────────────────────────────────────────────── */

export function getProject(slug: string) {
  return projects.find((p) => p.slug === slug);
}

/* ── Experience ─────────────────────────────────────────────── */

export type Role = {
  company: string;
  location: string;
  title: string;
  from: string;
  to: string;
  points: string[];
};

/** Roles in reverse chronological order; `to` of "Present" marks the current one. */
export const experience: Role[] = [
  {
    company: "Appstation",
    location: "Technopark, Trivandrum",
    title: "UI/UX Designer",
    from: "Jan 2025",
    to: "Present",
    points: [
      "Translate complex client requirements into intuitive UX solutions for GCC-region clients across Government, Fintech, SaaS, HRTech, Media and Events.",
      "Create wireframes, user flows and high-fidelity mockups in Figma using Auto Layout, components and variants for scalable design systems.",
      "Use AI-assisted design workflows, including Figma MCP, to shorten delivery and iteration cycles.",
      "Deliver front-end-ready specifications in HTML and CSS so developers can implement pixel-perfect.",
      "Manage stakeholder expectations across cross-functional teams in fast-paced project environments.",
    ],
  },
  {
    company: "Beinex Consulting",
    location: "Infopark, Kochi",
    title: "UI/UX Designer",
    from: "Apr 2023",
    to: "Nov 2024",
    points: [
      "Designed a leading enterprise Governance, Risk and Compliance SaaS product across web, mobile and tablet.",
      "Built and maintained a scalable Figma design system, keeping every product touchpoint consistent and faster to ship.",
      "Worked closely with development teams on pixel-perfect, responsive and accessible implementation.",
      "Ran usability testing sessions and refined concepts through competitive analysis and feedback-driven iteration.",
    ],
  },
  {
    company: "OrisysIndia Consultancy Services",
    location: "Technopark, Trivandrum",
    title: "UI/UX Designer",
    from: "Oct 2021",
    to: "Apr 2023",
    points: [
      "Designed interfaces for web apps, mobile apps and websites across Education and IT & Technology.",
      "Delivered end-to-end artifacts: requirement gathering, user flows, wireframes, high-fidelity mockups and interactive prototypes.",
      "Translated designs into front-end-ready specifications and supported developers through handoff.",
      "Partnered with project managers, BA teams and clients to align designs with user needs and business goals.",
    ],
  },
];




/** Text stands in until real marks are supplied; the strip renders either. */
/* ── Specialisms ───────────────────────────────────────────── */

export type Specialism = { id: string; title: string; blurb: string };

/** Five, in the order they matter for the work I want. */
export const specialisms: Specialism[] = [
  {
    id: "product",
    title: "Product design",
    blurb: "Complex workflows, SaaS products, dashboards and enterprise platforms.",
  },
  {
    id: "systems",
    title: "Design systems",
    blurb: "Tokens, components, variants, patterns and scalable UI libraries.",
  },
  {
    id: "strategy",
    title: "UX strategy",
    blurb: "Research, information architecture, user flows and usability.",
  },
  {
    id: "visual",
    title: "Visual design",
    blurb: "Typography, hierarchy, responsive UI and interaction design.",
  },
  {
    id: "handoff",
    title: "Design → development",
    blurb:
      "Developer handoff, HTML/CSS understanding and collaboration with engineering teams.",
  },
];

/* ── Design impact ─────────────────────────────────────────────
   Qualitative on purpose. The only number here is the one that can be
   checked against the roles below it; inventing conversion lifts and
   satisfaction scores for products under NDA is how a portfolio stops
   being believable. */

export const impact = [
  { figure: "4+", label: "Years designing products" },
  { figure: "Enterprise", label: "GRC, governance and workflow platforms" },
  { figure: "Multiple", label: "Industries — government, fintech, HRTech, education" },
  { figure: "Systems", label: "Scalable foundations, not one-off screens" },
];

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
  /** The line that does the work. Specific, and nobody else's. */
  headline: "I like complicated products.",
  intro:
    "The kind with too many screens, too many stakeholders and too much information. My job is to turn that complexity into experiences people can actually understand and use.",
  /** Where that has actually been — taken from the roles, not invented. */
  body: "Four years of it so far: enterprise GRC platforms at Beinex, government, fintech and HRTech products at Appstation, and education, web and mobile work before that. Mostly dashboards, workflows and the design systems that hold them together.",
  sectors: ["Enterprise SaaS", "Government", "Fintech", "HRTech", "Education", "Dashboards", "Design Systems"],
};


