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
  /** The hero headline: a short greeting set large, then one line on what I do. Also used on the share card. */
  heroTitle: {
    greeting: "Hi, I’m Radhev",
    tagline: "Senior UI/UX & Product Designer crafting intuitive and visually engaging digital experiences.",
  },
  /** The homepage hero's supporting copy: one sentence. */
  intro: [
    "For 5 years I've been turning complex requirements into intuitive digital products across enterprise SaaS, fintech and government, through thoughtful UX, refined interfaces and scalable design systems.",
  ],
  /** Figures shown under the hero copy. */
  highlights: [
    { value: "5 Years", label: "of Experience" },
    { value: "18+", label: "Client Projects" },
    { value: "400+", label: "Screens Designed" },
    { value: "Enterprise", label: "& Product Design" },
  ],
  brand: "Radhev R",
  /** One wording everywhere: the hero, the footer, the share card and structured data. */
  role: "Senior UI/UX & Product Designer",
  /** The live address: canonical URL, sitemap, share cards and structured data are built on it. */
  url: "https://www.radhev.in",
  available: true,
  availabilityLabel: "Open to Senior UI/UX Designer and Product Designer opportunities",
  email: "radhev1999@gmail.com",
  phone: "+91 808 982 1700",
  /** The nav's "Let's talk" opens a WhatsApp chat with this number. */
  whatsapp: "https://wa.me/918089821700",
  /** Hosted on Drive, so the CV can be updated without a deploy. */
  resume: "https://drive.google.com/file/d/1aZVd8yCqh1uFCw_0ubPjlkxiKlwqtgYv/view?usp=sharing",
  location: "Kerala, India",
  statement:
    "Senior UI/UX and Product Designer with 5 years of experience across enterprise SaaS, fintech and government. 18+ client projects for Qatar and the GCC, specialising in complex dashboards and scalable design systems.",
  /**
   * The hero's two actions. The CV is the primary — it is what a recruiter
   * opens first — and the secondary jumps to the work, the evidence behind it.
   */
  heroCtas: {
    primary: { label: "Explore My Work", target: "work" },
  },
  /** The tagline used in the footer. */
  tagline: "Designing thoughtful digital experiences through UX, visual design, and systems thinking.",
  /** Shown as icons in the hero's social rail, in this order. */
  socials: [
    { label: "Behance", href: "https://www.behance.net/radhev1999707d", icon: "behance" },
    { label: "Dribbble", href: "https://dribbble.com/radhevr1550", icon: "dribbble" },
    { label: "Pinterest", href: "https://in.pinterest.com/radhev99/", icon: "pinterest" },
    { label: "LinkedIn", href: "https://www.linkedin.com/in/radhev-r-74481021a", icon: "linkedin" },
  ],
} as const;

export const navItems = [
  { id: "about", label: "About" },
  { id: "work", label: "Selected Work" },
  { id: "approach", label: "Approach" },
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
  /** The organisation the work is for or about, where the title names one. */
  client?: string;
  categories: string[];
  description: string;
  role: string;
  /** What I did on it, as a short list. */
  contribution: string[];
  story: CaseStudy;
  /** Optional real cover image in /public. When omitted, a generated interface composition is shown. */
  image?: string;
  imageAlt?: string;
  visual: VisualKind;
  /** Two-stop palette used for the project's visual and hover atmosphere. */
  palette: { from: string; to: string; ink: string };
};

const conceptScope =
  "A self-initiated concept, published on Behance.";

