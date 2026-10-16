// Phones play sideways. When driving starts, the game asks for full screen and a landscape lock (Android
// Chrome and most Android browsers allow it, from a tap). Inside the portfolio the page around the game does
// it for its own frame, so the "Back to portfolio" button stays on screen. Where the browser cannot turn the
// page (iPhone Safari, or a phone with rotation lock on), a card asks the player to turn the phone while it is
// held upright; it can be dismissed to keep playing in portrait.
//
// The rotate button (phones only) switches between landscape and portrait at any time. Where the browser
// cannot lock the orientation, the portfolio draws the game frame sideways instead (iPhone Safari); the game
// itself then simply sees a landscape screen.
const OK_KEY = 'rccrawler.portraitOk';

export class Landscape {
  constructor() {
    this.phone = matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 600;
    this.embedded = window.self !== window.top;
    let ok = false;
    try { ok = sessionStorage.getItem(OK_KEY) === '1'; } catch { /* storage blocked */ }
    const root = document.documentElement;
    root.classList.toggle('phone', this.phone);
    root.classList.toggle('portrait-ok', ok);
    if (!this.phone) return;
    const card = document.createElement('div');
    card.id = 'rotate'; card.className = 'rotate';
    card.innerHTML = `<div class="rotate-card">
      <svg class="rotate-ico" viewBox="0 0 48 48" aria-hidden="true"><rect x="15" y="6" width="18" height="32" rx="3"/><path d="M21 33h6"/><path d="M38 18a14 14 0 0 1-4 14" class="rotate-arc"/><path d="M34 32l0.5-4.5L38 30" class="rotate-arc"/></svg>
      <h3>Turn your phone sideways</h3>
      <p>The trails are made for landscape. If the screen doesn't turn, switch off rotation lock${this.embedded ? ' or turn the game here' : ''}.</p>
      ${this.embedded ? '<button id="rotate-turn" class="rotate-btn rotate-main">TURN THE GAME</button>' : ''}
      <button id="rotate-ok" class="rotate-btn">PLAY IN PORTRAIT</button></div>`;
    document.body.appendChild(card);
    card.querySelector('#rotate-ok').onclick = () => this.choose('portrait');
    card.querySelector('#rotate-turn')?.addEventListener('click', () => this.choose('landscape', true));
    const label = () => { const b = document.getElementById('b-orient'); if (b) b.title = innerWidth > innerHeight ? 'Switch to portrait' : 'Switch to landscape'; };
    addEventListener('resize', label); label();
  }

  // the card only shows while driving
  setPlaying(on) { document.documentElement.classList.toggle('playing', on); }

  // call from a tap (starting to drive): browsers only allow full screen and the lock right after one
  request() {
    if (!this.phone) return;
    this.turn(document.documentElement.classList.contains('portrait-ok') ? 'portrait' : 'landscape', false);
  }

  // the rotate button: switch to the other orientation, drawing the game sideways if nothing else can
  toggle() {
    if (this.phone) this.choose(innerWidth > innerHeight ? 'portrait' : 'landscape', true);
  }

  choose(want, force) {
    document.documentElement.classList.toggle('portrait-ok', want === 'portrait');
    try { sessionStorage.setItem(OK_KEY, want === 'portrait' ? '1' : '0'); } catch { /* storage blocked */ }
    this.turn(want, force);
  }

  // force: where the orientation cannot be locked, the portfolio turns the game frame itself
  turn(want, force) {
    if (this.embedded) {
      try { window.parent.postMessage({ type: 'rc:orientation', want, force }, location.origin); } catch { /* not the portfolio */ }
      return;
    }
    const el = document.documentElement;
    const full = document.fullscreenElement ? Promise.resolve() : el.requestFullscreen ? el.requestFullscreen({ navigationUI: 'hide' }) : Promise.reject();
    full.then(() => screen.orientation?.lock?.(want)).catch(() => { /* not allowed here: the card asks instead */ });
  }
}
