"""
Build a single self-contained HTML file from this portfolio.

    python3 tools/build_standalone.py

Writes radhev-portfolio.html next to package.json: one file with the CSS,
the JavaScript, both fonts and every image embedded. No build step, no
server, no network — open it from a USB stick on a plane and it works.

What it leaves out, and why: the RC garage. That is three.js, React Three
Fiber and a physics engine, several megabytes before the truck models, and
it cannot be inlined honestly. The React site at radhev.in keeps it.

Requires a prior `npm run build` — the font subsets are taken from what
Next produced rather than downloaded.
"""
CSS = r"""
/* ══════════════════════════════════════════════════════════════════════
   00 · FONTS
   Both families are embedded as base64 woff2 (Latin subsets only, 32 kB
   raw) so this file needs no network at all. Host Grotesk is variable,
   300–800; Geist Mono ships one weight.
   ══════════════════════════════════════════════════════════════════════ */
@font-face{font-family:'Host Grotesk';font-style:normal;font-weight:300 800;font-display:swap;
  src:url(data:font/woff2;base64,__FONT_SANS__) format('woff2')}
@font-face{font-family:'Geist Mono';font-style:normal;font-weight:400;font-display:swap;
  src:url(data:font/woff2;base64,__FONT_MONO__) format('woff2')}

/* ══════════════════════════════════════════════════════════════════════
   01 · DESIGN TOKENS
   Every colour, size and duration used anywhere below is declared here.
   Change a value once and the whole page follows.
   ══════════════════════════════════════════════════════════════════════ */
:root{
  /* Colour — pure black and white, one accent. Nothing else. */
  --ink:#000;            /* page background            */
  --bone:#fff;           /* primary text               */
  --mute:#8f8f8f;        /* secondary text             */
  --line:rgb(255 255 255 / .14);
  --accent:#f43c00;
  --surface-2:#0d0d0d;

  /* Type scale — one step per role, fluid between the two bounds. */
  --t-display:clamp(2.5rem,6.4vw,6.5rem);
  --t-headline:clamp(1.875rem,5vw,5rem);
  --t-title:clamp(1.5rem,3.6vw,3.75rem);
  --t-subtitle:clamp(1.25rem,2.35vw,2.5rem);
  --t-lead:clamp(1.0625rem,1.35vw,1.5rem);
  --t-body:.9375rem;
  --t-small:.8125rem;
  --t-caption:.6875rem;

  /* Spacing — everything is a multiple of 8px. */
  --gutter:clamp(1rem,4vw,3.5rem);
  --s-1:8px; --s-2:16px; --s-3:24px; --s-4:32px;
  --s-6:48px; --s-8:64px; --s-12:96px; --s-16:128px;

  --maxw:1600px;
  --ease:cubic-bezier(.16,1,.3,1);
}

/* ══════════════════════════════════════════════════════════════════════
   02 · RESET & BASE
   ══════════════════════════════════════════════════════════════════════ */
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth;-webkit-text-size-adjust:100%}
body{
  background:var(--ink);color:var(--bone);
  font-family:'Host Grotesk',Arial,Helvetica,sans-serif;
  font-size:var(--t-body);line-height:1.6;
  -webkit-font-smoothing:antialiased;overflow-x:clip;
}
img{display:block;max-width:100%;height:auto}
a{color:inherit;text-decoration:none}
button{font:inherit;color:inherit;background:none;border:0;cursor:pointer}
ul,ol{list-style:none}
h1,h2,h3{font-weight:500;letter-spacing:-.035em;line-height:.95}
::selection{background:var(--accent);color:var(--bone)}

/* Focus ring — visible for keyboards, absent for mouse clicks. */
:focus-visible{outline:2px solid var(--accent);outline-offset:4px}

/* Skip link, first in the tab order. */
.skip{position:fixed;left:16px;top:16px;z-index:200;transform:translateY(-200%);
  background:var(--bone);color:var(--ink);padding:8px 16px;font-size:var(--t-small)}
.skip:focus{transform:translateY(0)}

/* ══════════════════════════════════════════════════════════════════════
   03 · LAYOUT UTILITIES
   ══════════════════════════════════════════════════════════════════════ */
.wrap{max-width:var(--maxw);margin-inline:auto;padding-inline:var(--gutter)}
.section{padding-block:var(--s-12)}
@media(min-width:768px){.section{padding-block:var(--s-16)}}

/* Sections alternate black and white down the page.
   The background and colour are literal, not var(--bone)/var(--ink): custom
   properties redefined in the same rule resolve to their NEW values, so
   `background:var(--bone)` here would read #000 and the section would come
   out black — which is exactly what it did. The tokens below are for the
   descendants. */
.invert{background:#fff;color:#000;
  --bone:#000;--ink:#fff;--mute:#5a5a5a;--line:rgb(0 0 0 / .14)}

.grid{display:grid;grid-template-columns:repeat(12,1fr);gap:var(--s-4) var(--s-4)}
@media(max-width:767px){.grid{grid-template-columns:1fr}}

/* ══════════════════════════════════════════════════════════════════════
   04 · TYPOGRAPHY HELPERS
   ══════════════════════════════════════════════════════════════════════ */
.label{font-size:var(--t-caption);font-weight:500;letter-spacing:.16em;
  text-transform:uppercase;color:var(--mute)}
.mono{font-family:'Geist Mono',ui-monospace,Menlo,monospace}
.lead{font-size:var(--t-lead);line-height:1.45;letter-spacing:-.01em}
.muted{color:var(--mute)}
.display{font-size:var(--t-display);letter-spacing:-.045em;line-height:.9}
.headline{font-size:var(--t-headline);letter-spacing:-.045em;line-height:.92}
.title{font-size:var(--t-title);letter-spacing:-.04em;line-height:.98}
.subtitle{font-size:var(--t-subtitle);letter-spacing:-.03em;line-height:1.1}
.light{font-weight:300;letter-spacing:-.03em;opacity:.72}

/* Section header: number, label, rule. Used at the top of every section. */
.sechead{display:flex;align-items:baseline;gap:var(--s-2);
  padding-bottom:var(--s-3);border-bottom:1px solid var(--line)}
.sechead .n{font-variant-numeric:tabular-nums}

/* ══════════════════════════════════════════════════════════════════════
   05 · COMPONENTS — buttons
   ══════════════════════════════════════════════════════════════════════ */
.btn{display:inline-flex;align-items:center;gap:var(--s-2);
  padding:14px 22px;font-size:var(--t-small);letter-spacing:.06em;
  text-transform:uppercase;border:1px solid var(--line);
  transition:background .3s var(--ease),border-color .3s var(--ease),color .3s var(--ease)}
.btn .arrow{transition:transform .5s var(--ease)}
.btn:hover .arrow{transform:translateX(5px)}
.btn--solid{background:var(--accent);border-color:var(--accent);color:#fff}
.btn--solid:hover{filter:brightness(1.12)}
.btn--ghost:hover{background:rgb(255 255 255 / .06);border-color:rgb(255 255 255 / .4)}
.invert .btn--ghost:hover{background:rgb(0 0 0 / .05);border-color:rgb(0 0 0 / .35)}

/* ══════════════════════════════════════════════════════════════════════
   06 · SECTION — NAVIGATION (sticky, blurs once scrolled)
   ══════════════════════════════════════════════════════════════════════ */
.nav{position:fixed;inset-inline:0;top:0;z-index:50;
  transition:background .4s var(--ease),backdrop-filter .4s var(--ease),transform .5s var(--ease)}
.nav.is-scrolled{background:rgb(0 0 0 / .72);backdrop-filter:blur(18px)}
.nav.is-hidden{transform:translateY(-100%)}
.nav__inner{display:flex;align-items:center;justify-content:space-between;height:80px}
.nav__mark{display:flex;align-items:center;gap:10px;font-size:var(--t-small);
  font-weight:500;letter-spacing:.18em;text-transform:uppercase}
.nav__dot{width:14px;height:14px;background:var(--accent)}
.nav__links{display:none;align-items:center;gap:40px}
.nav__links a{font-size:var(--t-small);letter-spacing:-.01em;color:var(--mute);
  transition:color .3s var(--ease)}
.nav__links a:hover,.nav__links a[aria-current="true"]{color:var(--bone)}
.nav__burger{display:grid;place-items:center;width:24px;height:24px;position:relative}
.nav__burger span{position:absolute;width:18px;height:1px;background:var(--bone);
  transition:transform .45s var(--ease)}
.nav__burger span:nth-child(1){transform:translateY(-3px)}
.nav__burger span:nth-child(2){transform:translateY(3px)}
.nav.is-open .nav__burger span:nth-child(1){transform:rotate(45deg)}
.nav.is-open .nav__burger span:nth-child(2){transform:rotate(-45deg)}
@media(min-width:768px){
  .nav__links{display:flex}
  .nav__burger{display:none}
}

/* Full-screen menu for small screens. */
.menu{position:fixed;inset:0;z-index:45;background:var(--ink);
  display:flex;flex-direction:column;justify-content:center;gap:var(--s-3);
  padding:var(--s-16) var(--gutter);
  clip-path:inset(0 0 100% 0);transition:clip-path .6s var(--ease);pointer-events:none}
.menu.is-open{clip-path:inset(0 0 0 0);pointer-events:auto}
.menu a{font-size:var(--t-title);letter-spacing:-.04em}

/* ══════════════════════════════════════════════════════════════════════
   07 · SECTION — HERO
   ══════════════════════════════════════════════════════════════════════ */
.hero{min-height:100svh;display:flex;flex-direction:column;justify-content:center;
  padding-block:120px var(--s-8);position:relative;overflow:hidden}
.hero__grid{display:grid;grid-template-columns:1fr;gap:var(--s-6);align-items:center}
@media(min-width:768px){.hero__grid{grid-template-columns:repeat(12,1fr);gap:var(--s-4)}}
.hero__copy{order:2}
.hero__figure{order:1;display:flex;justify-content:center}
@media(min-width:768px){
  .hero__copy{order:1;grid-column:1/span 7}
  .hero__figure{order:2;grid-column:8/span 5;justify-content:flex-end}
}

/* Availability pip — the dot pulses, the label does not move. */
.avail{display:inline-flex;align-items:center;gap:10px;margin-bottom:var(--s-2)}
.avail__pip{position:relative;display:grid;place-items:center;width:8px;height:8px}
.avail__pip i{position:absolute;width:8px;height:8px;border-radius:999px;
  background:rgb(244 60 0 / .55);animation:ping 2.4s var(--ease) infinite}
.avail__pip b{width:6px;height:6px;border-radius:999px;background:var(--accent)}
@keyframes ping{0%{transform:scale(.6);opacity:.9}70%,100%{transform:scale(2.4);opacity:0}}

.disciplines{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-bottom:var(--s-3)}
.disciplines i{width:4px;height:4px;background:var(--accent)}

/* The statement. Three lines, the last in the lighter voice. */
.hero__h1{font-size:var(--t-headline);line-height:.98;margin-bottom:var(--s-3)}
.hero__h1 span{display:block;overflow:hidden}
.hero__h1 span>i{display:block;font-style:normal;
  transform:translateY(105%);transition:transform 1.1s var(--ease)}
.hero__h1 span:nth-child(2)>i{transition-delay:.1s}
.hero__h1 span:nth-child(3)>i{transition-delay:.2s}
.is-ready .hero__h1 span>i{transform:translateY(0)}

.hero__statement{max-width:52ch;font-size:var(--t-caption);letter-spacing:.1em;
  line-height:1.75;text-transform:uppercase;color:var(--mute);margin-bottom:var(--s-3)}
.hero__actions{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:var(--s-3)}
.hero__links{display:flex;flex-wrap:wrap;gap:var(--s-3)}
.hero__links a{display:inline-flex;align-items:center;gap:6px}
.hero__links a:hover{color:var(--bone)}

/* Portrait. Background was levelled to true black at export, so it has no
   edge against the page; the mask handles the cropped shoulders. */
.portrait{position:relative;width:min(70vw,260px);aspect-ratio:1;
  -webkit-mask-image:linear-gradient(to bottom,#000 66%,transparent 98%);
  mask-image:linear-gradient(to bottom,#000 66%,transparent 98%);
  transition:transform .9s var(--ease)}
@media(min-width:768px){.portrait{width:min(34vw,420px)}}
.portrait::after{content:'';position:absolute;inset:-14%;z-index:-1;
  background:radial-gradient(circle at 50% 44%,rgb(244 60 0 / .17),transparent 62%);
  animation:breathe 9s ease-in-out infinite}
@keyframes breathe{0%,100%{opacity:.5;transform:scale(.95)}50%{opacity:1;transform:scale(1.05)}}

/* ══════════════════════════════════════════════════════════════════════
   08 · SECTION — SELECTED WORK
   ══════════════════════════════════════════════════════════════════════ */
.work__head{display:grid;gap:var(--s-4);margin-top:var(--s-6)}
@media(min-width:768px){.work__head{grid-template-columns:repeat(12,1fr);align-items:end}
  .work__head h2{grid-column:1/span 7}.work__head p{grid-column:9/span 4}}

.projects{display:grid;gap:var(--s-8);margin-top:var(--s-8)}
@media(min-width:768px){.projects{gap:var(--s-16);margin-top:var(--s-12)}}

.project{display:grid;gap:var(--s-3)}
@media(min-width:768px){
  .project{grid-template-columns:repeat(12,1fr);gap:var(--s-4);align-items:center}
  .project__media{grid-column:1/span 7}
  .project__body{grid-column:9/span 4}
  /* Alternate the side the image sits on. */
  .project:nth-child(even) .project__media{grid-column:6/span 7;order:2}
  .project:nth-child(even) .project__body{grid-column:1/span 4;order:1}
}
.project__media{overflow:hidden;background:var(--surface-2);aspect-ratio:808/632}
.project__media img{width:100%;height:100%;object-fit:cover;
  transition:transform .9s var(--ease),filter .9s var(--ease);filter:grayscale(.3)}
.project:hover .project__media img{transform:scale(1.035);filter:grayscale(0)}
.project__cats{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:var(--s-2)}
.project__cats li{font-size:var(--t-caption);letter-spacing:.14em;
  text-transform:uppercase;color:var(--mute);border:1px solid var(--line);padding:4px 10px}
.project__title{font-size:var(--t-subtitle);letter-spacing:-.03em;margin-bottom:10px}
.project__link{display:inline-flex;align-items:center;gap:8px;margin-top:var(--s-2);
  font-size:var(--t-small);letter-spacing:.06em;text-transform:uppercase}
.project__link .arrow{transition:transform .5s var(--ease)}
.project:hover .project__link .arrow{transform:translateX(5px)}

/* ══════════════════════════════════════════════════════════════════════
   09 · SECTION — DESIGN SYSTEMS (tokens → components → patterns → products)
   ══════════════════════════════════════════════════════════════════════ */
.ds__tabs{display:flex;flex-wrap:wrap;gap:8px;margin-top:var(--s-6)}
.ds__tab{padding:10px 18px;border:1px solid var(--line);font-size:var(--t-small);
  letter-spacing:.1em;text-transform:uppercase;color:var(--mute);
  transition:all .3s var(--ease)}
.ds__tab[aria-selected="true"]{color:var(--bone);border-color:var(--bone)}
.ds__panel{margin-top:var(--s-6);min-height:240px}
.ds__panel[hidden]{display:none}
.ds__demo{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));
  gap:var(--s-2)}
.swatch{aspect-ratio:3/2;display:flex;align-items:flex-end;padding:10px;
  font-size:var(--t-caption);letter-spacing:.1em;text-transform:uppercase}
.chipbox{border:1px solid var(--line);padding:var(--s-3);display:grid;gap:12px;
  align-content:start}
.chipbox h4{font-size:var(--t-caption);letter-spacing:.16em;text-transform:uppercase;
  color:var(--mute);font-weight:500}
.minibtn{border:1px solid var(--line);padding:8px 14px;font-size:var(--t-small);
  text-align:center}
.minibtn--solid{background:var(--accent);border-color:var(--accent);color:#fff}
.minifield{border:1px solid var(--line);padding:10px 12px;font-size:var(--t-small);
  color:var(--mute)}
.minirow{display:flex;justify-content:space-between;border-bottom:1px solid var(--line);
  padding:8px 0;font-size:var(--t-small)}

/* ══════════════════════════════════════════════════════════════════════
   10 · SECTION — WHAT I SPECIALISE IN
   ══════════════════════════════════════════════════════════════════════ */
.spec{border-top:1px solid var(--line);display:grid;gap:10px;padding-block:28px}
@media(min-width:768px){
  .spec{grid-template-columns:repeat(12,1fr);gap:var(--s-4);
    align-items:baseline;padding-block:36px}
  .spec__n{grid-column:1/span 1}
  .spec__t{grid-column:2/span 4}
  .spec__d{grid-column:6/span 6}
}
.spec__d{max-width:52ch;color:var(--mute)}

/* ══════════════════════════════════════════════════════════════════════
   11 · SECTION — DESIGNING FOR COMPLEXITY
   ══════════════════════════════════════════════════════════════════════ */
.impact{display:grid;gap:var(--s-6);margin-top:var(--s-8)}
@media(min-width:640px){.impact{grid-template-columns:repeat(2,1fr)}}
@media(min-width:1024px){.impact{grid-template-columns:repeat(4,1fr)}}
.impact dt{font-size:var(--t-title);letter-spacing:-.04em;line-height:.95}
.impact dd{margin-top:14px;max-width:26ch;font-size:var(--t-small);color:var(--mute)}

/* ══════════════════════════════════════════════════════════════════════
   12 · SECTION — ABOUT
   ══════════════════════════════════════════════════════════════════════ */
.about{display:grid;gap:var(--s-4);margin-top:var(--s-6)}
@media(min-width:768px){.about{grid-template-columns:repeat(12,1fr)}
  .about__h{grid-column:1/span 7}.about__body{grid-column:8/span 5}}
.sectors{display:flex;flex-wrap:wrap;gap:8px;margin-top:var(--s-4)}
.sectors li{display:flex;align-items:center;gap:8px}
.sectors i{width:4px;height:4px;background:var(--accent)}

/* ══════════════════════════════════════════════════════════════════════
   13 · SECTION — PROCESS
   ══════════════════════════════════════════════════════════════════════ */
.process{display:grid;gap:1px;margin-top:var(--s-6);background:var(--line)}
@media(min-width:640px){.process{grid-template-columns:repeat(2,1fr)}}
@media(min-width:1024px){.process{grid-template-columns:repeat(3,1fr)}}
.process li{background:#000;padding:var(--s-4)}
.invert .process li{background:#fff}
.process h3{font-size:var(--t-subtitle);margin:14px 0 10px}

/* ══════════════════════════════════════════════════════════════════════
   14 · SECTION — EXPERIENCE (vertical timeline)
   ══════════════════════════════════════════════════════════════════════ */
.roles{margin-top:var(--s-6)}
.role{border-top:1px solid var(--line);padding-block:var(--s-4);display:grid;gap:var(--s-2)}
@media(min-width:768px){
  .role{grid-template-columns:repeat(12,1fr);gap:var(--s-4)}
  .role__when{grid-column:1/span 3}
  .role__who{grid-column:4/span 3}
  .role__what{grid-column:7/span 6}
}
.role__who h3{font-size:var(--t-subtitle)}
.role__what li{position:relative;padding-left:18px;margin-bottom:10px;
  font-size:var(--t-small);color:var(--mute)}
.role__what li::before{content:'';position:absolute;left:0;top:9px;
  width:5px;height:5px;background:var(--accent)}

/* ══════════════════════════════════════════════════════════════════════
   15 · SECTION — CONTACT & FOOTER
   ══════════════════════════════════════════════════════════════════════ */
.contact{min-height:90svh;display:flex;flex-direction:column;justify-content:center}
.contact__mail{display:inline-block;margin-top:var(--s-2);font-size:var(--t-title);
  letter-spacing:-.04em;color:var(--accent);word-break:break-all;
  transition:opacity .4s var(--ease)}
.contact__mail:hover{opacity:.7}
.foot{border-top:1px solid var(--line);padding-block:var(--s-4);
  display:flex;flex-wrap:wrap;gap:var(--s-3);justify-content:space-between}

/* ══════════════════════════════════════════════════════════════════════
   16 · SCROLL REVEAL
   Elements start shifted and transparent; the observer in the script adds
   .in when they enter the viewport. One transition, reused everywhere.
   ══════════════════════════════════════════════════════════════════════ */
.reveal{opacity:0;transform:translateY(24px);
  transition:opacity .9s var(--ease),transform .9s var(--ease)}
.reveal.in{opacity:1;transform:none}

/* ══════════════════════════════════════════════════════════════════════
   17 · REDUCED MOTION
   Everything above is decoration. If the visitor has asked for less, it
   all stops — nothing here is load-bearing.
   ══════════════════════════════════════════════════════════════════════ */
@media(prefers-reduced-motion:reduce){
  *,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;
    transition-duration:.01ms!important;scroll-behavior:auto!important}
  .reveal{opacity:1;transform:none}
  .hero__h1 span>i{transform:none}
}
"""
JS = r"""
/* ══════════════════════════════════════════════════════════════════════
   01 · SCROLL REVEAL
   One IntersectionObserver for every .reveal on the page. Elements are
   unobserved once shown, so scrolling back up does not re-trigger them
   and the observer empties itself as you go.
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  var items = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) {
    items.forEach(function (el) { el.classList.add('in'); });
    return;
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      // Stagger siblings slightly so a row arrives as a row, not at once.
      var delay = Number(e.target.dataset.delay || 0);
      setTimeout(function () { e.target.classList.add('in'); }, delay);
      io.unobserve(e.target);
    });
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.1 });
  items.forEach(function (el) { io.observe(el); });
})();

/* ══════════════════════════════════════════════════════════════════════
   02 · HERO ENTRANCE
   The masked lines slide up once, on load. Adding the class on the next
   frame guarantees the browser has painted the start state first.
   ══════════════════════════════════════════════════════════════════════ */
requestAnimationFrame(function () {
  requestAnimationFrame(function () { document.body.classList.add('is-ready'); });
});

/* ══════════════════════════════════════════════════════════════════════
   03 · STICKY NAVIGATION
   Solid once you have scrolled, hidden while scrolling down, back on the
   way up. rAF-throttled: scroll fires far more often than the screen
   refreshes and there is no point recomputing in between.
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  var nav = document.getElementById('nav');
  var last = 0, ticking = false;
  function update() {
    var y = window.scrollY;
    nav.classList.toggle('is-scrolled', y > 24);
    nav.classList.toggle('is-hidden', y > last && y > 240 && !nav.classList.contains('is-open'));
    last = y;
    ticking = false;
  }
  window.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  }, { passive: true });
  update();
})();

/* ══════════════════════════════════════════════════════════════════════
   04 · MOBILE MENU
   Escape closes it, a link closes it, and the page behind it is locked
   so you do not scroll the document while the menu is over it.
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  var nav = document.getElementById('nav');
  var menu = document.getElementById('menu');
  var btn = document.getElementById('burger');
  function set(open) {
    nav.classList.toggle('is-open', open);
    menu.classList.toggle('is-open', open);
    btn.setAttribute('aria-expanded', String(open));
    document.body.style.overflow = open ? 'hidden' : '';
  }
  btn.addEventListener('click', function () { set(!menu.classList.contains('is-open')); });
  menu.addEventListener('click', function (e) { if (e.target.closest('a')) set(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') set(false); });
})();

/* ══════════════════════════════════════════════════════════════════════
   05 · ACTIVE SECTION
   Marks the nav link for whichever section owns the middle of the
   screen, so the nav reflects where you actually are.
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  var links = Array.prototype.slice.call(document.querySelectorAll('[data-nav]'));
  var sections = links
    .map(function (a) { return document.getElementById(a.dataset.nav); })
    .filter(Boolean);
  if (!sections.length || !('IntersectionObserver' in window)) return;
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      links.forEach(function (a) {
        a.setAttribute('aria-current', a.dataset.nav === e.target.id ? 'true' : 'false');
      });
    });
  }, { rootMargin: '-45% 0px -45% 0px' });
  sections.forEach(function (s) { io.observe(s); });
})();

/* ══════════════════════════════════════════════════════════════════════
   06 · HERO PORTRAIT — cursor lean
   A few pixels of travel and a couple of degrees of tilt, eased toward
   the pointer each frame. Skipped on touch, where there is no hover, and
   skipped entirely when reduced motion is requested.
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  var el = document.getElementById('portrait');
  if (!el) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (window.matchMedia('(pointer: coarse)').matches) return;
  var tx = 0, ty = 0, cx = 0, cy = 0, running = false;
  window.addEventListener('pointermove', function (e) {
    tx = (e.clientX / window.innerWidth - 0.5) * 2;
    ty = (e.clientY / window.innerHeight - 0.5) * 2;
    if (!running) { running = true; requestAnimationFrame(loop); }
  }, { passive: true });
  function loop() {
    cx += (tx - cx) * 0.06;
    cy += (ty - cy) * 0.06;
    el.style.transform =
      'translate3d(' + (cx * 18).toFixed(2) + 'px,' + (cy * 12).toFixed(2) + 'px,0)' +
      ' rotateY(' + (cx * 5).toFixed(2) + 'deg) rotateX(' + (-cy * 4).toFixed(2) + 'deg)';
    if (Math.abs(tx - cx) > 0.001 || Math.abs(ty - cy) > 0.001) requestAnimationFrame(loop);
    else running = false;
  }
})();

/* ══════════════════════════════════════════════════════════════════════
   07 · DESIGN SYSTEM TABS
   Tokens → components → patterns → products. Arrow keys move between
   tabs, as the tab pattern expects.
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.ds__tab'));
  if (!tabs.length) return;
  function select(i) {
    tabs.forEach(function (t, k) {
      var on = k === i;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    });
  }
  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { select(i); });
    t.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault();
      var next = (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      tabs[next].focus();
      select(next);
    });
  });
  select(0);
})();

/* ══════════════════════════════════════════════════════════════════════
   08 · FOOTER YEAR
   So the copyright does not quietly go stale.
   ══════════════════════════════════════════════════════════════════════ */
document.getElementById('year').textContent = String(new Date().getFullYear());
"""