const baseProjects: Omit<Project, "contribution">[] = [
  {
    slug: "dilmon-property-dashboard",
    client: "Dilmon",
    story: {
      seoTitle: "Dilmon Property Management Dashboard — UI/UX",
      seoDescription:
        "Property portfolio dashboard by Radhev R: portfolio value, capital structure, geographic exposure and each asset's loans on a tablet admin app, in Figma.",
      published: "Oct 2026",
      year: "2026",
      tools: ["Figma"],
      overview: [
        "A tablet admin dashboard for Dilmon, a real-estate investment portfolio: the place to see what the portfolio is worth, how it is financed and where it sits, then drill into any one asset.",
        "Three screens carry it: an overview of the whole portfolio, an explorer that lists and filters every asset, and an asset page with its performance, debt facilities and location. The interface switches between Arabic and English.",
      ],
      screens: [
        { title: "Overview", body: "Four insight cards, portfolio value, debt outstanding, equity value and number of assets, over portfolio allocation by sector, capital structure, a revenue, EBITDA and NOI snapshot, and a world map of geographic exposure." },
        { title: "Filters", body: "Asset class, portfolio, region and currency across the top of the overview and the explorer, with a search by asset in the header." },
        { title: "Portfolio explorer", body: "Every asset as a row, with its value, debt, equity, occupancy and LTV, country, type and status, beside a filter panel for asset type, status, performance against budget, financing and documents." },
        { title: "Asset detail", body: "One asset, Claridge's in the example: its value, debt, equity, LTV and acquisition date, and a performance chart that switches between revenue, EBITDA, NOI, occupancy, ADR, RevPAR and valuation, with its documents and financing a click away." },
        { title: "Capital structure", body: "The asset's loan facilities in a sortable table: lender, type, currency, balance, limit, interest, maturity and LTV, with upcoming maturities picked out in the accent colour." },
        { title: "Geographic context", body: "A map of where the asset sits, with its region, country, city and coordinates." },
      ],
      decisions: [
        "The overview runs from the portfolio's totals to its make-up to where it is, so each section answers the question the one above it raises.",
        "Every row in the explorer carries the same five figures, so assets can be compared down the list without opening each one.",
        "The filters are about money and paperwork as well as place: above or below budget, refinancing due, overdue valuation, missing report.",
        "Gold is kept for the active state and for what needs attention, such as a maturing loan, on an otherwise near-black interface.",
      ],
      scope:
        "Published on Behance, where the full set of screens lives.",
    },
    image: "/projects/dilmon-property-dashboard.jpg",
    imageAlt: "Dilmon property dashboard on a tablet: portfolio value, debt and equity cards, portfolio allocation, capital structure, a performance snapshot and a geographic exposure map",
    href: "https://www.behance.net/gallery/257441355/Dilmon-Property-management-Admin-Dashboard",
    number: "01",
    title: "Dilmon Property Management Dashboard",
    categories: ["UI/UX Design", "Dashboard", "Real Estate"],
    description:
      "A tablet admin dashboard for a real-estate investment portfolio: value, capital structure and geographic exposure, down to each asset's loans and performance.",
    role: "UI/UX Designer",
    visual: "analytics",
    palette: { from: "#1E1A0F", to: "#E0A82E", ink: "#FFF1D1" },
  },
  {
    slug: "kia-landing-page",
    client: "Kuwait Investment Authority",
    status: "Concept",
    story: {
      seoTitle: "Kuwait Investment Authority Landing Page — UI Concept",
      seoDescription:
        "Kuwait Investment Authority landing page concept by Radhev R: the two funds, seven decades of history, investor FAQs and opportunities, designed in Figma.",
      published: "Aug 2024",
      year: "2024",
      tools: ["Figma"],
      overview: [
        "A concept landing page for the Kuwait Investment Authority, the sovereign wealth fund of the State of Kuwait: the page that has to explain an institution most visitors know only by name.",
        "It moves from what KIA is, to why the visitor has come, to the two funds it manages, its history, the questions people ask and the ways to work with it.",
      ],
      screens: [
        { title: "Hero", body: "“Safeguarding Kuwait's Wealth for Future Generations” over the Kuwait Towers, with Explore our Investments and a note that it is the world's first sovereign wealth fund, established in 1953." },
        { title: "About", body: "One sentence on what KIA is, with three figures beside it: 1953, two funds, and four offices in Kuwait City, London, Shanghai and Beijing." },
        { title: "What brings you here?", body: "Three paths for three kinds of visit: what KIA does, its investments, and its governance, labelled Understand, Explore and Verify." },
        { title: "Two funds, two mandates", body: "The General Reserve Fund and the Future Generations Fund side by side, each with its own card and action." },
        { title: "Seven decades of growth", body: "A timeline from the Kuwait Investment Board in London in 1953 to today, drawn as bars over the city skyline and labelled as an illustrative profile, since KIA does not publish its assets under management." },
        { title: "FAQ and opportunities", body: "Investor questions in an accordion, then training programmes, careers, scholarships and tenders, each with how many are open." },
      ],
      decisions: [
        "Visitors are sorted by what they came for, with three paths near the top, rather than by the organisation's own structure.",
        "The growth chart says plainly that it is illustrative, because the real figure is not public.",
        "Gold is held back for the funds' actions and the timeline's year; the rest of the page is blue, sand and black.",
      ],
      scope:
        "A concept published on Behance, not the Kuwait Investment Authority's live website.",
    },
    image: "/projects/kia-landing-page.jpg",
    imageAlt: "Kuwait Investment Authority landing page concept on a laptop: the line Safeguarding Kuwait's Wealth for Future Generations over the Kuwait Towers",
    href: "https://www.behance.net/gallery/205427461/KIA-Concept-landing-page",
    number: "02",
    title: "Kuwait Investment Authority Landing Page",
    categories: ["UI/UX Design", "Website", "Government"],
    description:
      "A landing page concept for Kuwait's sovereign wealth fund: what it is, its two funds, seven decades of history and the ways to work with it.",
    role: "UI/UX Designer",
    visual: "web",
    palette: { from: "#07163A", to: "#3D7BFF", ink: "#DDE8FF" },
  },
  {
    slug: "university-admin-dashboard",
    client: "Kuwait University",
    status: "Concept",
    story: {
      seoTitle: "KW University Admin Dashboard & Student App — UI/UX Case Study",
      seoDescription:
        "Kuwait University student app and admin dashboard concept by Radhev R: classes, credits, courses and certificate requests, with AI-checked staff approvals.",
      published: "Aug 2024",
      year: "2024",
      tools: ["Figma"],
      overview: [
        "A concept for Kuwait University in two parts: a mobile app where students follow their classes, credits, courses and requests, and a desktop dashboard where academic staff review, decide on and audit the certificate requests those students send.",
        "It starts from one problem: a student's academic life is spread across portals, email and group chats, so the schedule, credit progress and the status of a request each live somewhere different, and dense academic data is hard to read on a phone between lectures.",
      ],
      screens: [
        { title: "Brand", body: "A new mark and wordmark built on one set of guides, shown as an app icon, a notification, a profile, a store listing and a student ID card." },
        { title: "Student home", body: "Credit progress as a gauge, 90 of 120, with GPA and semester, quick actions to register, request a certificate or ask the AI assistant, and today's schedule." },
        { title: "Schedule and assignments", body: "Class cards with Live and Upcoming chips, room codes and times; due work grouped by day, with High priority chips." },
        { title: "Certificates & records", body: "Requests by type with status chips, from transcripts to degree certificates, and a New Request flow that branches on payment into submitted, failed and retry, or ready with a notification." },
        { title: "Courses and profile", body: "AI-recommended courses with the seats left, and a profile with GPA, credits, courses, achievements and settings." },
        { title: "Admin dashboard", body: "The approver's desktop view: work items against the SLA, the certificate approval queue, exceptions flagged by the AI pre-check, record verification by document ID or QR code, and the audit trail." },
      ],
      decisions: [
        "What a student checks between lectures, credits, today's classes and what is due, sits on one home screen rather than behind separate tabs.",
        "A request shows its live status in the app, the gap the case study's review found in the portals, email and group chats students use now.",
        "Any certificate can be verified by document ID or QR code, so an employer can check it without a stamped letter.",
        "Blue #0CACE2 and yellow #F9D633 from the mark carry the interface, with amber, green and red kept for status.",
        "The case study closes with its own usability review of the screens, listing what still needs fixing, such as figures that disagree between screens and a payment step that asks for a bank PIN inside the app.",
      ],
      scope:
        "A self-initiated concept, published on Behance, with provisional personas and an expert usability review of the screens.",
    },
    image: "/projects/kw-university-dashboard-app.jpg",
    imageAlt: "Kuwait University dashboard and mobile cover: the student app's home screen, with credit progress and today's schedule, on a phone between dark rocks",
    href: "https://www.behance.net/gallery/205423733/KW-University-Admin-Dashboard-Concept",
    number: "03",
    title: "KW University Admin Dashboard & Student App",
    categories: ["UI/UX Design", "Dashboard & Mobile", "Education"],
    description:
      "A student app for classes, credits, courses and certificate requests, and the staff dashboard that approves them, with AI pre-checks and an audit trail.",
    role: "UI/UX Designer",
    visual: "dashboard",
    palette: { from: "#0A1B2A", to: "#0CACE2", ink: "#DDF5FF" },
  },
  {
    slug: "stride-fitness-dashboard",
    client: "Stride",
    status: "Concept",
    story: {
      seoTitle: "Stride Health & Fitness Dashboard — UI/UX Case Study",
      seoDescription:
        "Health and fitness dashboard concept by Radhev R: consolidated KPIs, prioritised client health alerts, heart-rate trends and weekly workout compliance.",
      published: "Mar 2023",
      year: "2023",
      tools: ["Figma", "Photoshop"],
      overview: [
        "Stride is a concept dashboard for gym trainers and fitness coaches: one place to monitor client health, track workout performance and decide who to follow up with, instead of reading those things off separate apps.",
        "The problem it answers is fragmented data. Health readings, workout activity and progress live in different places and arrive without context, so monitoring takes time and a trainer has little visibility into how a client is actually moving. The design pulls the metrics, the alerts and the follow-up list into one screen.",
      ],
      screens: [
        { title: "Overview dashboard", body: "Four KPI cards across the top: total clients, activity today, health metrics recorded this week, and how many clients need attention. Below them the day's fitness insight, the heart-rate chart and weekly workout compliance." },
        { title: "Client health alerts", body: "Clients with abnormal readings, each with the reading that triggered it and a severity label, High or Medium, that sets the order of follow-ups." },
        { title: "Workout analytics", body: "Heart rate, calories burned and workout duration as three series on one chart, with weekly compliance beside it as completed, scheduled and missed." },
        { title: "Client progress", body: "Recent activity and per-client progress indicators side by side: who logged what, and how far each client is through their goal." },
        { title: "Wearable sync", body: "Heart rate streams from the client's watch during a session, so readings land in Health Metrics and raise alerts without anyone entering them." },
        { title: "Navigation", body: "Overview, Clients, Health Metrics, Workout Analytics, Fitness Insights, Progress Reports and Workout Plans down the left, with filter and export pinned below them." },
      ],
      decisions: [
        "The roster's status reads from the first four KPI cards, so a trainer can see the whole caseload before opening any one client.",
        "Health alerts are ranked by severity rather than by time, which puts the clients who need attention above the ones who only need a look.",
        "Heart rate, calories and duration share one chart instead of three, because the change a trainer is looking for is the relationship between them.",
        "Weekly compliance separates missed sessions into their own colour, so a gap in the plan is visible without counting.",
        "The interface is built on one typeface, Archivo, and a four-colour palette — coral #F35746 for action and alerts, a lime accent, greyscale and white — on a 1920px grid with 40px margins.",
      ],
      scope:
        "A self-initiated concept, published on Behance, with role-based personas built from the brief and outcomes stated as goals.",
    },
    image: "/projects/stride-health-fitness.jpg",
    imageAlt: "Stride health and fitness dashboard cover: the Health & Fitness Dashboard title beside a trainer, with heart-rate, weekly compliance and attention-required callouts",
    href: "https://www.behance.net/gallery/166160121/Stride-Health-Fitness-Case-Study",
    number: "04",
    title: "Stride Health & Fitness Dashboard",
    categories: ["UI/UX Design", "Dashboard", "Health & Fitness"],
    description:
      "A dashboard concept for gym trainers: client health alerts ranked by severity, workout analytics and weekly compliance for a whole roster on one screen.",
    role: "UI/UX Designer",
    visual: "analytics",
    palette: { from: "#2B1310", to: "#F35746", ink: "#FFE3DD" },
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
    image: "/projects/dashboard-concept.jpg",
    imageAlt: "Employee self-service dashboard: loan and leave balances, an uncovered-hours gauge, recent requests and request forms",
    href: "https://www.behance.net/gallery/164544999/Dashboard-Concept",
    number: "05",
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
    client: "Thuna.Care",
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
        "Published on Behance, where the full set of screens lives.",
    },
    image: "/projects/thuna-mobile-ui.jpg",
    imageAlt: "Thuna.Care mobile app screens: splash, an elder's home screen with an SOS button and vitals, and an emergency responder's dispatch",
    href: "https://www.behance.net/gallery/128315087/UI-UX-Design-Thuna-Mobile-UI",
    number: "06",
    title: "Thuna Care Mobile App",
    categories: ["UI/UX Design", "Mobile", "Healthcare"],
    description:
      "An elder-care mobile app: a one-tap SOS and daily check-in for the elder, and an emergency dispatch flow for the responder.",
    role: "UI/UX Designer",
    visual: "tablet",
    palette: { from: "#101C33", to: "#4F8BD6", ink: "#DCEAFF" },
  },
];

