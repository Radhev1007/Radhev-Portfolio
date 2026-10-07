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
  { id: "about", label: "About" },
  { id: "work", label: "Work" },
  { id: "process", label: "Process" },
  { id: "contact", label: "Contact" },
] as const;

export type SectionId = (typeof navItems)[number]["id"];

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
    slug: "technology-landing-page",
    image: "/projects/technology-landing-page.webp",
    imageAlt: "Technology landing page shown on desktop and mobile",
    href: "https://www.behance.net/gallery/205427461/Technology-landing-page-Desktop-Mobile-responsive",
    number: "01",
    title: "Technology Landing Page",
    categories: ["Web Design", "Responsive", "Marketing Site"],
    description: "A responsive landing page for a technology product, designed across desktop and mobile breakpoints.",
    role: "UI/UX Designer",
    visual: "web",
    palette: { from: "#1B2B4A", to: "#5A7BB8", ink: "#DCE6FF" },
  },
  {
    slug: "university-admin-dashboard",
    image: "/projects/university-admin-dashboard.webp",
    imageAlt: "University admin dashboard concept screens",
    href: "https://www.behance.net/gallery/205423733/UIUX-Design-University-Admin-Dashboard-Concept",
    number: "02",
    title: "University Admin Dashboard",
    categories: ["UI/UX Design", "Dashboard", "Education"],
    description: "An administrative dashboard concept for a university, organising dense records and daily tasks into a readable interface.",
    role: "UI/UX Designer",
    visual: "dashboard",
    palette: { from: "#221A3D", to: "#8E7BFF", ink: "#E9E4FF" },
  },
  {
    slug: "grogauge-kpi-dashboard",
    image: "/projects/grogauge-kpi-dashboard.webp",
    imageAlt: "Grogauge KPI dashboard interface",
    href: "https://www.behance.net/gallery/166160121/Grogauge-key-performance-indicators-Dashboard",
    number: "03",
    title: "Grogauge KPI Dashboard",
    categories: ["Data Visualization", "SaaS", "Dashboard"],
    description: "A key-performance-indicator dashboard, turning dense measurement data into something that can be read at a glance.",
    role: "UI/UX Designer",
    visual: "analytics",
    palette: { from: "#12302A", to: "#3FB58E", ink: "#D6FFEF" },
  },
  {
    slug: "food-delivery-case-study",
    image: "/projects/food-delivery-case-study.webp",
    imageAlt: "Food delivery application UX case study screens",
    href: "https://www.behance.net/gallery/187669415/UX-Case-Study-Food-Delivery-Application",
    number: "04",
    title: "Food Delivery Application",
    categories: ["UX Case Study", "Mobile", "Interaction"],
    description: "A UX case study for a food delivery application, worked end to end from the problem through to the interface.",
    role: "UI/UX Designer",
    visual: "tablet",
    palette: { from: "#3A1710", to: "#FF5A36", ink: "#FFE4DC" },
  },
  {
    slug: "dashboard-concept",
    image: "/projects/dashboard-concept.webp",
    imageAlt: "Dashboard concept interface",
    href: "https://www.behance.net/gallery/164544999/Dashboard-Concept",
    number: "05",
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
    number: "06",
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


/* ── Testimonials ───────────────────────────────────────────────── */

export type Testimonial = {
  quote: string;
  /** Kept literally as "Client Name" until a real, attributable quote exists. */
  name: string;
  role: string;
  company: string;
  /** Portrait in /public. Without one, an initial card stands in. */
  image?: string;
  imageAlt?: string;
};

/**
 * PLACEHOLDER COPY — these are not real client quotes.
 *
 * The attribution is deliberately literal: no invented person or company
 * appears here, so nothing on the page claims a named client said something
 * they did not. Replace the whole entry — quote, name, role, company — when
 * a real one arrives, rather than keeping a fabricated quote under a real
 * name.
 */
export const testimonials: Testimonial[] = [
  {
    quote:
      "Radhev brought clarity to a complex product and turned our interface into something that feels intuitive, purposeful and remarkably polished.",
    name: "Client Name",
    role: "Product Manager",
    company: "Company Name",
  },
  {
    quote:
      "From the initial UX direction to the smallest interaction detail, the process was thoughtful, structured and genuinely refined.",
    name: "Client Name",
    role: "Founder",
    company: "Company Name",
  },
  {
    quote:
      "Radhev understood the problem behind the brief, not just the visual requirements. The result changed how our users move through the platform.",
    name: "Client Name",
    role: "Head of Product",
    company: "Company Name",
  },
  {
    quote:
      "The quality of the work and the attention to detail went past what we expected. Every screen feels deliberate.",
    name: "Client Name",
    role: "Creative Director",
    company: "Company Name",
  },
  {
    quote:
      "A rare combination of visual craft, UX thinking and execution. Radhev lifted the whole digital experience.",
    name: "Client Name",
    role: "CEO",
    company: "Company Name",
  },
];

/** Text stands in until real marks are supplied; the strip renders either. */
export const clients = ["Company One", "Company Two", "Company Three", "Company Four", "Company Five"];

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
  /** Carries the whole About section, so it has to work as one statement. */
  intro:
    "I'm a UI/UX designer with 4+ years turning complex requirements into products that feel simple — across enterprise SaaS, government, fintech and education, from first wireframe to front-end-ready handoff.",
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