# ── Content ───────────────────────────────────────────────────────────
# Transcribed from lib/content.ts. This file is a snapshot: the React site
# stays the source of truth, and nothing here is generated from it, so if
# the two drift the React one is right.

PROJECTS = [
    ("01", "Technology Landing Page", ["Web Design", "Responsive", "Marketing Site"],
     "A responsive landing page for a technology product, designed across desktop and mobile breakpoints.",
     "technology-landing-page",
     "https://www.behance.net/gallery/205427461/Technology-landing-page-Desktop-Mobile-responsive",
     "Technology landing page shown on desktop and mobile"),
    ("02", "University Admin Dashboard", ["UI/UX Design", "Dashboard", "Education"],
     "An administrative dashboard concept for a university, organising dense records and daily tasks into a readable interface.",
     "university-admin-dashboard",
     "https://www.behance.net/gallery/205423733/UIUX-Design-University-Admin-Dashboard-Concept",
     "University admin dashboard concept screens"),
    ("03", "Grogauge KPI Dashboard", ["Data Visualization", "SaaS", "Dashboard"],
     "A key-performance-indicator dashboard, turning dense measurement data into something that can be read at a glance.",
     "grogauge-kpi-dashboard",
     "https://www.behance.net/gallery/166160121/Grogauge-key-performance-indicators-Dashboard",
     "Grogauge KPI dashboard interface"),
    ("04", "Food Delivery Application", ["UX Case Study", "Mobile", "Interaction"],
     "A UX case study for a food delivery application, worked end to end from the problem through to the interface.",
     "food-delivery-case-study",
     "https://www.behance.net/gallery/187669415/UX-Case-Study-Food-Delivery-Application",
     "Food delivery application UX case study screens"),
    ("05", "Dashboard Concept", ["UI Design", "Dashboard", "Concept"],
     "A dashboard concept exploring hierarchy, density and the rhythm of a data-heavy screen.",
     "dashboard-concept",
     "https://www.behance.net/gallery/164544999/Dashboard-Concept",
     "Dashboard concept interface"),
    ("06", "Thuna Mobile UI", ["UI/UX Design", "Mobile", "Product"],
     "Mobile interface design for Thuna, covering the core screens and the system behind them.",
     "thuna-mobile-ui",
     "https://www.behance.net/gallery/128315087/UI-UX-Design-Thuna-Mobile-UI",
     "Thuna mobile app interface screens"),
]