/** The wording shown on the homepage and at the top of each project page. */
const projectCopy: Record<string, { description: string; overview: string[]; contribution: string[] }> = {
  "dilmon-property-dashboard": {
    description: "Bringing real estate investment data into one clear, connected experience.",
    overview: [
      "Dilmon is a property management dashboard concept designed to simplify the way real estate investment portfolios are monitored and managed.",
      "The experience brings essential investment information into a centralised interface, helping users understand portfolio value, capital structure, geographic exposure, asset performance, and associated loans.",
      "The dashboard focuses on presenting complex financial and property information through a structured, accessible interface.",
    ],
    contribution: ["Dashboard interface design.", "Information hierarchy.", "Data visualisation.", "Portfolio overview experience.", "Responsive interface considerations."],
  },
  "kia-landing-page": {
    description: "A digital introduction to one of Kuwait's most significant investment institutions.",
    overview: [
      "A landing page concept for Kuwait Investment Authority, designed to communicate the organisation's identity, history, investment structure, and institutional information through a clear digital experience.",
      "The concept brings important information together, including its two funds, history spanning seven decades, and opportunities to engage with the organisation.",
      "The content structure focuses on making institutional information easier to discover while maintaining a professional digital presence.",
    ],
    contribution: ["Website interface design.", "Content hierarchy.", "Information organisation.", "Visual design.", "Responsive layout considerations."],
  },
  "university-admin-dashboard": {
    description: "Connecting the student experience with streamlined academic administration.",
    overview: [
      "An education platform concept designed around two connected experiences: a student-facing mobile application and an administrative dashboard.",
      "The student application provides access to classes, credits, courses, and certificate requests. The administrative experience supports staff in reviewing and approving requests through structured workflows.",
      "The concept also explores AI-assisted pre-checks and audit trails to support a more organised request management process.",
    ],
    contribution: [
      "Student application interface design.",
      "Administrative dashboard design.",
      "User flow organisation.",
      "Request management workflows.",
      "Information architecture.",
      "Interface consistency across platforms.",
    ],
  },
  "stride-fitness-dashboard": {
    description: "Helping fitness trainers understand client progress through meaningful health insights.",
    overview: [
      "Stride is a health and fitness dashboard concept designed for gym trainers and fitness coaches who need a clearer view of their clients' health information and progress.",
      "The dashboard brings together health alerts, workout analytics, and weekly compliance information, helping trainers monitor multiple clients from a centralised workspace.",
      "The experience prioritises clear data presentation and a structured overview of the information trainers need during their daily work.",
    ],
    contribution: ["Dashboard UX/UI design.", "Health information hierarchy.", "Data visualisation.", "Client monitoring experience.", "Workout analytics presentation."],
  },
  "dashboard-concept": {
    description: "Making everyday employee tasks and workplace information easier to access.",
    overview: [
      "An employee self-service dashboard concept designed to bring essential workplace information and employee requests into a single interface.",
      "The home screen provides an overview of leave balances, uncovered hours, recent requests, and commonly used request forms.",
      "The goal is to create a more organised employee experience by making frequently needed information and actions accessible from one place.",
    ],
    contribution: ["Dashboard UI design.", "Information hierarchy.", "Employee request interface.", "Data presentation.", "Interface organisation."],
  },
  "thuna-mobile-ui": {
    description: "Making everyday elder care and emergency assistance more connected.",
    overview: [
      "Thuna Care is a mobile application concept focused on supporting elderly individuals and their caregivers.",
      "The experience explores two important interactions: a simple daily check-in and a one-tap SOS feature for the elderly user, alongside an emergency response flow for the responder.",
      "The concept focuses on making essential actions straightforward and reducing friction during situations where clarity and accessibility matter.",
    ],
    contribution: ["Mobile application UX/UI.", "User flow design.", "Emergency interaction design.", "Daily check-in experience.", "Interface design."],
  },
};

