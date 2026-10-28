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
    mid: "enterprise products",
    tail: "that feel simple.",
    /** Set in the accent colour wherever it appears in the headline. */
    accent: "enterprise",
  },
  brand: "Radhev R",
  /** One wording everywhere: the hero, the footer, the share card and structured data. */
  role: "Senior UI/UX & Product Designer",
  /** The live address: canonical URL, sitemap, share cards and structured data are built on it. */
  url: "https://www.radhev.in",
  available: true,
  availabilityLabel: "Open to new roles",
  email: "radhev1999@gmail.com",
  phone: "+91 808 982 1700",
  /** The nav's "Let's talk" opens a WhatsApp chat with this number. */
  whatsapp: "https://wa.me/918089821700",
  /** Hosted on Drive, so the CV can be updated without a deploy. */
  resume: "https://drive.google.com/file/d/1aZVd8yCqh1uFCw_0ubPjlkxiKlwqtgYv/view?usp=sharing",
  location: "Kollam, Kerala",
  statement:
    "Senior UI/UX & Product Designer with 5 years of experience delivering user-centred products across enterprise SaaS, fintech and government, with 18+ client projects for Qatar and the GCC.",
  /**
   * The hero's two actions. The CV is the primary — it is what a recruiter
   * opens first — and the secondary jumps to the work, the evidence behind it.
   */
  heroCtas: {
    secondary: { label: "View Work", target: "work" },
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
    slug: "dilmon-property-dashboard",
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
        "Published on Behance. This page describes the published screens and the decisions visible in them; no user research, testing or launch results are claimed.",
    },
    image: "/projects/dilmon-property-dashboard.webp",
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
        "A concept published on Behance, not the Kuwait Investment Authority's live website. This page describes the published design and the decisions visible in it; no user research, testing or launch results are claimed.",
    },
    image: "/projects/kia-landing-page.webp",
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
        "A self-initiated concept, published on Behance. The case study marks its personas as provisional, to be confirmed in interviews, and its usability review is an expert review of the screens; no launch results are claimed.",
    },
    image: "/projects/kw-university-dashboard-app.webp",
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
        "A self-initiated concept, published on Behance. The personas are role-based, built from the project brief rather than from interviews, and the outcomes the case study lists are stated as intended, not measured. No user research, testing or launch results are claimed.",
    },
    image: "/projects/stride-health-fitness.webp",
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
    slug: "quickgrub-food-delivery",
    story: {
      seoTitle: "QuickGrub Food Delivery App — UX Case Study",
      seoDescription:
        "QuickGrub food delivery UX case study by Radhev R: stakeholder interviews, a survey, personas, user flows, wireframes, usability fixes and a style guide.",
      published: "Dec 2023",
      year: "2023",
      tools: ["Figma", "Photoshop", "Illustrator"],
      overview: [
        "QuickGrub is a food delivery app, and this is the full case study behind it: from the questions asked of restaurants, drivers and customers to the finished screens.",
        "It set out to fix three things: customisation for dietary needs and tastes, a checkout that discloses every fee, and menus and navigation that do not get in the way of finding a restaurant.",
      ],
      screens: [
        { title: "Research", body: "Stakeholder interview questions for restaurant partners, delivery drivers and customers, and a survey of about 40 people on their age, city, which apps they use, how often they order and how they pay." },
        { title: "Goals", body: "The first goals rewritten for each group, the business, restaurants, drivers and customers, from what the interviews raised." },
        { title: "Competitor analysis", body: "Three delivery apps compared on strengths and weaknesses, and on sign-up, mobile optimisation, usability, reviews and technical performance." },
        { title: "Empathy maps and personas", body: "Two personas, a working parent looking for healthy options and a student on a budget, each with an empathy map of what they say, think, do and feel." },
        { title: "Flows and wireframes", body: "Task flows for login, location, exploring the menu and placing an order, joined into one user flow; then paper sketches and greyscale high-fidelity wireframes." },
        { title: "Testing and UI", body: "The questions put to testers, the changes that came out of them, a style guide (Poppins, a red primary, a 4px spacing scale) and the final app screens." },
      ],
      decisions: [
        "The bill lists every charge, item total, delivery fee, tip, platform fee and GST, before payment, answering the hidden-fees complaint the research turned up.",
        "Categories and restaurants sit at the top of home under the search bar, so finding food does not depend on digging through menus.",
        "After testing, the OTP step was shortened and voice search added to the search bar.",
      ],
      scope:
        "Published on Behance. The research, personas and testing described here are as the case study presents them; no launch or business results are claimed.",
    },
    image: "/projects/quickgrub-food-delivery.webp",
    imageAlt: "QuickGrub food delivery UX case study cover: the case study's goals beside a woman holding a phone showing the app's red splash screen",
    href: "https://www.behance.net/gallery/187669415/UX-Case-Study-Food-Delivery-Application",
    number: "05",
    title: "QuickGrub Food Delivery App",
    categories: ["UX Case Study", "Mobile", "Food Delivery"],
    description:
      "A full UX case study for a food delivery app: interviews, a survey, personas and flows through to a tested, fee-transparent checkout and the final screens.",
    role: "UI/UX Designer",
    visual: "tablet",
    palette: { from: "#2A070B", to: "#FA0025", ink: "#FFE0E4" },
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
    number: "06",
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
    number: "07",
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
    company: "Appstation Pvt Ltd",
    location: "Technopark, Trivandrum",
    title: "Senior UI/UX Designer",
    from: "Jan 2025",
    to: "Present",
    points: [
      "Delivered end-to-end product design for 18+ client projects across 6 domains for Qatar and GCC clients.",
      "Key clients: Invest Qatar, Milaha, MOCI, MOT, NPC, QOC, QFZ, Joud BNPL and Applabtracker CRM.",
      "Designed information architecture, user flows, wireframes and interactive prototypes for 400+ screens.",
      "Built scalable UI with design tokens, components, variants and Auto Layout.",
      "Used Figma MCP and Figma AI to speed up design delivery by 30%.",
      "Delivered developer-ready specs and ran design QA on built screens.",
      "Mentored 2 junior designers and led design reviews in Agile/Scrum teams.",
    ],
  },
  {
    company: "Beinex Consulting Pvt Ltd",
    location: "Infopark, Kochi",
    title: "UI/UX Designer",
    from: "Apr 2023",
    to: "Nov 2024",
    points: [
      "Delivered a complete UX/UI redesign of Aurex (aurex.ai), an AI-powered B2B GRC SaaS platform.",
      "Designed data-heavy dashboards and reporting views across 21 modules: 14 for web and tablet, 7 for mobile.",
      "Built and maintained a Figma design system with tokens and variables.",
      "Ran usability testing, heuristic evaluations and Hotjar analysis to drive design iterations.",
      "Shipped responsive, accessible (WCAG) UI in close collaboration with developers.",
    ],
  },
  {
    company: "OrisysIndia Consultancy Services LLP",
    location: "Technopark, Trivandrum",
    title: "UI/UX Designer",
    from: "Oct 2021",
    to: "Apr 2023",
    points: [
      "Designed and delivered 10+ client projects across Education, IT and Government domains, including websites, dashboards and mobile applications.",
      "Took projects from requirements and user flows to interactive Figma prototypes.",
      "Prepared front-end-ready specs for pixel-perfect developer handoff.",
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




