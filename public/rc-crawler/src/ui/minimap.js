// Minimap: a north-up, top-down map of the whole terrain with every truck on it.
//
// The terrain layer is drawn once per level into an offscreen canvas, a few rows per idle slice so loading
// never hitches: surface colours from the heightfield, hill shading, 2 m contour lines and water, then the
// trail, side spurs, activity sections, rocks, logs, stakes and trees. Each redraw (at most 30 per second,
// none while hidden) copies the visible part of that layer and draws the live layer over it: the start,
// gates or checkpoints with the next one highlighted, other players in their livery colours, and this
// truck with its heading and a wedge for where the camera is looking.
//
// North-up and independent of the camera, so it reads the same whichever way the truck or camera turns.
// Small map: bottom-left on desktop, top-right on phones; zoomed in it follows the truck. N or a tap
// expands it to a large map of the whole terrain with names and a legend; + / - zoom; it can be hidden.
const STATE_KEY = 'rccrawler.map.v1';
const RES = 640;                       // terrain layer resolution, px per side
const FPS = 30;
const ZOOMS = [1, 1.5, 2, 3, 4, 6];
const SURF_RGB = [[138, 112, 82], [128, 124, 118], [96, 122, 66], [201, 171, 121], [96, 74, 52], [150, 143, 130], [125, 92, 60], [232, 236, 240]];
const TIER_COLOR = { green: '#37d67a', blue: '#3aa0ff', black: '#111111' };
const ACCENT = '#f6b51e';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ICON = {
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  minus: '<svg viewBox="0 0 24 24"><path d="M5 12h14"/></svg>',
  expand: '<svg viewBox="0 0 24 24"><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/></svg>',
  shrink: '<svg viewBox="0 0 24 24"><path d="M4 14h6v6M20 10h-6V4M10 14l-7 7M14 10l7-7"/></svg>',
  hide: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  map: '<svg viewBox="0 0 24 24"><path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/></svg>',
};