SPECIALISMS = [
    ("Product design", "Complex workflows, SaaS products, dashboards and enterprise platforms."),
    ("Design systems", "Tokens, components, variants, patterns and scalable UI libraries."),
    ("UX strategy", "Research, information architecture, user flows and usability."),
    ("Visual design", "Typography, hierarchy, responsive UI and interaction design."),
    ("Design → development", "Developer handoff, HTML/CSS understanding and collaboration with engineering teams."),
]

IMPACT = [
    ("4+", "Years designing products"),
    ("Enterprise", "GRC, governance and workflow platforms"),
    ("Multiple", "Industries — government, fintech, HRTech, education"),
    ("Systems", "Scalable foundations, not one-off screens"),
]

PROCESS = [
    ("01", "Discover", "Understand users, business objectives, constraints, and context."),
    ("02", "Define", "Identify problems, opportunities, and product priorities."),
    ("03", "Structure", "Build information architecture, user flows, and wireframes."),
    ("04", "Design", "Create visual systems, components, and high-fidelity interfaces."),
    ("05", "Prototype", "Build realistic interactions and validate the experience."),
    ("06", "Refine", "Iterate based on feedback, testing, and product requirements."),
]

ROLES = [
    ("Jan 2025 — Present", "Appstation", "Technopark, Trivandrum", "UI/UX Designer", [
        "Translate complex client requirements into intuitive UX solutions for GCC-region clients across Government, Fintech, SaaS, HRTech, Media and Events.",
        "Create wireframes, user flows and high-fidelity mockups in Figma using Auto Layout, components and variants for scalable design systems.",
        "Use AI-assisted design workflows, including Figma MCP, to shorten delivery and iteration cycles.",
        "Deliver front-end-ready specifications in HTML and CSS so developers can implement pixel-perfect.",
        "Manage stakeholder expectations across cross-functional teams in fast-paced project environments.",
    ]),
    ("Apr 2023 — Nov 2024", "Beinex Consulting", "Infopark, Kochi", "UI/UX Designer", [
        "Designed a leading enterprise Governance, Risk and Compliance SaaS product across web, mobile and tablet.",
        "Built and maintained a scalable Figma design system, keeping every product touchpoint consistent and faster to ship.",
        "Worked closely with development teams on pixel-perfect, responsive and accessible implementation.",
        "Ran usability testing sessions and refined concepts through continuous feedback.",
    ]),
    ("2021 — 2023", "OrisysIndia Consultancy Services", "Technopark, Trivandrum", "UI/UX Designer", [
        "Designed web and mobile products across education and digital services.",
        "Produced wireframes, prototypes and production-ready interfaces.",
        "Partnered with project managers, BA teams and clients to align designs with user needs and business goals.",
    ]),
]

