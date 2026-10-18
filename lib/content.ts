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
    /** Set in the accent colour wherever it appears in the headline. */
    accent: "products",
  },
  brand: "Radhev R",
  role: "UI/UX Designer",
  /** The live address: canonical URL, sitemap, share cards and structured data are built on it. */
  url: "https://www.radhev.in",
  available: true,
  availabilityLabel: "Available for selected projects",
  email: "radhev1999@gmail.com",
  phone: "+91 808 982 1700",
  /** The nav's "Let's talk" opens a WhatsApp chat with this number. */
  whatsapp: "https://wa.me/918089821700",
  /** Hosted on Drive, so the CV can be updated without a deploy. */
  resume: "https://drive.google.com/file/d/1FGt65CDoKoxUXWIjAgswC5341gIOfaFl/view?usp=sharing",
  location: "Kollam, Kerala",
  statement:
    "Product / UI/UX Designer specializing in enterprise SaaS, government platforms, dashboards, fintech products and scalable design systems.",
  /**
   * The hero's two actions. The CV is the primary — it is what a recruiter
   * opens first — and the secondary jumps to the work history in the page.
   */
  heroCtas: {
    secondary: { label: "View Experience", target: "experience" },
  },
  /** Shown as icons in the hero's social rail, in this order. */
  socials: [
    { label: "Behance", href: "https://www.behance.net/radhev1999707d", icon: "behance" },
    { label: "Dribbble", href: "https://dribbble.com/radhevr1550", icon: "dribbble" },
    { label: "Pinterest", href: "https://in.pinterest.com/radhev99/", icon: "pinterest" },
    { label: "LinkedIn", href: "https://www.linkedin.com/in/radhev-r-74481021a", icon: "linkedin" },
  ],
} as const;