export class Minimap {
  // source() -> { me: {x, z, yaw}, camYaw, others: [{x, z, yaw, color, name, talking}],
  //               gates: [{x, z, yaw, width, state}], points: [{x, z, done}] } or null
  constructor(source) {
    this.source = source;
    this.level = null; this.layer = null; this.ready = false; this.token = 0;
    this.shown = false; this.acc = 1;
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(STATE_KEY) || '{}'); } catch { /* storage blocked */ }
    this.mode = saved.mode === 'hidden' ? 'hidden' : 'mini';     // mini | big | hidden
    this.zoom = { mini: ZOOMS.includes(saved.zm) ? saved.zm : 2, big: ZOOMS.includes(saved.zb) ? saved.zb : 1 };

    const el = (this.el = document.createElement('div'));
    el.id = 'minimap'; el.className = 'mm hidden';
    el.innerHTML = `<div class="mm-head"><b>MAP</b><span class="mm-name"></span></div>
      <div class="mm-box"><canvas class="mm-c" role="img" aria-label="Map of the terrain"></canvas><span class="mm-n">N</span>
        <div class="mm-ctl">
          <button data-a="in" title="Zoom in (+)" aria-label="Zoom in">${ICON.plus}</button>
          <button data-a="out" title="Zoom out (-)" aria-label="Zoom out">${ICON.minus}</button>
          <button data-a="big" title="Expand map (N)" aria-label="Expand map">${ICON.expand}</button>
          <button data-a="hide" title="Hide map" aria-label="Hide map">${ICON.hide}</button>
        </div></div>
      <div class="mm-legend"><span><i class="lg-me"></i>You</span><span><i class="lg-pl"></i>Players</span><span><i class="lg-trail"></i>Trail</span><span><i class="lg-act"></i>Activity</span><span><i class="lg-gate"></i>Next gate / checkpoint</span><span><i class="lg-water"></i>Water</span></div>`;
    document.body.appendChild(el);
    const show = (this.showBtn = document.createElement('button'));
    show.id = 'mm-show'; show.className = 'mm-show hidden'; show.title = 'Show map (N)'; show.setAttribute('aria-label', 'Show map');
    show.innerHTML = ICON.map;
    document.body.appendChild(show);
    this.canvas = el.querySelector('canvas'); this.g = this.canvas.getContext('2d');

    el.querySelector('.mm-ctl').addEventListener('click', (e) => {
      const a = e.target.closest('button')?.dataset.a;
      if (a === 'in') this.zoomBy(1); else if (a === 'out') this.zoomBy(-1);
      else if (a === 'big') this.setMode(this.mode === 'big' ? 'mini' : 'big');
      else if (a === 'hide') this.setMode('hidden');
    });
    this.canvas.addEventListener('click', () => this.setMode(this.mode === 'big' ? 'mini' : 'big'));
    this.canvas.addEventListener('wheel', (e) => { e.preventDefault(); this.zoomBy(e.deltaY < 0 ? 1 : -1); }, { passive: false });
    show.addEventListener('click', () => this.setMode('mini'));
    this.apply();
  }

  // ---------- state
  save() { try { localStorage.setItem(STATE_KEY, JSON.stringify({ mode: this.mode === 'hidden' ? 'hidden' : 'mini', zm: this.zoom.mini, zb: this.zoom.big })); } catch { /* storage blocked */ } }
  setMode(m) { this.mode = m; this.save(); this.apply(); this.acc = 1; }
  toggle() { this.setMode(this.mode === 'big' ? 'mini' : 'big'); }
  zoomBy(d) {
    const k = this.mode === 'big' ? 'big' : 'mini', i = ZOOMS.indexOf(this.zoom[k]);
    this.zoom[k] = ZOOMS[clamp(i + d, 0, ZOOMS.length - 1)];
    this.save(); this.acc = 1;
  }
  setVisible(on) { this.shown = on; this.apply(); }
  apply() {
    this.el.classList.toggle('hidden', !this.shown || this.mode === 'hidden');
    this.el.classList.toggle('big', this.mode === 'big');
    this.showBtn.classList.toggle('hidden', !this.shown || this.mode !== 'hidden');
    const b = this.el.querySelector('[data-a="big"]');
    b.innerHTML = this.mode === 'big' ? ICON.shrink : ICON.expand;
    b.title = this.mode === 'big' ? 'Back to the small map (N)' : 'Expand map (N)';
  }

  // ---------- terrain layer, built in slices
  setLevel(level) {
    this.level = level; this.ready = false;
    const token = ++this.token, hf = level.hf, size = hf.size, half = size / 2, S = RES, mpp = size / S;
    this.el.querySelector('.mm-name').textContent = level.def.name || '';
    const layer = document.createElement('canvas'); layer.width = layer.height = S;
    const lg = layer.getContext('2d'), img = lg.createImageData(S, S), d = img.data;
    const H = new Float32Array((S + 2) * (S + 2));
    let row = -1, lo = Infinity, hi = -Infinity;
    const idle = window.requestIdleCallback ? (f) => requestIdleCallback(f, { timeout: 120 }) : (f) => setTimeout(f, 16);
    const heights = () => {
      if (token !== this.token) return;
      for (const end = Math.min(S + 1, row + 32); row < end; row++) {
        const z = clamp((row + 0.5) * mpp - half, -half, half);
        for (let i = -1; i <= S; i++) {
          const h = hf.baseHeightAt(clamp((i + 0.5) * mpp - half, -half, half), z);
          H[(row + 1) * (S + 2) + i + 1] = h;
          if (h < lo) lo = h; if (h > hi) hi = h;
        }
      }
      if (row <= S) return idle(heights);
      row = 0; idle(colours);
    };
    const colours = () => {
      if (token !== this.token) return;
      const range = Math.max(1, hi - lo), W = S + 2;
      for (const end = Math.min(S, row + 24); row < end; row++) {
        const z = (row + 0.5) * mpp - half;
        for (let i = 0; i < S; i++) {
          const x = (i + 0.5) * mpp - half, k = (row + 1) * W + i + 1, h = H[k];
          let [r, g, b] = SURF_RGB[hf.surfaceAt(x, z)] || SURF_RGB[0];
          // hill shading, lit from the north-west
          const dx = (H[k + 1] - H[k - 1]) / (2 * mpp), dz = (H[k + W] - H[k - W]) / (2 * mpp);
          const shade = clamp(0.92 + (-dx - dz) * 0.32, 0.55, 1.3) * (0.88 + 0.24 * (h - lo) / range);
          r *= shade; g *= shade; b *= shade;
          // contour line every 2 m
          if (Math.floor(h / 2) !== Math.floor(H[k + 1] / 2) || Math.floor(h / 2) !== Math.floor(H[k + W] / 2)) { r *= 0.8; g *= 0.8; b *= 0.8; }
          const wd = hf.waterDepthAt(x, z);
          if (wd > 0.02) { const a = clamp(0.55 + wd * 1.5, 0.55, 0.85); r = r * (1 - a) + 52 * a; g = g * (1 - a) + 118 * a; b = b * (1 - a) + 168 * a; }
          const o = (row * S + i) * 4;
          d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = 255;
        }
      }
      if (row < S) return idle(colours);
      lg.putImageData(img, 0, 0);
      this.drawFeatures(lg, level, S / size, half);
      this.layer = layer; this.ready = true; this.acc = 1;
    };
    idle(heights);
  }

  // trail, activity sections and obstacles, in terrain-layer pixels
  drawFeatures(g, level, k, half) {
    const ctx = level.ctx || {}, P = (x) => (x + half) * k;
    const line = (pts, w, style) => {
      if (!pts || pts.length < 2) return;
      g.beginPath(); g.moveTo(P(pts[0].x), P(pts[0].z));
      for (let i = 1; i < pts.length; i++) g.lineTo(P(pts[i].x), P(pts[i].z));
      g.lineWidth = w * k; g.strokeStyle = style; g.stroke();
    };
    g.lineCap = 'round'; g.lineJoin = 'round';
    // trees (canopies), rocks, logs
    g.fillStyle = 'rgba(26, 56, 28, 0.5)';
    for (const t of ctx.veg?.trees || []) { g.beginPath(); g.arc(P(t.x), P(t.z), clamp(t.s * 0.045, 0.45, 2) * k, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = 'rgba(66, 62, 58, 0.8)';
    for (const r of ctx.rocks?.instances || []) { if (r.radius < 0.45) continue; g.beginPath(); g.arc(P(r.x), P(r.z), r.radius * 0.6 * k, 0, Math.PI * 2); g.fill(); }
    g.strokeStyle = 'rgba(94, 62, 36, 0.95)'; g.lineCap = 'round';
    for (const l of ctx.logs || []) {
      const ux = Math.sin(l.yaw) * l.length / 2, uz = Math.cos(l.yaw) * l.length / 2;
      g.lineWidth = Math.max(1.5, l.radius * 2 * k);
      g.beginPath(); g.moveTo(P(l.x - ux), P(l.z - uz)); g.lineTo(P(l.x + ux), P(l.z + uz)); g.stroke();
    }
    // trail and the spurs to the activity sections
    const spurs = (level.activities?.spurs || []).map((s) => s.pts);
    for (const pts of spurs) line(pts, 2.4, 'rgba(30, 22, 14, 0.35)');
    line(level.path?.pts, 3.4, 'rgba(30, 22, 14, 0.4)');
    for (const pts of spurs) line(pts, 1.6, 'rgba(236, 222, 192, 0.7)');
    line(level.path?.pts, 2.4, 'rgba(240, 226, 196, 0.85)');
    // activity sections: their pad, and a tier dot at the entrance
    for (const s of level.activities?.sites || []) {
      const fu = Math.sin(s.yaw), fz = Math.cos(s.yaw);
      g.save(); g.translate(P(s.cx), P(s.cz)); g.rotate(Math.atan2(fz, fu));
      g.fillStyle = 'rgba(246, 181, 30, 0.2)'; g.strokeStyle = 'rgba(246, 181, 30, 0.9)'; g.lineWidth = Math.max(1, 0.3 * k);
      g.beginPath(); g.rect((-s.len / 2) * k, (-s.wid / 2) * k, s.len * k, s.wid * k); g.fill(); g.stroke();
      if (s.kind === 'jump') {    // a chevron for jumps
        g.beginPath(); g.moveTo(-1 * k, -1.2 * k); g.lineTo(1 * k, 0); g.lineTo(-1 * k, 1.2 * k); g.stroke();
      }
      g.restore();
      const c = level.challenges?.find((q) => q.id === s.id);
      const tier = c?.tier || 'green', e = { x: s.cx - fu * s.len / 2, z: s.cz - fz * s.len / 2 };
      g.fillStyle = TIER_COLOR[tier] || TIER_COLOR.green; g.strokeStyle = '#fff'; g.lineWidth = Math.max(1, 0.15 * k);
      g.beginPath(); g.arc(P(e.x), P(e.z), 0.7 * k, 0, Math.PI * 2); g.fill(); g.stroke();
    }
    // stakes
    g.fillStyle = 'rgba(229, 72, 58, 0.9)';
    for (const m of level.markers || []) if (m.type === 'stake') { g.beginPath(); g.arc(P(m.x), P(m.z), Math.max(0.8, 0.18 * k), 0, Math.PI * 2); g.fill(); }
  }

  // ---------- live layer
  update(dt) {
    if (!this.shown || this.mode === 'hidden' || !this.ready || document.hidden) return;
    this.acc += dt;
    if (this.acc < 1 / FPS) return;
    this.acc = 0;
    const src = this.source();
    if (src) this.draw(src);
  }

  draw(src) {
    const cv = this.canvas, css = cv.clientWidth;
    if (!css) return;
    const dpr = Math.min(2, devicePixelRatio || 1), W = Math.round(css * dpr);
    if (cv.width !== W || cv.height !== W) { cv.width = cv.height = W; }
    const g = this.g, lvl = this.level, size = lvl.hf.size, half = size / 2, big = this.mode === 'big';
    const zoom = this.zoom[big ? 'big' : 'mini'], span = size / zoom, me = src.me;
    const cx = zoom === 1 ? 0 : clamp(me.x, -half + span / 2, half - span / 2);
    const cz = zoom === 1 ? 0 : clamp(me.z, -half + span / 2, half - span / 2);
    const s = W / span, X = (x) => (x - cx) * s + W / 2, Z = (z) => (z - cz) * s + W / 2;
    const k = RES / size;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.imageSmoothingEnabled = true;
    g.drawImage(this.layer, (cx - span / 2 + half) * k, (cz - span / 2 + half) * k, span * k, span * k, 0, 0, W, W);
    const px = dpr * (big ? 1.25 : 1);     // marker scale, in device pixels per CSS pixel
    const text = clamp(css / 60, 8.5, 12); // label size follows the map's size, so a phone's large map stays legible
    const font = (w = 500) => `${w} ${Math.round(text * dpr)}px 'Host Grotesk', system-ui, sans-serif`;

    // labels for activity sections (large map)
    if (big) {
      g.font = font(500); g.textAlign = 'center'; g.textBaseline = 'middle';
      for (const st of lvl.activities?.sites || []) {
        const c = lvl.challenges?.find((q) => q.id === st.id);
        if (c) this.label(g, c.name, X(st.cx), Z(st.cz) - text * dpr, 'rgba(255,255,255,0.92)');
      }
    }
    // start
    const sp = lvl.spawn;
    if (sp) this.flag(g, X(sp.x), Z(sp.z), 7 * px);

    // course: gates (next one bright, finish green) and checkpoints
    let target = null;
    for (const gt of src.gates || []) {
      if (gt.state === 'done') continue;
      const ax = Math.cos(gt.yaw), az = -Math.sin(gt.yaw), w = (gt.width || 2.4) / 2;
      const on = gt.state === 'next', fin = gt.state === 'finish' || gt.last;
      g.lineCap = 'round'; g.lineWidth = (on ? 4 : 2.5) * px;
      g.strokeStyle = on ? ACCENT : fin ? 'rgba(55, 214, 122, 0.9)' : 'rgba(255, 122, 26, 0.6)';
      const lw = Math.max(w * s, 4 * px);
      g.beginPath(); g.moveTo(X(gt.x) - ax * lw, Z(gt.z) - az * lw); g.lineTo(X(gt.x) + ax * lw, Z(gt.z) + az * lw); g.stroke();
      if (on) target = gt;
    }
    for (const p of src.points || []) {
      g.lineWidth = 2 * px;
      g.strokeStyle = p.done ? 'rgba(255,255,255,0.25)' : '#49d6ff'; g.fillStyle = p.done ? 'rgba(255,255,255,0.08)' : 'rgba(73, 214, 255, 0.28)';
      g.beginPath(); g.arc(X(p.x), Z(p.z), 4.5 * px, 0, Math.PI * 2); g.fill(); g.stroke();
      if (!p.done) { const d = (p.x - me.x) ** 2 + (p.z - me.z) ** 2; if (!target || d < target.d) target = { x: p.x, z: p.z, d }; }
    }
    // a dashed line to the next gate or the nearest checkpoint
    if (target) {
      g.setLineDash([4 * px, 4 * px]); g.lineWidth = 1.5 * px; g.strokeStyle = 'rgba(246, 181, 30, 0.75)';
      g.beginPath(); g.moveTo(X(me.x), Z(me.z)); g.lineTo(X(target.x), Z(target.z)); g.stroke(); g.setLineDash([]);
    }

    // other players: arrows in their livery colour; at the edge, pointing the way, when off the map view
    for (const o of src.others || []) {
      let x = X(o.x), z = Z(o.z);
      const m = 7 * px, out = x < m || z < m || x > W - m || z > W - m;
      if (out) {
        x = clamp(x, m, W - m); z = clamp(z, m, W - m);
        this.arrow(g, x, z, Math.atan2(Z(o.z) - z, X(o.x) - x), 5 * px, o.color, 'rgba(0,0,0,0.6)', 0.75);
        continue;
      }
      if (o.talking) { g.strokeStyle = 'rgba(73, 194, 90, 0.9)'; g.lineWidth = 2 * px; g.beginPath(); g.arc(x, z, 9 * px, 0, Math.PI * 2); g.stroke(); }
      this.arrow(g, x, z, Math.atan2(Math.cos(o.yaw), Math.sin(o.yaw)), 6.5 * px, o.color, 'rgba(0,0,0,0.75)', 1);
      if (big && o.name) { g.font = font(); g.textAlign = 'center'; g.textBaseline = 'bottom'; this.label(g, o.name, x, z - 10 * px, o.color); }
    }

    // this truck: camera wedge, then the arrow on top
    const mx = X(me.x), mz = Z(me.z);
    if (Number.isFinite(src.camYaw)) {
      const a = Math.atan2(Math.cos(src.camYaw), Math.sin(src.camYaw)), r = (big ? 46 : 30) * px;
      const grd = g.createRadialGradient(mx, mz, 0, mx, mz, r);
      grd.addColorStop(0, 'rgba(255,255,255,0.32)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd; g.beginPath(); g.moveTo(mx, mz); g.arc(mx, mz, r, a - 0.6, a + 0.6); g.closePath(); g.fill();
    }
    this.arrow(g, mx, mz, Math.atan2(Math.cos(me.yaw), Math.sin(me.yaw)), 8 * px, ACCENT, '#fff', 1);   // always yellow: 'you' at a glance
  }

  // an arrow pointing along angle a (canvas radians), centred on (x, y)
  arrow(g, x, y, a, r, fill, stroke, alpha) {
    g.save(); g.translate(x, y); g.rotate(a); g.globalAlpha = alpha;
    g.beginPath(); g.moveTo(r * 1.15, 0); g.lineTo(-r * 0.8, r * 0.75); g.lineTo(-r * 0.4, 0); g.lineTo(-r * 0.8, -r * 0.75); g.closePath();
    g.fillStyle = fill; g.fill(); g.lineWidth = Math.max(1, r * 0.22); g.strokeStyle = stroke; g.stroke();
    g.restore();
  }

  flag(g, x, y, r) {
    g.save(); g.translate(x, y);
    g.strokeStyle = '#fff'; g.lineWidth = Math.max(1, r * 0.22);
    g.beginPath(); g.moveTo(0, r); g.lineTo(0, -r); g.stroke();
    g.fillStyle = ACCENT; g.beginPath(); g.moveTo(0, -r); g.lineTo(r * 1.1, -r * 0.6); g.lineTo(0, -r * 0.2); g.closePath(); g.fill();
    g.restore();
  }

  label(g, text, x, y, color) {
    g.lineWidth = 3 * Math.min(2, devicePixelRatio || 1); g.strokeStyle = 'rgba(0,0,0,0.7)'; g.strokeText(text, x, y);
    g.fillStyle = color; g.fillText(text, x, y);
  }
}
