// Phones play sideways. When driving starts, the game asks for full screen and a landscape lock (Android
// Chrome and most Android browsers allow it, from a tap). Inside the portfolio the page around the game does
// it for its own frame, so the "Back to portfolio" button stays on screen. Where the browser cannot turn the
// page (iPhone Safari, or a phone with rotation lock on), a card asks the player to turn the phone while it is
// held upright; it can be dismissed to keep playing in portrait.
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
      <p>The trails are made for landscape. If the screen doesn't turn, switch off rotation lock.</p>
      <button id="rotate-ok" class="rotate-btn">PLAY IN PORTRAIT</button></div>`;
    document.body.appendChild(card);
    card.querySelector('#rotate-ok').onclick = () => {
      root.classList.add('portrait-ok');
      try { sessionStorage.setItem(OK_KEY, '1'); } catch { /* storage blocked */ }
    };
  }

  // the card only shows while driving
  setPlaying(on) { document.documentElement.classList.toggle('playing', on); }

  // call from a tap (starting to drive): browsers only allow full screen and the lock right after one
  request() {
    if (!this.phone) return;
    if (this.embedded) {
      try { window.parent.postMessage({ type: 'rc:landscape' }, location.origin); } catch { /* not the portfolio */ }
      return;
    }
    const el = document.documentElement;
    const full = document.fullscreenElement ? Promise.resolve() : el.requestFullscreen ? el.requestFullscreen({ navigationUI: 'hide' }) : Promise.reject();
    full.then(() => screen.orientation?.lock?.('landscape')).catch(() => { /* not allowed here: the card asks instead */ });
  }
}