export const navItems = [
  { id: "work", label: "Work" },
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

/**
 * The write-up on a project's own page (/work/[slug]).
 *
 * Only what the published work shows. These projects are on Behance as
 * screens with no written case study, so the page describes those screens and
 * the decisions visible in them; it claims no research, testing, clients or
 * results that the work does not evidence. `scope` says so on the page.
 */
export type CaseStudy = {
  /** The page's search title, before the " — Radhev R" the layout adds. */
  seoTitle: string;
  /** The search snippet and share text, about 155 characters so it is not cut. */
  seoDescription: string;
  /** Month and year it was published on Behance, shown beside the role. */
  published: string;
  /** Year alone, for structured data. */
  year: string;
  tools: string[];
  /** Who it is for and what it does. */
  overview: string[];
  /** What each screen (or part of the screen) covers. */
  screens: { title: string; body: string }[];
  /** Design decisions that can be seen in the screens. */
  decisions: string[];
  /** What the page does and does not claim. */
  scope: string;
};

export type Project = {
  slug: string;
  /** The full set of screens on Behance, linked from the project's page and card. */
  href: string;
  number: string;
  title: string;
  /** "Concept" for self-initiated work, shown on the card and the page; omitted when not confirmed either way. */
  status?: "Concept";
  categories: string[];
  description: string;
  role: string;
  story: CaseStudy;
  /** Optional real cover image in /public. When omitted, a generated interface composition is shown. */
  image?: string;
  imageAlt?: string;
  visual: VisualKind;
  /** Two-stop palette used for the project's visual and hover atmosphere. */
  palette: { from: string; to: string; ink: string };
};

const conceptScope =
  "A self-initiated concept, published on Behance. This page describes the published screens and the decisions visible in them; no user research, testing or launch results are claimed.";

export const projects: Project[] = [
  {
    slug: "university-admin-dashboard",
    status: "Concept",
    story: {
      seoTitle: "University Admin Dashboard — UI/UX Concept",
      seoDescription:
        "University admin dashboard concept by Radhev R: certificate approvals, AI pre-check exceptions, record verification and an audit trail on one screen.",
      published: "Aug 2024",
      year: "2024",
      tools: ["Figma"],
      overview: [
        "A concept dashboard for a university's academic records office, designed around Kuwait University's branding: the screen the person signing off degree certificates opens at the start of the day.",
        "One screen holds the whole job: what is waiting and what is over its deadline, what has been done today, which records an automated pre-check has flagged for a human decision, a way to verify any record, and an audit trail for compliance.",
      ],
      screens: [
        { title: "Insights", body: "Four cards: total work items and how many are over the SLA, actions taken today with the average turnaround, open exceptions awaiting an override decision, and the share of records the AI pre-check cleared, with how many it escalated." },
        { title: "Certificate approval queue", body: "Each degree certificate with the student, request ID, programme and batch, and a Review action on every row." },
        { title: "Exceptions needing override", body: "A record the AI pre-check flagged with low confidence, with Approve Override and Deny side by side." },
        { title: "Recent audit entries", body: "Timestamped approvals and AI escalations, each tagged with its status." },
        { title: "Verify a record", body: "Look up any record by document ID or QR code." },
        { title: "Header", body: "The date, the day's meetings, Compliance Export and View Audit Logs, reachable from anywhere on the page." },
      ],
      decisions: [
        "Exceptions sit apart from the routine queue, so the records that need a human decision are not buried among the ones that only need a review.",
        "Every number on an insight card carries its context line (over SLA, average turnaround, escalated), so no figure stands alone.",
        "Compliance tasks, the export and the audit logs, live in the header rather than in a separate section.",
      ],
      scope: conceptScope,
    },
    image: "/projects/university-admin-dashboard.webp",
    imageAlt: "University admin dashboard: insight cards, a certificate approval queue, audit log entries and exceptions flagged by AI pre-checks",
    href: "https://www.behance.net/gallery/205423733/UIUX-Design-University-Admin-Dashboard-Concept",
    number: "01",
    title: "University Admin Dashboard",
    categories: ["UI/UX Design", "Dashboard", "Education"],
    description:
      "A concept dashboard for a university records office: the day's certificate approvals, AI-flagged exceptions, record verification and an audit trail on one screen.",
    role: "UI/UX Designer",
    visual: "dashboard",
    palette: { from: "#221A3D", to: "#8E7BFF", ink: "#E9E4FF" },
  },
  {
    slug: "dashboard-concept",
    status: "Concept",
    story: {
      seoTitle: "Employee Self-Service Dashboard — UI Concept",
      seoDescription:
        "Employee self-service dashboard concept by Radhev R: leave and loan balances, uncovered hours, requests and forms on one desktop screen, designed in Figma.",
      published: "Feb 2023",
      year: "2023",
      tools: ["Figma", "Photoshop", "Jitter"],
      overview: [
        "A desktop dashboard concept for an employee self-service portal: the page an employee lands on to see where they stand and start a request.",
        "It brings together the day's first entry, loan and leave balances, absences, uncovered working hours, recent requests and every request form, with an AI assistant one click away.",
      ],
      screens: [
        { title: "My inquiries", body: "The first entry of the day, the loan balance and the leave balance as tiles, a + tile beside them, and absences this month against this year." },
        { title: "Uncovered hours", body: "A gauge of uncovered hours against net uncovered hours." },
        { title: "My last requests", body: "Recent requests, such as leave return, with their dates and Pending status, paged." },
        { title: "All request forms", body: "Every form in one list: leave encashment, a medical insurance card, an exceptional promotion study, a family visit request." },
        { title: "Loan balance inquiry", body: "Loan amount against the amount paid so far, as a chart." },
        { title: "Navigation", body: "Home, Delegation, Requests and Sanad across the top, and AI Assistance in the greeting row." },
      ],
      decisions: [
        "The balances people check most sit first, as large figures, above the requests and forms.",
        "Requests already made and forms to start one sit side by side, so checking a request and making a new one happen on the same screen.",
      ],
      scope: conceptScope,
    },
    image: "/projects/dashboard-concept.webp",
    imageAlt: "Employee self-service dashboard: loan and leave balances, an uncovered-hours gauge, recent requests and request forms",
    href: "https://www.behance.net/gallery/164544999/Dashboard-Concept",
    number: "02",
    title: "Employee Self-Service Dashboard",
    categories: ["UI Design", "Dashboard", "HR"],
    description:
      "A concept home screen for an employee self-service portal: balances, uncovered hours, recent requests and every request form in one view.",
    role: "UI/UX Designer",
    visual: "system",
    palette: { from: "#2E2718", to: "#C9A96A", ink: "#FFF3DA" },
  },
  {
    slug: "thuna-mobile-ui",
    story: {
      seoTitle: "Thuna Care Mobile App — Elder-Care UI/UX",
      seoDescription:
        "Thuna.Care mobile app UI by Radhev R: an elder-care app with an SOS button, vitals, companion visits and an emergency responder flow, designed in Figma.",
      published: "Sep 2021",
      year: "2021",
      tools: ["Figma", "Photoshop"],
      overview: [
        "Mobile UI for Thuna.Care, an elder-care app for families whose parents live at home: in its own words, trusted local companions who care for your parents like family, helping daily, monitoring vitals and giving you peace of mind.",
        "The design covers two people: the elder, whose home screen is built around getting help, and the emergency responder, who takes a call from dispatch through to the family.",
      ],
      screens: [
        { title: "Elder's home", body: "A welcome with the elder's name, age and area; a large SOS button (“Emergency help needed?”); blood pressure across the week; the next companion visit and the days it happens; and two actions, I am okay and Call attender." },
        { title: "Responder's home", body: "The responder's name and role, Call attender, the admin helpline, and four tiles for the job: En route, On scene, Contact family, Submit summary." },
        { title: "Emergency dispatch", body: "The elder's name, distance and address with View on map, Accept or Cancel, then Started and Call family." },
        { title: "Navigation", body: "Home, Responders, My vitals, Notifications and Profile." },
      ],
      decisions: [
        "On the elder's screen the SOS button is the largest target and the first thing on the screen.",
        "The daily check-in is two large buttons, I am okay and Call attender, rather than a form.",
        "The responder's job is laid out as four steps in the order they happen, from en route to the summary.",
      ],
      scope:
        "Published on Behance. This page describes the published screens and the decisions visible in them; no user research, testing or launch results are claimed.",
    },
    image: "/projects/thuna-mobile-ui.webp",
    imageAlt: "Thuna.Care mobile app screens: splash, an elder's home screen with an SOS button and vitals, and an emergency responder's dispatch",
    href: "https://www.behance.net/gallery/128315087/UI-UX-Design-Thuna-Mobile-UI",
    number: "03",
    title: "Thuna Care Mobile App",
    categories: ["UI/UX Design", "Mobile", "Healthcare"],
    description:
      "An elder-care mobile app: a one-tap SOS and daily check-in for the elder, and an emergency dispatch flow for the responder.",
    role: "UI/UX Designer",
    visual: "tablet",
    palette: { from: "#101C33", to: "#4F8BD6", ink: "#DCEAFF" },
  },
];

/* ── Case study ─────────────────────────────────────────────── */

/** A project's own page on this site. */
export const workPath = (p: Project) => `/work/${p.slug}`;

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



/* ── Process ────────────────────────────────────────────────── */

export const processSteps = [
  { n: "01", title: "Discover", body: "Understand users, business objectives, constraints, and context." },
  { n: "02", title: "Define", body: "Identify problems, opportunities, and product priorities." },
  { n: "03", title: "Structure", body: "Build information architecture, user flows, and wireframes." },
  { n: "04", title: "Design", body: "Create visual systems, components, and high-fidelity interfaces." },
  { n: "05", title: "Prototype", body: "Build realistic interactions and validate the experience." },
  { n: "06", title: "Refine", body: "Iterate based on feedback, testing, and product requirements." },
] as const;




