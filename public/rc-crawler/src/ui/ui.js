// DOM UI: loading, title + terrain cards, weather presets, HUD telemetry, toasts, menu, settings.
import { fmtTime } from '../challenges/challenges.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

function stars(n) {
  let s = '';
  for (let i = 1; i <= 5; i++) s += n >= i ? '★' : n >= i - 0.5 ? '<span class="half">★</span>' : '<span class="off">★</span>';
  return `<span class="stars">${s.replace(/<span class="half">★<\/span>/g, '<span style="background:linear-gradient(90deg,var(--accent) 50%,rgba(255,255,255,.25) 50%);-webkit-background-clip:text;background-clip:text;color:transparent">★</span>')}</span>`;
}

const GRADIENTS = {
  canyon: 'linear-gradient(160deg,#c98a4b,#6b3f22 60%,#2a1a10)', forest: 'linear-gradient(160deg,#6f8a5a,#2c3d22 60%,#121a0e)',
  mud: 'linear-gradient(160deg,#7a6a4a,#3d2f1f 60%,#1a130b)', desert: 'linear-gradient(160deg,#e3c08a,#a8733f 60%,#4a2e18)',
  creek: 'linear-gradient(160deg,#7fa3a0,#2f4a3e 60%,#101a16)', ultimate: 'linear-gradient(160deg,#9a8f80,#3e3a33 60%,#141210)',
};

// ---------- instrument cluster: analogue dials drawn once as SVG; only the needles and arcs move
// A dial sweeps 240 degrees clockwise from lower-left (150 deg) to lower-right (390 deg), like a car's speedometer.
const DIAL0 = 150, DIAL = 240;
const SPEED_MAX = 6;           // km/h on the dial (scale speed; high range tops out around 2.5-3 on the flat)
const RPM_MAX = 30;            // x1000 motor rpm; red line from 27.5 (top speed in either range sits just below it)
const polar = (cx, cy, r, deg) => [cx + r * Math.cos(deg * Math.PI / 180), cy + r * Math.sin(deg * Math.PI / 180)];
const arcPath = (cx, cy, r, a0, a1) => {
  const [x0, y0] = polar(cx, cy, r, a0), [x1, y1] = polar(cx, cy, r, a1);
  return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
};
function dialSVG(id, { max, major, minor, red, inner }) {
  const ang = (v) => DIAL0 + DIAL * v / max;
  let ticks = '', nums = '';
  for (let v = 0; v <= max + 1e-6; v += minor) {
    const big = Math.abs(v / major - Math.round(v / major)) < 1e-6, a = ang(v), hot = red !== undefined && v >= red - 1e-6;
    const [x0, y0] = polar(100, 100, 86, a), [x1, y1] = polar(100, 100, big ? 73 : 79, a);
    ticks += `<line x1="${x0.toFixed(2)}" y1="${y0.toFixed(2)}" x2="${x1.toFixed(2)}" y2="${y1.toFixed(2)}" class="${big ? 'tk-major' : 'tk-minor'}${hot ? ' tk-red' : ''}"/>`;
    if (big) { const [tx, ty] = polar(100, 100, 60, a); nums += `<text x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" class="${hot ? 'tk-red' : ''}">${Math.round(v)}</text>`; }
  }
  return `<svg viewBox="0 0 200 200" aria-hidden="true">
    <defs><radialGradient id="${id}-face" cx="50%" cy="42%" r="60%"><stop offset="0" stop-color="#202124"/><stop offset="1" stop-color="#0a0a0b"/></radialGradient>
      <linearGradient id="${id}-bezel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6a6c70"/><stop offset=".5" stop-color="#26272a"/><stop offset="1" stop-color="#4a4c50"/></linearGradient></defs>
    <circle cx="100" cy="100" r="96" fill="url(#${id}-face)" stroke="url(#${id}-bezel)" stroke-width="5"/>
    ${red !== undefined ? `<path d="${arcPath(100, 100, 82, ang(red), ang(max))}" class="redzone"/>` : ''}
    ${inner ? `<path d="${arcPath(100, 100, 50, DIAL0, DIAL0 + DIAL)}" class="inner-track"/><path d="${arcPath(100, 100, 50, DIAL0, DIAL0 + DIAL)}" class="inner-fill" pathLength="100" stroke-dasharray="0 100"/>` : ''}
    <g class="ticks">${ticks}</g><g class="nums">${nums}</g>
    <g class="needle" style="transform:rotate(${DIAL0}deg)"><path d="M100 97.2 L186 100 L100 102.8 L84 100 Z"/></g>
    <circle cx="100" cy="100" r="9" class="hub"/>
  </svg>`;
}
// small 120-degree gauge (battery: E..F, motor temperature: C..H) with an icon and a needle
function miniSVG(id, lo, hi, icon, redHigh) {
  const a0 = 210, a1 = 330, cx = 50, cy = 50, r = 38;
  const tick = (a, big) => { const [x0, y0] = polar(cx, cy, r, a), [x1, y1] = polar(cx, cy, r - (big ? 8 : 5), a); return `<line x1="${x0.toFixed(2)}" y1="${y0.toFixed(2)}" x2="${x1.toFixed(2)}" y2="${y1.toFixed(2)}" class="${big ? 'tk-major' : 'tk-minor'}"/>`; };
  let t = ''; for (let i = 0; i <= 4; i++) t += tick(a0 + (a1 - a0) * i / 4, i % 2 === 0);
  const [lx, ly] = polar(cx, cy, r + 9, a0), [hx, hy] = polar(cx, cy, r + 9, a1);
  return `<svg viewBox="0 0 100 62" aria-hidden="true">
    <path d="${arcPath(cx, cy, r + 2, redHigh ? a1 - 24 : a0, redHigh ? a1 : a0 + 24)}" class="redzone thin"/>
    ${t}<text x="${lx.toFixed(1)}" y="${(ly + 3).toFixed(1)}" class="mini-end">${lo}</text><text x="${hx.toFixed(1)}" y="${(hy + 3).toFixed(1)}" class="mini-end">${hi}</text>
    <g transform="translate(43 30) scale(.58)" class="mini-ico">${icon}</g>
    <g class="needle" style="transform:rotate(${a0}deg);transform-origin:50px 50px"><path d="M50 48.6 L86 50 L50 51.4 L44 50 Z"/></g>
    <circle cx="50" cy="50" r="4.5" class="hub"/>
  </svg>`;
}
const ICON_BAT = '<rect x="1" y="4" width="20" height="12" rx="2"/><path d="M5 2v2M17 2v2M5 10h4M13 10h4M15 8v4"/>';
const ICON_TEMP = '<path d="M11 2v11"/><circle cx="11" cy="16" r="4"/><path d="M15 5h4M15 9h4"/>';