export const projects: Project[] = baseProjects.map((p) => {
  const c = projectCopy[p.slug];
  return { ...p, description: c.description, contribution: c.contribution, story: { ...p.story, overview: c.overview } };
});

/* ── Case study ─────────────────────────────────────────────── */

/** A project's own page on this site. */
export const workPath = (p: Project) => `/work/${p.slug}`;

export function getProject(slug: string) {
  return projects.find((p) => p.slug === slug);
}

/* ── Section copy ───────────────────────────────────────────── */

/** The header every homepage section shares: a rail label, a headline and an optional lead. */
export type SectionCopy = { label: string; headline: string; description?: string };

export type Numbered = { title: string; body: string };

/* About */
export const aboutSection: SectionCopy = {
  label: "A little about me",
  headline: "I turn complex problems into thoughtful digital experiences.",
};
export const about = [
  "I'm Radhev, a UI/UX Designer passionate about creating digital experiences that bring clarity to complexity.",
  "Over the past five years, I've worked across enterprise SaaS, fintech, government, education, and technology, designing products for different business needs and user groups.",
  "My experience spans the complete design process, from understanding requirements and structuring user journeys to creating wireframes, interactive prototypes, and polished interfaces.",
  "At Appstation, I've contributed to digital products for Qatar and GCC clients across multiple industries. Previously, at Beinex Consulting, I worked on Aurex, an enterprise Governance, Risk, and Compliance platform, where I explored complex workflows, data-heavy dashboards, and scalable design systems.",
  "I believe good design goes beyond visual appearance. It should make information easier to understand, interactions easier to navigate, and products more meaningful to the people who use them.",
] as const;
export const aboutClosing =
  "I'm always interested in exploring new challenges, improving my design approach, and creating digital products that make a difference.";