SECTORS = ["Enterprise SaaS", "Government", "Fintech", "HRTech", "Education", "Dashboards", "Design Systems"]
NAV = [("work", "Work"), ("about", "About"), ("experience", "Experience"), ("contact", "Contact")]


def esc(t):
    return (t.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))


def build_projects(images):
    out = []
    for n, title, cats, desc, slug, href, alt in PROJECTS:
        chips = "".join(f"<li>{esc(c)}</li>" for c in cats)
        out.append(f"""
      <!-- Project {n} — {esc(title)} -->
      <article class="project reveal">
        <div class="project__media">
          <img src="data:image/webp;base64,{images[slug]}" alt="{esc(alt)}" loading="lazy" width="808" height="632">
        </div>
        <div class="project__body">
          <p class="label">{n}</p>
          <ul class="project__cats">{chips}</ul>
          <h3 class="project__title">{esc(title)}</h3>
          <p class="muted">{esc(desc)}</p>
          <a class="project__link" href="{href}" target="_blank" rel="noreferrer">
            View project <span class="arrow" aria-hidden="true">&rarr;</span>
          </a>
        </div>
      </article>""")
    return "".join(out)


def build_specialisms():
    rows = []
    for i, (title, blurb) in enumerate(SPECIALISMS, 1):
        rows.append(f"""
        <li class="spec reveal">
          <p class="label spec__n">{i:02d}</p>
          <h3 class="subtitle spec__t">{esc(title)}</h3>
          <p class="spec__d">{esc(blurb)}</p>
        </li>""")
    return "".join(rows)


