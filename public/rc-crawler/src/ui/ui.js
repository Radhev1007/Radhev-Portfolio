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

export class UI {
  constructor() {
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
    $('#m-resume').onclick = () => this.emit('resume');
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

  // ---------- HUD
  hud(d) {
    $('#t-speed').textContent = d.speed.toFixed(1);
    $('#t-gear').textContent = d.gear;
    $('#t-gearbar').style.width = (d.rpm * 100).toFixed(0) + '%';
    $('#t-dir').textContent = d.dir;
    this.drivetrain(d);
    $('#t-thr').style.width = (d.throttle * 100).toFixed(0) + '%';
    $('#t-bat').style.width = (d.battery * 100).toFixed(0) + '%';
    $('#t-bat').style.background = d.battery < 0.2 ? '#e5483a' : '';
    $('#t-batv').textContent = Math.round(d.battery * 100) + '%';
    $('#t-trac').style.width = (d.traction * 100).toFixed(0) + '%';
    $('#t-trac').style.background = d.traction < 0.45 ? '#f6b51e' : '';
    $('#t-temp').style.width = Math.min(100, (d.temp - 15) / 70 * 100).toFixed(0) + '%';
    $('#t-tempv').textContent = Math.round(d.temp) + '°';
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
      const b = ch.bestFor(c);
      return `<button class="ch-item ${ch.active?.id === c.id ? 'on' : ''}" data-id="${c.id}">
        <h4>${c.name}</h4><p>${c.desc}</p>
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
    $('#s-vol').value = s.volume;
    $('#s-vol').oninput = (e) => this.emit('volume', +e.target.value);
    this.showFps(s.fps === 'on');
  }
  showFps(on) { $('#fps').classList.toggle('hidden', !on); }
  fps(n) { if (!$('#fps').classList.contains('hidden')) $('#fps').textContent = n + ' FPS'; }
}