/* Selected work */
export const workSection: SectionCopy = {
  label: "Selected projects",
  headline: "A collection of ideas, interfaces, and digital experiences.",
  description:
    "From enterprise platforms and data-rich dashboards to mobile applications and responsive websites, here's a selection of projects that reflect my approach to solving design challenges.",
};

/* Specialisms: not shown on the page, used for search (lib/seo.ts) */
export type Specialism = { id: string; title: string; blurb: string };
export const specialisms: Specialism[] = [
  {
    id: "product",
    title: "Product Design",
    blurb: "Designing end-to-end digital experiences for enterprise platforms and business applications, translating requirements into user flows, wireframes, and interactive prototypes.",
  },
  {
    id: "systems",
    title: "Design Systems",
    blurb: "Building scalable Figma design systems using design tokens, variables, reusable components, variants, and Auto Layout.",
  },
  {
    id: "research",
    title: "UX Research & Usability",
    blurb: "Applying user research, usability testing, heuristic evaluations, competitive analysis, and analytical insights to inform design decisions.",
  },
  {
    id: "visual",
    title: "Visual & Interaction Design",
    blurb: "Creating structured, intuitive, and visually engaging interfaces with a focus on information hierarchy, interaction patterns, responsive layouts, and accessibility.",
  },
  {
    id: "handoff",
    title: "Design to Development",
    blurb: "Bridging design and implementation through clear documentation, developer-ready specifications, design QA, and an understanding of front-end technologies.",
  },
];