def build_impact():
    return "".join(
        f"""
        <div class="reveal" data-delay="{i*70}">
          <dt>{esc(f)}</dt><dd>{esc(l)}</dd>
        </div>"""
        for i, (f, l) in enumerate(IMPACT)
    )


def build_process():
    return "".join(
        f"""
        <li class="reveal" data-delay="{i*60}">
          <p class="label">{n}</p><h3>{esc(t)}</h3><p class="muted">{esc(b)}</p>
        </li>"""
        for i, (n, t, b) in enumerate(PROCESS)
    )


def build_roles():
    out = []
    for when, co, loc, title, points in ROLES:
        bullets = "".join(f"<li>{esc(p)}</li>" for p in points)
        out.append(f"""
        <li class="role reveal">
          <div class="role__when"><p class="label">{esc(when)}</p><p class="label">{esc(loc)}</p></div>
          <div class="role__who"><h3>{esc(co)}</h3><p class="muted">{esc(title)}</p></div>
          <ul class="role__what">{bullets}</ul>
        </li>""")
    return "".join(out)


HTML = r"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Radhev R — Product / UI/UX Designer</title>
<meta name="description" content="Product / UI/UX Designer specializing in enterprise SaaS, government platforms, dashboards, fintech products and scalable design systems.">
<meta name="author" content="Radhev R">
<meta name="theme-color" content="#000000">
<link rel="canonical" href="https://radhev.in/">