export class UI {
  constructor() {
    this.buildCluster();
    this.handlers = {};
    $('#btn-start').onclick = () => this.emit('start');
    $$('#weather button').forEach((b) => (b.onclick = () => this.emit('preset', b.dataset.p)));
    $('#b-reset').onclick = () => this.emit('reset');
    $('#b-recover2').onclick = () => this.emit('reset');
    $('#b-cam').onclick = () => this.emit('camera');
    $('#b-lights').onclick = () => this.emit('lights');
    $('#b-range').onclick = () => this.emit('range');
    $('#b-diff').onclick = () => this.emit('diff');
    $('#b-dig').onclick = () => this.emit('dig');
    for (const [id, ev] of [['#tc-range', 'range'], ['#tc-diff', 'diff'], ['#tc-dig', 'dig']]) $(id).addEventListener('pointerdown', (e) => { e.preventDefault(); this.emit(ev); });
    $('#b-menu').onclick = () => this.emit('menu');
    $('#b-orient').onclick = () => this.emit('orient');
    $('#m-resume').onclick = () => this.emit('resume');
    $('#m-close').onclick = () => this.emit('resume');
    $('#m-restart').onclick = () => this.emit('restart');
    $('#m-title').onclick = () => this.emit('title');
    $$('.tabs button').forEach((b) => (b.onclick = () => this.tab(b.dataset.tab)));
    this.toastT = null;
  }
  on(ev, fn) { (this.handlers[ev] ||= []).push(fn); }
  emit(ev, ...a) { (this.handlers[ev] || []).forEach((f) => f(...a)); }