/* How I design */
export const approachSection: SectionCopy = {
  label: "My approach",
  headline: "A thoughtful process behind every experience.",
  description:
    "Every product comes with its own challenges. My approach is to understand the problem, create structure, explore solutions, and refine the experience through collaboration and iteration.",
};
/** Each step carries an illustration of that step (public/approach) that follows the pointer while its row is hovered. */
export const approach: (Numbered & { image: string })[] = [
  { title: "Discover", body: "Understand the product, business requirements, user needs, and project constraints before exploring solutions.", image: "/approach/discover.svg" },
  { title: "Structure", body: "Organise information architecture, define user journeys, and create clear flows that connect different parts of the experience.", image: "/approach/structure.svg" },
  { title: "Prototype", body: "Translate ideas into wireframes and interactive prototypes to explore structure, functionality, and user interactions.", image: "/approach/prototype.svg" },
  { title: "Systemise", body: "Create consistent interface patterns and reusable components that support the product as it evolves.", image: "/approach/systemise.svg" },
  { title: "Validate", body: "Review usability, evaluate interface consistency, gather feedback, and refine design decisions through iteration.", image: "/approach/validate.svg" },
  { title: "Deliver", body: "Prepare clear design specifications, collaborate with developers, and support implementation through design QA.", image: "/approach/deliver.svg" },
];

/* Experience */
export const experienceSection: SectionCopy = {
  label: "My journey",
  headline: "Experience shaped by different products, people, and challenges.",
  description:
    "My professional journey has given me the opportunity to work across different industries, product types, and digital experiences. Each role has helped me strengthen my approach to UX, visual design, and product thinking.",
};