<!-- Open Graph / social preview -->
<meta property="og:type" content="website">
<meta property="og:title" content="Radhev R — Product / UI/UX Designer">
<meta property="og:description" content="I design complex digital products into clear experiences.">
<meta property="og:url" content="https://radhev.in/">
<meta name="twitter:card" content="summary_large_image">

<!-- Favicon, inlined so the file carries its own icon -->
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' fill='%23000'/%3E%3Cpath d='M9 7h8a6 6 0 0 1 0 12h-3v6H9z' fill='%23fff'/%3E%3Crect x='9' y='22' width='5' height='3' fill='%23f43c00'/%3E%3C/svg%3E">

<style>
__CSS__
</style>
</head>

<body>
<a class="skip" href="#main">Skip to content</a>

<!-- ══════════════════════════════════════════════════════════════════
     SECTION 01 · NAVIGATION
     Fixed. Goes solid once scrolled, hides on the way down and returns
     on the way up. Collapses to a full-screen menu under 768px.
     ══════════════════════════════════════════════════════════════════ -->
<header class="nav" id="nav">
  <div class="wrap nav__inner">
    <a class="nav__mark" href="#top" aria-label="Radhev R — top of page">
      <span class="nav__dot" aria-hidden="true"></span> Radhev
    </a>
    <div style="display:flex;align-items:center;gap:32px">
      <nav class="nav__links" aria-label="Primary">
        __NAVLINKS__
      </nav>
      <a class="btn btn--ghost" href="#contact" style="display:none" id="talk">
        Let&rsquo;s talk <span class="arrow" aria-hidden="true">&rarr;</span>
      </a>
      <button class="nav__burger" id="burger" aria-expanded="false" aria-controls="menu" aria-label="Open menu">
        <span></span><span></span>
      </button>
    </div>
  </div>
</header>

<nav class="menu" id="menu" aria-label="Mobile">
  __MENULINKS__
</nav>

<main id="main">
<div id="top"></div>

<!-- ══════════════════════════════════════════════════════════════════
     SECTION 02 · HERO
     Positioning statement, not a job title. Three masked lines that
     slide up once on load, the last in the lighter weight.
     ══════════════════════════════════════════════════════════════════ -->
<section class="hero wrap" id="home" aria-label="Introduction">
  <div class="hero__grid">

    <div class="hero__copy">
      <p class="avail label">
        <span class="avail__pip" aria-hidden="true"><i></i><b></b></span>
        Available for selected projects
      </p>

      <ul class="disciplines label" aria-label="Focus areas">
        <li>Enterprise SaaS</li><i aria-hidden="true"></i>
        <li>Government</li><i aria-hidden="true"></i>
        <li>Fintech</li><i aria-hidden="true"></i>
        <li>Dashboards</li><i aria-hidden="true"></i>
        <li>Design Systems</li>
      </ul>

      <h1 class="hero__h1">
        <span><i>I design complex</i></span>
        <span><i>digital products into</i></span>
        <span><i class="light">clear experiences.</i></span>
      </h1>

      <p class="hero__statement mono">
        Product / UI/UX Designer specializing in enterprise SaaS, government platforms,
        dashboards, fintech products and scalable design systems.
      </p>

      <div class="hero__actions">
        <a class="btn btn--solid" href="#work">
          View selected work <span class="arrow" aria-hidden="true">&rarr;</span>
        </a>
        <a class="btn btn--ghost" href="#about">About me</a>
      </div>

      <ul class="hero__links label">
        <li><a href="https://www.linkedin.com/in/radhev-r-74481021a" target="_blank" rel="noreferrer">LinkedIn <span aria-hidden="true">&#8599;</span></a></li>
        <li><a href="https://www.behance.net/radhev1999707d" target="_blank" rel="noreferrer">Behance <span aria-hidden="true">&#8599;</span></a></li>
        <li><a href="__RESUME__" target="_blank" rel="noreferrer">R&eacute;sum&eacute; <span aria-hidden="true">&#8599;</span></a></li>
      </ul>
    </div>

    <!-- The photograph's background was levelled to true black when it was
         exported, so it has no edge against the page. The CSS mask fades
         the cropped shoulders out at the bottom. -->
    <figure class="hero__figure">
      <img class="portrait" id="portrait" src="data:image/webp;base64,__PORTRAIT__"
           alt="Radhev R" width="1000" height="1000" fetchpriority="high">
    </figure>

  </div>
</section>

<!-- ══════════════════════════════════════════════════════════════════
     SECTION 03 · SELECTED WORK
     Second on the page, directly under the statement. The work is the
     reason anyone is here; self-description can wait.
     ══════════════════════════════════════════════════════════════════ -->
<section class="section wrap invert" id="work" aria-label="Selected work">
  <div class="sechead"><span class="label n">(01)</span><span class="label">Selected work</span></div>

  <div class="work__head">
    <h2 class="display reveal">Selected<br><span class="light">work</span></h2>
    <p class="muted reveal" data-delay="120">
      A selection of complex digital products, enterprise platforms and interfaces I&rsquo;ve designed.
    </p>
  </div>

  <div class="projects">__PROJECTS__
  </div>
</section>

