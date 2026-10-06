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
  /** The hero's display line — `first` in Medium, `last` in Light. */
  heroTitle: { first: "UI/UX", last: "Designer" },
  brand: "Radhev R",
  role: "UI/UX Designer",
  disciplines: ["UI/UX Design", "Product Design", "Design Systems"],
  available: true,
  availabilityLabel: "Available for work",
  email: "radhev1999@gmail.com",
  phone: "+91 808 982 1700",
  /** Hosted on Drive, so the CV can be updated without a deploy. */
  resume: "https://drive.google.com/file/d/1U4r89GXL9FD2KHwjFMjn_3RWmzFUPZU9/view?usp=sharing",
  location: "Kollam, Kerala",
  statement:
    "UI/UX designer with 4+ years turning user needs and business requirements into intuitive, pixel-perfect experiences across web, mobile and desktop.",
  socials: [
    { label: "LinkedIn", href: "https://www.linkedin.com/in/radhev-r-74481021a" },
    { label: "Behance", href: "https://www.behance.net/radhev1999707d" },
  ],
} as const;

export const navItems = [
  { id: "home", label: "Home" },
  { id: "work", label: "Work" },
  /** A route rather than an anchor: the self-description lives off the landing page. */
  { id: "about", label: "About", href: "/about" },
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
    slug: "governance-risk-compliance",
    number: "01",
    title: "Governance, Risk & Compliance Platform",
    categories: ["Enterprise SaaS", "Design Systems", "Dashboard"],
    description:
      "A leading enterprise GRC product designed across web, mobile and tablet, built on a scalable Figma design system that kept every touchpoint consistent.",
    role: "UI/UX Designer — Beinex Consulting",
    visual: "dashboard",
    palette: { from: "#1B2B4A", to: "#5A7BB8", ink: "#DCE6FF" },
  },
  {
    slug: "government-digital-platform",
    number: "02",
    title: "Government Digital Platform",
    categories: ["UI/UX Design", "Public Sector", "Web"],
    description:
      "Complex public-service requirements translated into intuitive flows for GCC-region clients, so citizens and staff can complete critical tasks with confidence.",
    role: "UI/UX Designer — Appstation",
    visual: "web",
    palette: { from: "#12302A", to: "#3FB58E", ink: "#D6FFEF" },
  },
  {
    slug: "fintech-product-design",
    number: "03",
    title: "Fintech Product Design",
    categories: ["Fintech", "Data Visualization", "SaaS"],
    description:
      "Dense financial data shaped into calm, readable interfaces, with front-end-ready specifications handed to developers for pixel-perfect implementation.",
    role: "UI/UX Designer — Appstation",
    visual: "analytics",
    palette: { from: "#2E2718", to: "#C9A96A", ink: "#FFF3DA" },
  },
  {
    slug: "hrtech-events-platform",
    number: "04",
    title: "HRTech & Events Platforms",
    categories: ["HRTech", "Media & Events", "Interaction"],
    description:
      "Multi-domain product work delivered in fast-paced client environments, using Auto Layout, components and variants to move from wireframe to high fidelity quickly.",
    role: "UI/UX Designer — Appstation",
    visual: "tablet",
    palette: { from: "#3A1710", to: "#FF5A36", ink: "#FFE4DC" },
  },
  {
    slug: "education-platform",
    number: "05",
    title: "Education Platform",
    categories: ["Education", "Responsive Web", "Prototyping"],
    description:
      "End-to-end design for education and technology products — requirement gathering, user flows, wireframes, high-fidelity mockups and interactive prototypes.",
    role: "UI/UX Designer — OrisysIndia",
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
      body: `${p.description} I worked as ${p.role.split("—")[0].trim()}, covering research, structure, interaction and visual design through to developer handoff.`,
      visual: "none",
    },
    {
      id: "problem",
      label: "Problem",
      title: "What wasn't working",
      body: "Complex requirements had outgrown the existing interface. People were asked to hold too much in their heads to finish routine tasks, and inconsistencies between screens made the product harder to learn than it needed to be.",
      points: [
        "Critical tasks buried under unclear navigation",
        "Inconsistent patterns repeated across screens",
        "Dense data presented without hierarchy",
      ],
      visual: "none",
    },
    {
      id: "research",
      label: "Research",
      title: "Research",
      body: "I started by understanding the people using the product and the constraints around it, working with stakeholders and BA teams to separate what users needed from what the business required.",
      points: ["Stakeholder interviews", "Requirement workshops", "Competitive analysis", "Review of existing flows"],
      visual: "none",
    },
    {
      id: "insights",
      label: "User insights",
      title: "User insights",
      body: "Research consistently pointed the same way: people wanted fewer decisions per screen, predictable placement, and a clear sense of where they were in a longer process.",
      visual: "insights",
    },
    {
      id: "ia",
      label: "Information architecture",
      title: "Information architecture",
      body: "Content and features were regrouped around the tasks people actually came to do, then named in the language they already used, so the structure could be predicted rather than learned.",
      visual: "ia",
    },
    {
      id: "flow",
      label: "User flow",
      title: "User flow",
      body: "I mapped the primary journey end to end, then removed the steps that existed for internal reasons rather than user ones, and made the remaining decisions explicit.",
      visual: "flow",
    },
    {
      id: "wireframes",
      label: "Wireframes",
      title: "Wireframes",
      body: "Low-fidelity explorations were used to settle structure and hierarchy before any visual decisions, which kept the expensive changes early and cheap.",
      visual: "wireframes",
    },
    {
      id: "visual-design",
      label: "Visual design",
      title: "Visual design",
      body: "The visual language was built for legibility first — a clear type scale, restrained colour, and enough contrast to hold up in real working conditions.",
      visual: "visual",
    },
    {
      id: "design-system",
      label: "Design system",
      title: "Design system",
      body: "Tokens, components and variants were built in Figma with Auto Layout so the team could extend the product without redrawing it, and so handoff stayed consistent.",
      visual: "tokens",
    },
    {
      id: "prototype",
      label: "Prototype",
      title: "Prototype",
      body: "Interactive prototypes carried the real interactions, which made it possible to test behaviour with users and align stakeholders on something concrete rather than a description.",
      visual: "prototype",
    },
    {
      id: "solution",
      label: "Final solution",
      title: "Final solution",
      body: "The shipped experience brings the structure, system and interactions together into screens that stay consistent across web, mobile and tablet.",
      visual: "visual",
    },
    {
      id: "outcome",
      label: "Outcome",
      title: "Outcome",
      body: "Design specifications were delivered front-end-ready in HTML and CSS, and I worked alongside developers through implementation to keep the built product faithful to the design.",
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
    "I'm a UI/UX designer with 4+ years of experience transforming user needs and business requirements into intuitive, pixel-perfect digital experiences across web, mobile and desktop. I work in Figma — components, variants, Auto Layout and scalable design systems — and bridge design with front-end development.",
  secondary:
    "I've delivered enterprise and SaaS products across Government, Fintech, HRTech, Media, Events and Education, working closely with developers, BA teams and stakeholders. Hands-on with HTML, CSS and JavaScript, so what I hand over is ready to build.",
  disciplines: [
    "UI/UX Design",
    "Product Design",
    "Design Systems",
    "Usability Testing",
    "Prototyping",
    "Responsive & Accessible Design",
  ],
};

/* ── Skills ─────────────────────────────────────────────────── */

export const skills = [
  { label: "Figma", note: "Components, variants, Auto Layout" },
  { label: "Design Systems", note: "Style guides & scalable libraries" },
  { label: "Wireframing & Prototyping", note: "Low fidelity through interactive" },
  { label: "Usability Testing", note: "Sessions, findings & iteration" },
  { label: "User Research", note: "Personas, flows & competitive analysis" },
  { label: "Responsive & Accessible Design", note: "Intentional at every width" },
  { label: "HTML & CSS", note: "Front-end-ready specifications" },
  { label: "JavaScript & React", note: "Component-based architecture" },
  { label: "Adobe CC, Miro & Hotjar", note: "XD, Photoshop, Illustrator" },
  { label: "Stakeholder Communication", note: "Cross-functional collaboration" },
] as const;