export type Role = {
  company: string;
  location: string;
  title: string;
  from: string;
  to: string;
  summary: string[];
  points: string[];
};

/** Roles in reverse chronological order; `to` of "Present" marks the current one. */
export const experience: Role[] = [
  {
    company: "Appstation Pvt Ltd",
    location: "Technopark, Trivandrum, India",
    title: "Senior UI/UX Designer",
    from: "January 2025",
    to: "Present",
    summary: [
      "At Appstation, I work on digital products for clients across Qatar and the GCC, contributing to projects in government, fintech, SaaS, HRTech, media, and events.",
      "My work involves translating complex requirements into structured user experiences, designing scalable interfaces, and supporting product delivery across different platforms.",
    ],
    points: [
      "Contributed to 18+ client projects across six business domains.",
      "Worked on projects for Invest Qatar, Milaha, MOCI, MOT, NPC, QOC, QFZ, Joud BNPL, and Applabtracker CRM.",
      "Designed user flows, wireframes, interactive prototypes, and high-fidelity interfaces.",
      "Contributed to more than 400 screens across digital products.",
      "Built reusable Figma components, variants, and design tokens.",
      "Used Figma MCP and Figma AI to support design workflows and improve delivery speed.",
      "Prepared developer-ready specifications and supported design QA.",
      "Mentored junior designers and contributed to design reviews.",
    ],
  },
  {
    company: "Beinex Consulting Pvt Ltd",
    location: "Infopark, Kochi, India",
    title: "UI/UX Designer",
    from: "April 2023",
    to: "November 2024",
    summary: [
      "At Beinex, I worked on Aurex, an AI-powered enterprise Governance, Risk, and Compliance platform.",
      "My work focused on simplifying complex enterprise workflows and designing data-heavy dashboards and reporting experiences across web, tablet, and mobile.",
    ],
    points: [
      "Contributed to the complete UX/UI redesign of Aurex.",
      "Worked across 21 product modules.",
      "Designed dashboard and reporting experiences for enterprise users.",
      "Built and maintained a scalable Figma design system.",
      "Worked with design tokens, variables, and reusable components.",
      "Conducted usability testing and heuristic evaluations.",
      "Used Hotjar analytics and competitive analysis to inform design iterations.",
      "Collaborated with developers on responsive and accessible interfaces.",
    ],
  },
  {
    company: "OrisysIndia Consultancy Services LLP",
    location: "Technopark, Trivandrum, India",
    title: "UI/UX Designer",
    from: "October 2021",
    to: "April 2023",
    summary: [
      "Orisys was where I began my professional journey in UI/UX design. I worked across education, IT, and technology projects, gaining experience in designing websites, dashboards, and mobile applications.",
      "This role helped me build a strong foundation in interface design, user flows, prototyping, and developer collaboration.",
    ],
    points: [
      "Worked on 10+ client projects.",
      "Designed websites, dashboards, and mobile applications.",
      "Translated project requirements into user flows and wireframes.",
      "Created high-fidelity interfaces and interactive Figma prototypes.",
      "Prepared design specifications for development.",
      "Collaborated with project managers, business analysts, clients, and developers.",
    ],
  },
];

/** The tools shown under the hero. `mark` keys into components/Hero/ToolStrip. */
export const tools = [
  { name: "Figma", mark: "figma" },
  { name: "Photoshop", mark: "photoshop" },
  { name: "Jitter", mark: "jitter" },
  { name: "Blender", mark: "blender" },
  { name: "Claude", mark: "claude" },
  { name: "ChatGPT", mark: "chatgpt" },
  { name: "Hotjar", mark: "hotjar" },
  { name: "HTML", mark: "html5" },
  { name: "CSS", mark: "css" },
  { name: "React", mark: "react" },
] as const;

/* Contact */
export const contactSection = {
  label: "Let's connect",
  headline: "Have an interesting challenge? Let's create something meaningful.",
  description: [
    "I'm interested in opportunities where I can contribute to meaningful digital products, solve complex design problems, and collaborate with teams that value thoughtful user experiences.",
    "If you're looking for a designer who brings together UX thinking, visual design, and product understanding, I'd be happy to connect.",
  ],
} as const;

/* Footer */
export const footerNav = [
  { label: "Home", target: "home" },
  { label: "Selected Work", target: "work" },
  { label: "About", target: "about" },
  { label: "Experience", target: "experience" },
  { label: "Contact", target: "contact" },
] as const;