<!-- ══════════════════════════════════════════════════════════════════
     SECTION 04 · DESIGN SYSTEMS
     Tokens → components → patterns → products, as four tabs. The point
     is to show the progression, not to list the parts.
     ══════════════════════════════════════════════════════════════════ -->
<section class="section wrap" id="systems" aria-label="Design systems">
  <div class="sechead"><span class="label n">(02)</span><span class="label">Design systems</span></div>

  <h2 class="headline reveal" style="margin-top:48px;max-width:14ch">From tokens to products.</h2>

  <div class="ds__tabs" role="tablist" aria-label="Design system layers">
    <button class="ds__tab" role="tab" id="tab-1" aria-controls="panel-1" aria-selected="true">Tokens</button>
    <button class="ds__tab" role="tab" id="tab-2" aria-controls="panel-2" aria-selected="false">Components</button>
    <button class="ds__tab" role="tab" id="tab-3" aria-controls="panel-3" aria-selected="false">Patterns</button>
    <button class="ds__tab" role="tab" id="tab-4" aria-controls="panel-4" aria-selected="false">Products</button>
  </div>

  <div class="ds__panel" id="panel-1" role="tabpanel" aria-labelledby="tab-1">
    <div class="ds__demo">
      <div class="swatch" style="background:#000;border:1px solid var(--line)">Ink</div>
      <div class="swatch" style="background:#fff;color:#000">Bone</div>
      <div class="swatch" style="background:#f43c00">Accent</div>
      <div class="chipbox"><h4>Type scale</h4>
        <p style="font-size:28px;letter-spacing:-.04em;line-height:1">Display</p>
        <p style="font-size:15px">Body</p>
        <p class="label">Caption</p>
      </div>
      <div class="chipbox"><h4>Spacing</h4>
        <div style="display:flex;gap:4px;align-items:flex-end">
          <span style="width:8px;height:8px;background:var(--accent)"></span>
          <span style="width:16px;height:16px;background:var(--accent)"></span>
          <span style="width:24px;height:24px;background:var(--accent)"></span>
          <span style="width:32px;height:32px;background:var(--accent)"></span>
        </div>
        <p class="label">8 · 16 · 24 · 32</p>
      </div>
    </div>
  </div>

  <div class="ds__panel" id="panel-2" role="tabpanel" aria-labelledby="tab-2" hidden>
    <div class="ds__demo">
      <div class="chipbox"><h4>Buttons</h4>
        <span class="minibtn minibtn--solid">Primary</span>
        <span class="minibtn">Secondary</span>
      </div>
      <div class="chipbox"><h4>Inputs</h4>
        <span class="minifield">Label</span><span class="minifield">Placeholder</span>
      </div>
      <div class="chipbox"><h4>Tabs</h4>
        <div style="display:flex;gap:10px"><span class="label" style="color:var(--bone);border-bottom:1px solid var(--accent);padding-bottom:4px">One</span><span class="label">Two</span></div>
      </div>
      <div class="chipbox"><h4>Tags</h4>
        <div style="display:flex;gap:6px;flex-wrap:wrap"><span class="minibtn" style="padding:4px 10px">Open</span><span class="minibtn" style="padding:4px 10px">Review</span></div>
      </div>
    </div>
  </div>

  <div class="ds__panel" id="panel-3" role="tabpanel" aria-labelledby="tab-3" hidden>
    <div class="ds__demo">
      <div class="chipbox"><h4>Data table</h4>
        <div class="minirow"><span>Request 2041</span><span class="muted">Approved</span></div>
        <div class="minirow"><span>Request 2042</span><span class="muted">In review</span></div>
        <div class="minirow"><span>Request 2043</span><span class="muted">Draft</span></div>
      </div>
      <div class="chipbox"><h4>Approval flow</h4>
        <div class="minirow"><span>Submitted</span><span style="color:var(--accent)">&rarr;</span></div>
        <div class="minirow"><span>Reviewed</span><span style="color:var(--accent)">&rarr;</span></div>
        <div class="minirow"><span>Approved</span><span></span></div>
      </div>
      <div class="chipbox"><h4>Filters</h4>
        <span class="minifield">Status: all</span><span class="minifield">Owner: any</span>
      </div>
    </div>
  </div>

  <div class="ds__panel" id="panel-4" role="tabpanel" aria-labelledby="tab-4" hidden>
    <div class="chipbox" style="padding:24px">
      <h4>Assembled</h4>
      <div class="minirow" style="border-bottom-color:var(--accent)"><strong>Governance dashboard</strong><span class="label">Live</span></div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:10px;margin-top:12px">
        <div class="minifield">KPI 1</div><div class="minifield">KPI 2</div><div class="minifield">KPI 3</div>
      </div>
      <p class="muted" style="margin-top:12px;font-size:var(--t-small)">
        The same tokens and components, assembled into a working screen.
      </p>
    </div>
  </div>
</section>

<!-- ══════════════════════════════════════════════════════════════════
     SECTION 05 · WHAT I SPECIALISE IN
     Five rows, not a grid of icon cards. Five things said properly
     beats twelve listed.
     ══════════════════════════════════════════════════════════════════ -->
<section class="section wrap invert" id="specialisms" aria-label="What I specialise in">
  <div class="sechead"><span class="label n">(03)</span><span class="label">What I specialise in</span></div>
  <h2 class="headline reveal" style="margin-top:48px;max-width:16ch">Five things, done properly.</h2>
  <ul style="margin-top:56px">__SPECIALISMS__
  </ul>
  <div style="border-top:1px solid var(--line)"></div>
</section>

<!-- ══════════════════════════════════════════════════════════════════
     SECTION 06 · DESIGNING FOR COMPLEXITY
     Deliberately qualitative. The only number is one that can be
     checked against the roles further down.
     ══════════════════════════════════════════════════════════════════ -->
<section class="section wrap" id="impact" aria-label="Designing for complexity">
  <div class="sechead"><span class="label n">(04)</span><span class="label">Designing for complexity</span></div>
  <dl class="impact">__IMPACT__
  </dl>
</section>

<!-- ══════════════════════════════════════════════════════════════════
     SECTION 07 · ABOUT
     ══════════════════════════════════════════════════════════════════ -->
<section class="section wrap invert" id="about" aria-label="About">
  <div class="sechead"><span class="label n">(05)</span><span class="label">About</span></div>
  <div class="about">
    <h2 class="headline about__h reveal">I like complicated products.</h2>
    <div class="about__body">
      <p class="lead reveal" data-delay="100">
        The kind with too many screens, too many stakeholders and too much information.
        My job is to turn that complexity into experiences people can actually understand and use.
      </p>
      <p class="muted reveal" data-delay="180" style="margin-top:24px;max-width:52ch">
        Four years of it so far: enterprise GRC platforms at Beinex, government, fintech and
        HRTech products at Appstation, and education, web and mobile work before that. Mostly
        dashboards, workflows and the design systems that hold them together.
      </p>
      <ul class="sectors label reveal" data-delay="240">__SECTORS__
      </ul>
      <p class="label reveal" data-delay="300" style="margin-top:40px">Kollam, Kerala &middot; UI/UX Designer</p>
    </div>
  </div>