  tab(id) {
    $$('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === id));
    $$('.tab').forEach((t) => t.classList.toggle('on', t.id === id));
  }

  // ---------- loading
  showLoading(soft, msg) {
    const l = $('#loading');
    l.classList.remove('hidden', 'fade');
    l.classList.toggle('soft', soft);
    l.querySelector('.logo').style.display = soft ? 'none' : '';
    this.loadProgress(0, msg);
  }
  loadProgress(p, msg) { $('.load-bar i').style.width = Math.round(p * 100) + '%'; if (msg) $('.load-text').textContent = msg; }
  hideLoading() { const l = $('#loading'); l.classList.add('fade'); setTimeout(() => l.classList.contains('fade') && l.classList.add('hidden'), 650); }

  // ---------- cards
  buildCards(levels, onPick) {
    this.levels = levels;
    const html = (l, more) => `
      <button class="card" data-id="${l.id}">
        <div class="img" style="background-image:url(assets/previews/${l.id}.jpg), ${GRADIENTS[l.id]}"></div>
        <div class="body">
          <h3>${l.name}</h3>
          ${stars(l.stars)}
          <div class="meta">${l.terrain}<br/>Difficulty: <b>${l.difficulty}</b>
          <div class="more">Technical: <b>${l.technical}</b> · Max slope: <b>${l.maxSlope}</b><br/>Est. time: <b>${l.est}</b> · Best for: <b>${l.bestFor}</b></div></div>
        </div>
      </button>`;
    $('#cards').innerHTML = levels.map((l) => html(l)).join('');
    $('#menu-cards').innerHTML = levels.map((l) => html(l, true)).join('');
    $$('.card').forEach((c) => (c.onclick = () => onPick(c.dataset.id)));
  }
  setCardLoading(id, on) { $$('.card').forEach((c) => c.classList.toggle('loading', on && c.dataset.id === id)); }

  setLevel(def, ch) {
    $$('.card').forEach((c) => c.classList.toggle('sel', c.dataset.id === def.id));
    $('#h-terrain').textContent = def.name;
    $('#h-stars').innerHTML = stars(def.stars);
    $('#h-diff').textContent = 'Difficulty: ' + def.difficulty;
    $('#title-level').innerHTML = `Terrain: <b>${def.name}</b> · ${def.terrain} · Best for ${def.bestFor.toLowerCase()}`;
    this.setChallenge(null);
    this.refreshChallenges(ch);
  }

  setPreset(p) { $$('#weather button').forEach((b) => b.classList.toggle('on', b.dataset.p === p)); }

  setState(s) {
    $('#title').classList.toggle('hidden', s !== 'title');
    $('#hud').classList.toggle('hidden', !(s === 'play' || s === 'paused'));
    $('#weather').classList.toggle('hidden', !(s === 'title' || s === 'paused' || s === 'play'));
    $('#weather').classList.toggle('compact', s === 'play');
    if (s !== 'paused') $('#menu').classList.add('hidden');
  }
  setTouch(on) { $('#touch').classList.toggle('hidden', !on); $('#hud').classList.toggle('touch-on', on); }
  flashKeys() { const k = $('#keys'); k.classList.remove('fade'); clearTimeout(this.keysT); this.keysT = setTimeout(() => k.classList.add('fade'), 12000); }
  setCamLabel(n) { $('#b-cam-l').textContent = n.toUpperCase(); }

  // ---------- vehicle picker (title screen and Settings): body shells on the same RC chassis
  initVehicles(list, current) {
    this.vehicles = list;
    const chips = list.map((v) => `<button data-veh="${v.id}" role="radio" title="${v.name}">${v.short}</button>`).join('');
    $('#veh-pick').innerHTML = chips; $('#s-veh').innerHTML = chips;
    $$('[data-veh]').forEach((b) => (b.onclick = () => this.emit('vehicle', b.dataset.veh)));
    // CC BY: credit each model's author, link the source and the license, and say it was changed
    const credited = list.filter((v) => v.credit).map(({ credit: c }) => `${this.creditHtml(c)} by ${c.author}`);
    $('#credits').innerHTML = credited.length ? `Vehicle bodies: ${credited.join(' and ')}, from Sketchfab under <a href="${list.find((v) => v.credit).credit.licenseUrl}" target="_blank" rel="noopener">CC BY 4.0</a>; adapted for the game (wheels removed, simplified).` : '';
    this.setVehicle(current);
  }
  creditHtml(c) { return `<a href="${c.url}" target="_blank" rel="noopener">“${c.title}”</a>`; }
  setVehicle(id) {
    const v = this.vehicles?.find((x) => x.id === id) || this.vehicles?.[0];
    if (!v) return;
    $$('[data-veh]').forEach((b) => { const on = b.dataset.veh === v.id; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
    const c = v.credit;
    $('#veh-credit').innerHTML = c ? `${v.name} body: ${this.creditHtml(c)} by ${c.author}, <a href="${c.licenseUrl}" target="_blank" rel="noopener">${c.license}</a>, adapted (wheels removed, simplified). Same RC chassis, tyres and handling.` : '';
  }

  // ---------- HUD
  buildCluster() {
    const set = (sel, html) => { const el = $(sel); if (el) el.insertAdjacentHTML('afterbegin', html); };
    set('#g-speedo', dialSVG('gs', { max: SPEED_MAX, major: 1, minor: 0.5 }));
    set('#g-tach', dialSVG('gt', { max: RPM_MAX, major: 5, minor: 2.5, red: 27.5, inner: true }));
    set('#g-bat', miniSVG('gb', 'E', 'F', ICON_BAT, false));
    set('#g-temp', miniSVG('gc', 'C', 'H', ICON_TEMP, true));
    this.needle = {
      speed: $('#g-speedo .needle'), rpm: $('#g-tach .needle'), throttle: $('#g-tach .inner-fill'),
      bat: $('#g-bat .needle'), temp: $('#g-temp .needle'),
    };
  }

  hud(d) {
    const turn = (el, deg) => { if (el) el.style.transform = `rotate(${deg.toFixed(1)}deg)`; };
    const k = (v) => Math.max(0, Math.min(1, v));
    $('#t-speed').textContent = d.speed.toFixed(1);
    turn(this.needle.speed, DIAL0 + DIAL * k(d.speed / SPEED_MAX));
    turn(this.needle.rpm, DIAL0 + DIAL * k(d.rpm));
    this.needle.throttle?.setAttribute('stroke-dasharray', `${(k(d.throttle) * 100).toFixed(1)} 100`);
    turn(this.needle.bat, 210 + 120 * k(d.battery));
    turn(this.needle.temp, 210 + 120 * k((d.temp - 15) / 70));
    $('#t-gear').textContent = d.gear;
    if (d.dir !== this._dir) { this._dir = d.dir; for (const i of $('#t-dir').children) i.classList.toggle('on', i.dataset.d === d.dir); }
    this.drivetrain(d);
    $('#t-batv').textContent = Math.round(d.battery * 100) + '%';
    $('#t-tracv').textContent = Math.round(d.traction * 100) + '%';
    $('#t-tempv').textContent = Math.round(d.temp) + '°';
    // warning lights, as on a dash: lit only while the condition holds
    $('#l-slip').classList.toggle('on', d.traction < 0.45 && d.throttle > 0.2);
    $('#l-bat').classList.toggle('on', d.battery < 0.2);
    $('#l-hot').classList.toggle('on', d.temp > 70);
    $('#h-surface').textContent = d.surface.toUpperCase();
    $('#recover').classList.toggle('hidden', !d.rolled);
  }

  // drivetrain panel: axle diagram + range / diff / dig state
  drivetrain(d) {
    const key = d.gear + d.diff + d.dig;
    if (key === this._dtKey) return;
    this._dtKey = key;
    const front = d.diff === 'LOCKED', rear = d.diff !== 'OPEN';
    $('#d-front').setAttribute('class', front ? '' : 'open');
    $('#d-rear').setAttribute('class', d.dig ? 'dug' : rear ? '' : 'open');
    $('#d-shaftR').setAttribute('class', d.dig ? 'dug' : '');
    $('#t-drive').textContent = d.dig ? 'DIG' : '4WD';
    $('#t-drive').classList.toggle('fwdonly', d.dig);
    $('#t-difflbl').textContent = d.diff === 'LOCKED' ? 'F+R LOCKED' : d.diff === 'FRONT OPEN' ? 'F OPEN · R LOCK' : 'F+R OPEN';
    $('#t-difflbl').classList.toggle('open', d.diff !== 'LOCKED');
    $('#t-range').textContent = d.gear === 'L' ? 'LOW' : 'HIGH';
    $('#l-low').classList.toggle('on', d.gear === 'L');
    $('#l-lock').classList.toggle('on', d.diff !== 'OPEN');
    $('#l-dig').classList.toggle('on', d.dig);
    $('#b-diff').classList.toggle('amber', d.diff !== 'LOCKED');
    $('#b-dig').classList.toggle('on', d.dig);
    $('#tc-range').textContent = d.gear === 'L' ? 'LOW' : 'HIGH';
    $('#tc-diff').classList.toggle('amber', d.diff !== 'LOCKED');
    $('#tc-diff').textContent = d.diff === 'LOCKED' ? 'LOCKED' : d.diff === 'OPEN' ? 'OPEN' : 'F OPEN';
    $('#tc-dig').classList.toggle('on', d.dig);
  }

  setChallenge(c, stateText = '') {
    const el = $('#h-challenge');
    if (!c) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    el.querySelector('.ch-name').textContent = c.name;
    el.querySelector('.ch-desc').textContent = c.desc;
    el.querySelector('.ch-state').textContent = stateText;
    if (stateText.startsWith('Drive')) el.querySelector('.ch-time').textContent = '0:00.0';
  }
  challengeTime(t) { $('#h-challenge .ch-time').textContent = t; }

  refreshChallenges(ch) {
    if (!ch) return;
    $('#ch-list').innerHTML = ch.list.map((c) => {
      const b = ch.bestFor(c), medal = ch.medalOf ? ch.medalOf(c) : null;
      const tier = c.tier ? `<span class="tier tier-${c.tier.toLowerCase()}">${c.tier}</span>` : '';
      const par = c.par ? ` <span class="par">Par ${fmtTime(c.par)}</span>` : '';
      const med = medal ? `<span class="medal medal-${medal}" title="${medal} medal"></span>` : '';
      return `<button class="ch-item ${ch.active?.id === c.id ? 'on' : ''}" data-id="${c.id}">
        <h4>${med}${c.name} ${tier}</h4><p>${c.desc}${par}</p>
        <div class="best">${ch.active?.id === c.id ? 'ACTIVE · TAP TO CLEAR' : 'BEST'}<b>${b ? fmtTime(b) : '—'}</b></div></button>`;
    }).join('') || '<p class="note">No challenges on this terrain.</p>';
    $$('.ch-item').forEach((b) => (b.onclick = () => this.emit('challenge', b.dataset.id)));
  }

  toast(title, sub) {
    const t = $('#toast');
    t.innerHTML = title + (sub ? `<small>${sub}</small>` : '');
    t.classList.add('show');
    clearTimeout(this.toastT);
    this.toastT = setTimeout(() => t.classList.remove('show'), 2400);
  }

  openMenu(ch) { this.refreshChallenges(ch); $('#menu').classList.remove('hidden'); this.tab('m-main'); }
  closeMenu() { $('#menu').classList.add('hidden'); }

  initSettings(s) {
    const seg = (id, key, val, ev) => {
      $$(`#${id} button`).forEach((b) => {
        b.classList.toggle('on', b.dataset[key] === val);
        b.onclick = () => { $$(`#${id} button`).forEach((x) => x.classList.toggle('on', x === b)); this.emit(ev, b.dataset[key]); };
      });
    };
    seg('s-quality', 'q', s.quality, 'quality');
    seg('s-touch', 'v', s.touch, 'touch');
    seg('s-dof', 'v', s.dof, 'dof');
    seg('s-fps', 'v', s.fps, 'fps');
    seg('s-amb', 'v', s.ambience || 'on', 'ambience');
    // drag brake, on the instrument cluster: the button shows the strength. With the full cluster it switches the
    // drag brake on / off and the slider sets the strength; the compact (phone) cluster has no room for a slider,
    // so there a tap steps 100 -> 75 -> 50 -> 25 -> off -> 100
    let dragOn = s.dragBrake !== 'off', dragPct = s.dragPct ?? 100;
    const compact = matchMedia('(max-width: 720px), (orientation: landscape) and (max-height: 500px)');
    const drag = () => {
      $('#t-drag').value = dragPct; $('#t-drag').disabled = !dragOn;
      $('#b-drag').textContent = dragOn ? `DRAG ${dragPct}%` : 'DRAG OFF';
      $('#b-drag').classList.toggle('on', dragOn);
    };
    const set = (on, pct) => { const was = dragOn; dragOn = on; dragPct = pct; drag(); if (was !== on) this.emit('dragBrake', on ? 'on' : 'off'); this.emit('dragPct', pct); };
    drag();
    $('#b-drag').onclick = () => {
      if (!compact.matches) return set(!dragOn, dragOn || dragPct ? dragPct : 100);
      if (!dragOn) return set(true, 100);
      const steps = [100, 75, 50, 25], i = steps.indexOf(dragPct);
      if (i < 0 || i === steps.length - 1) set(i < 0 ? true : false, i < 0 ? 100 : dragPct); else set(true, steps[i + 1]);
    };
    $('#t-drag').oninput = (e) => set(dragOn, +e.target.value);
    $('#t-drag').onchange = (e) => e.target.blur();   // hand the arrow keys back to driving
    $('#s-vol').value = s.volume;
    $('#s-vol').oninput = (e) => this.emit('volume', +e.target.value);
    this.showFps(s.fps === 'on');
  }
  showFps(on) { $('#fps').classList.toggle('hidden', !on); }
  fps(n) { if (!$('#fps').classList.contains('hidden')) $('#fps').textContent = n + ' FPS'; }
}
