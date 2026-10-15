// Keyboard, mouse (orbit + wheel zoom) and on-screen touch controls.
export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.touch = { throttle: 0, steer: 0, brake: false };
    this.handlers = {};
    this.mouseDown = false;
    this.enabled = true;
    addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
      const k = e.key.toLowerCase();
      if (!this.keys.has(k)) this.emit('press', k, e);
      this.keys.add(k);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    addEventListener('blur', () => this.keys.clear());
    canvas.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse') { this.mouseDown = true; this.lx = e.clientX; this.ly = e.clientY; } });
    addEventListener('pointerup', () => (this.mouseDown = false));
    addEventListener('pointermove', (e) => {
      if (!this.mouseDown) return;
      this.emit('orbit', e.clientX - this.lx, e.clientY - this.ly);
      this.lx = e.clientX; this.ly = e.clientY;
    });
    canvas.addEventListener('wheel', (e) => { e.preventDefault(); this.emit('zoom', e.deltaY); }, { passive: false });
    // single-finger drag on the canvas orbits on touch devices too
    let tId = null, tx = 0, ty = 0;
    canvas.addEventListener('touchstart', (e) => { const t = e.changedTouches[0]; tId = t.identifier; tx = t.clientX; ty = t.clientY; }, { passive: true });
    canvas.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) if (t.identifier === tId) { this.emit('orbit', (t.clientX - tx) * 1.5, (t.clientY - ty) * 1.5); tx = t.clientX; ty = t.clientY; }
    }, { passive: true });
  }

  on(ev, fn) { (this.handlers[ev] ||= []).push(fn); }
  emit(ev, ...a) { (this.handlers[ev] || []).forEach((f) => f(...a)); }
  down(...ks) { return ks.some((k) => this.keys.has(k)); }

  get state() {
    if (!this.enabled) return { throttle: 0, steer: 0, handbrake: false };
    let throttle = 0, steer = 0;
    if (this.down('w', 'arrowup')) throttle += 1;
    if (this.down('s', 'arrowdown')) throttle -= 1;
    if (this.down('a', 'arrowleft')) steer += 1;
    if (this.down('d', 'arrowright')) steer -= 1;
    if (this.down('shift')) throttle *= 0.45; // feather throttle
    throttle += this.touch.throttle; steer += this.touch.steer;
    return { throttle: Math.max(-1, Math.min(1, throttle)), steer: Math.max(-1, Math.min(1, steer)), handbrake: this.down(' ') || this.touch.brake };
  }

  // on-screen touch controls: left stick = steer, right pedals = throttle/reverse, brake
  bindTouchUI(root) {
    const stick = root.querySelector('#tc-steer'), knob = stick.querySelector('.knob');
    let sid = null, cx = 0;
    stick.addEventListener('pointerdown', (e) => { sid = e.pointerId; stick.setPointerCapture(sid); const r = stick.getBoundingClientRect(); cx = r.left + r.width / 2; move(e); });
    const move = (e) => {
      if (e.pointerId !== sid) return;
      const dx = Math.max(-1, Math.min(1, (e.clientX - cx) / 55));
      this.touch.steer = -dx; knob.style.transform = `translateX(${dx * 40}px)`;
    };
    stick.addEventListener('pointermove', move);
    const end = (e) => { if (e.pointerId === sid) { sid = null; this.touch.steer = 0; knob.style.transform = ''; } };
    stick.addEventListener('pointerup', end); stick.addEventListener('pointercancel', end);
    const pedal = (id, fn) => {
      const el = root.querySelector(id);
      el.addEventListener('pointerdown', (e) => { el.setPointerCapture(e.pointerId); el.classList.add('on'); fn(true, e, el); });
      el.addEventListener('pointermove', (e) => { if (el.classList.contains('on')) fn(true, e, el); });
      const off = () => { el.classList.remove('on'); fn(false); };
      el.addEventListener('pointerup', off); el.addEventListener('pointercancel', off);
    };
    // throttle pedal is analogue: press higher = more throttle
    pedal('#tc-gas', (on, e, el) => {
      if (!on) { this.touch.throttle = 0; return; }
      const r = el.getBoundingClientRect();
      this.touch.throttle = Math.max(0.25, Math.min(1, 1 - (e.clientY - r.top) / r.height + 0.2));
    });
    pedal('#tc-rev', (on) => { this.touch.throttle = on ? -0.7 : 0; });
    pedal('#tc-brake', (on) => { this.touch.brake = on; });
  }
}