</section>

<!-- ══════════════════════════════════════════════════════════════════
     SECTION 08 · PROCESS
     ══════════════════════════════════════════════════════════════════ -->
<section class="section wrap" id="process" aria-label="How I design">
  <div class="sechead"><span class="label n">(06)</span><span class="label">How I design</span></div>
  <ol class="process">__PROCESS__
  </ol>
</section>

<!-- ══════════════════════════════════════════════════════════════════
     SECTION 09 · EXPERIENCE
     ══════════════════════════════════════════════════════════════════ -->
<section class="section wrap invert" id="experience" aria-label="Experience">
  <div class="sechead"><span class="label n">(07)</span><span class="label">Experience</span></div>
  <ul class="roles">__ROLES__
  </ul>
  <div style="border-top:1px solid var(--line)"></div>
</section>

<!-- ══════════════════════════════════════════════════════════════════
     SECTION 10 · CONTACT
     The address is the call to action. No form — a form needs somewhere
     to submit to, and a dead one silently loses enquiries.
     ══════════════════════════════════════════════════════════════════ -->
<section class="section wrap contact" id="contact" aria-label="Contact">
  <div class="sechead"><span class="label n">(08)</span><span class="label">Contact</span></div>

  <h2 class="headline reveal" style="margin-top:64px;max-width:14ch">
    Let&rsquo;s build<br><span class="light">something good.</span>
  </h2>

  <p class="lead muted reveal" data-delay="120" style="margin-top:24px;max-width:46ch">
    Have a complex product, ambitious idea or design challenge? Let&rsquo;s talk.
  </p>

  <div class="reveal" data-delay="200" style="margin-top:64px">
    <p class="label">Email me</p>
    <a class="contact__mail" href="mailto:radhev1999@gmail.com">radhev1999@gmail.com</a>
  </div>

  <div class="reveal" data-delay="260" style="margin-top:56px">
    <p class="label">Elsewhere</p>
    <ul class="hero__links label" style="margin-top:16px">
      <li><a href="https://www.linkedin.com/in/radhev-r-74481021a" target="_blank" rel="noreferrer">LinkedIn <span aria-hidden="true">&#8599;</span></a></li>
      <li><a href="https://www.behance.net/radhev1999707d" target="_blank" rel="noreferrer">Behance <span aria-hidden="true">&#8599;</span></a></li>
      <li><a href="__RESUME__" target="_blank" rel="noreferrer">R&eacute;sum&eacute; <span aria-hidden="true">&#8599;</span></a></li>
    </ul>
  </div>
</section>

<!-- ══════════════════════════════════════════════════════════════════
     SECTION 11 · FOOTER
     ══════════════════════════════════════════════════════════════════ -->
<footer class="wrap">
  <div class="foot">
    <p class="label">&copy; <span id="year">2026</span> Radhev R</p>
    <p class="label">Kollam, Kerala &middot; +91 808 982 1700</p>
  </div>
</footer>

</main>

<script>
__JS__
</script>
</body>
</html>
"""


def main():
    import base64, pathlib, re, sys

    root = pathlib.Path(__file__).resolve().parent.parent

    def b64(p):
        return base64.b64encode(pathlib.Path(p).read_bytes()).decode()

    # Fonts: the Latin subsets Next already produced. Found by matching the
    # @font-face rules in the built CSS rather than guessing at hashes, so a
    # rebuild that renames them is caught here instead of shipping broken.
    css_files = sorted((root / ".next/static/chunks").glob("*.css"))
    if not css_files:
        sys.exit("No built CSS found — run `npm run build` first.")
    css = css_files[0].read_text()
    fonts = {}
    for block in re.findall(r"@font-face\s*\{([^}]*)\}", css):
        fam = re.search(r"font-family:\s*([^;]+)", block)
        url = re.search(r"url\(([^)]+\.woff2)\)", block)
        if not (fam and url):
            continue
        name = fam.group(1).strip().strip("'\"")
        file = url.group(1).split("/")[-1]
        # ".p." marks the primary (latin) subset.
        if ".p." in file and name not in fonts:
            fonts[name] = file
    missing = {"Host Grotesk", "Geist Mono"} - set(fonts)
    if missing:
        sys.exit(f"Could not find latin subset for: {', '.join(sorted(missing))}")

    font_dir = root / ".next/static/media"
    def find_font(fname):
        hit = list(font_dir.glob(fname)) or list((root / ".next").rglob(fname))
        if not hit:
            sys.exit(f"Font file missing: {fname}")
        return hit[0]

    images = {slug: b64(root / f"public/projects/{slug}.webp") for *_, slug, _, _ in
              [(p[0], p[1], p[2], p[3], p[4], p[5], p[6]) for p in PROJECTS]}

    navlinks = "".join(
        f'\n        <a href="#{i}" data-nav="{i}">{l}</a>' for i, l in NAV)
    menulinks = "".join(
        f'\n  <a href="#{i}">{l}</a>' for i, l in NAV)
    pip = '<i aria-hidden="true"></i>'
    sectors = "".join(
        "\n        " + (pip if k else "") + "<li>" + s + "</li>"
        for k, s in enumerate(SECTORS))

    html = (HTML
            .replace("__CSS__", CSS)
            .replace("__JS__", JS)
            .replace("__FONT_SANS__", b64(find_font(fonts["Host Grotesk"])))
            .replace("__FONT_MONO__", b64(find_font(fonts["Geist Mono"])))
            .replace("__PORTRAIT__", b64(root / "public/radhev-portrait.webp"))
            .replace("__PROJECTS__", build_projects(images))
            .replace("__SPECIALISMS__", build_specialisms())
            .replace("__IMPACT__", build_impact())
            .replace("__PROCESS__", build_process())
            .replace("__ROLES__", build_roles())
            .replace("__SECTORS__", sectors)
            .replace("__RESUME__",
                     "https://drive.google.com/file/d/1U4r89GXL9FD2KHwjFMjn_3RWmzFUPZU9/view?usp=sharing"))

    out = root / "radhev-portfolio.html"
    out.write_text(html, encoding="utf-8")
    print(f"wrote {out}  ({out.stat().st_size/1024:.0f} KB)")


if __name__ == "__main__":
    main()
