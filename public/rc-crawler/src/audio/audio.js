// Procedural audio engine for the RC rock-crawler game.
// Everything is synthesized with the Web Audio API — no asset files, no deps.
//
// Graph:
//   sfxBus ─┐
//   ambBus ─┼─> preLP (gentle lowpass) -> compressor -> master -> destination
//   echo   ─┘        (birds / impacts send to a small feedback-delay "echo")
//
// All public methods are no-ops before start() and never throw.

const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const num = (v, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const lerp = (a, b, t) => a + (b - a) * t;
const glerp = (a, b, t) => a * Math.pow(b / a, t); // geometric lerp (frequencies)

const MAX_VOICES = 48; // cap on simultaneously living one-shot voices

// ---------------------------------------------------------------- surfaces
const SURF = {
  rock:   { f: 2600, q: 0.9, lvl: 0.10, low: 0.05, lowF: 300, grain: 34, gF: [1800, 4200], gQ: [2, 5], gLvl: 0.055, gDur: [0.004, 0.012], scrubF: 1400 },
  gravel: { f: 3200, q: 0.7, lvl: 0.20, low: 0.06, lowF: 400, grain: 40, gF: [2500, 6000], gQ: [1, 3], gLvl: 0.028, gDur: [0.003, 0.008], scrubF: 1800 },
  dirt:   { f: 1300, q: 0.6, lvl: 0.20, low: 0.12, lowF: 350, grain: 12, gF: [700, 1600], gQ: [1, 2], gLvl: 0.032, gDur: [0.006, 0.018], scrubF: 1000 },
  sand:   { f: 5200, q: 0.4, lvl: 0.15, low: 0.05, lowF: 300, grain: 0, scrubF: 3200 },
  mud:    { f: 600, q: 1.1, lvl: 0.11, low: 0.32, lowF: 220, grain: 0, squelch: 2.5, scrubF: 500 },
  grass:  { f: 3800, q: 0.5, lvl: 0.12, low: 0.04, lowF: 300, grain: 4, gF: [3000, 5000], gQ: [0.7, 1.2], gLvl: 0.012, gDur: [0.03, 0.07], scrubF: 2400 },
  water:  { f: 1900, q: 0.6, lvl: 0.16, low: 0.18, lowF: 280, grain: 0, splash: 5, scrubF: 1200 },
};

// ---------------------------------------------------------------- impact materials
// knock: band of the material's own click; body: low resonance; dull: soft ground (lowpass, no ring);
// debris: what gets thrown about on a hard hit.
const MAT = {
  rock:   { knock: [2200, 3600], kq: 2.5, body: [150, 230], debris: 'pebble' },
  gravel: { knock: [1600, 3000], kq: 1.6, body: [100, 150], debris: 'gravel' },
  wood:   { knock: [420, 780], kq: 7, body: [105, 175], debris: 'bark', hollow: true },
  dirt:   { knock: [500, 950], kq: 1.1, body: [70, 115], debris: 'dirt', dull: true },
  grass:  { knock: [650, 1200], kq: 1, body: [70, 110], debris: 'dirt', dull: true },
  sand:   { knock: [800, 1500], kq: 0.8, body: [60, 100], debris: 'sand', dull: true },
  snow:   { knock: [700, 1300], kq: 0.8, body: [60, 95], debris: 'sand', dull: true },
  mud:    { knock: [280, 560], kq: 2, body: [55, 90], debris: 'mud', dull: true },
};

// ---------------------------------------------------------------- ambience
const BIOMES = {
  canyon: { wind: 0.9,  leaves: 0.08, whistle: 0.6, birds: 0.14, stream: 0,    crickets: 0.10, echo: 0.38, drips: 0.4, species: ['cascade', 'chirp', 'whistle', 'chirp'] },
  forest: { wind: 0.35, leaves: 0.6,  whistle: 0.1, birds: 0.6,  stream: 0,    crickets: 0.10, echo: 0.08, drips: 1.2, species: ['warble', 'trill', 'whistle', 'chirp', 'warble'] },
  mud:    { wind: 0.4,  leaves: 0.35, whistle: 0.1, birds: 0.4,  stream: 0.1,  crickets: 0.15, echo: 0.05, drips: 1.0, species: ['chirp', 'warble', 'trill', 'whistle'] },
  desert: { wind: 0.8,  leaves: 0,    whistle: 0.4, birds: 0.06, stream: 0,    crickets: 0.35, echo: 0.15, drips: 0.2, species: ['dove', 'chirp', 'whistle'] },
  creek:  { wind: 0.3,  leaves: 0.45, whistle: 0.1, birds: 0.55, stream: 1,    crickets: 0.10, echo: 0.08, drips: 1.2, species: ['warble', 'chirp', 'trill', 'whistle'] },
  mixed:  { wind: 0.55, leaves: 0.3,  whistle: 0.3, birds: 0.35, stream: 0.5,  crickets: 0.15, echo: 0.15, drips: 0.8, species: ['chirp', 'warble', 'whistle', 'cascade', 'trill'] },
  menu:   { wind: 0.35, leaves: 0.2,  whistle: 0.1, birds: 0.3,  stream: 0.15, crickets: 0,    echo: 0.10, drips: 0.6, species: ['warble', 'whistle', 'chirp'] },
};
const WEATHER = {
  morning:  { wind: 0.8,  birds: 1.6, crickets: 0.3, drips: 0 },
  golden:   { wind: 0.9,  birds: 0.8, crickets: 2.2, drips: 0 },
  overcast: { wind: 1.25, birds: 0.6, crickets: 0.5, drips: 0 },
  rain:     { wind: 0.9,  birds: 0.3, crickets: 0.2, drips: 1, streamAdd: 0.15 }, // after-rain
};

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this._started = false;
    this._startPromise = null;
    this._volume = 0.8;
    this._muted = false;
    this._envSpec = { biome: 'menu', weather: 'morning' };
    this._env = this._computeEnv(this._envSpec);
    this._voices = 0;
    this._sources = [];
    this._tick = null;
    this._lastTick = 0;
    this._lastUpdate = -1;
    this._lastImpact = {};
    this._birds = [];
    this._lastBird = -1;
    this._crickets = [];
    this._gust = 0.5;
    this._gustTarget = 0.5;
    this._gustNext = 0;
    this._streamNext = 0;
    this._vehicleQuiet = true;
  }

  get started() {
    return this._started;
  }

  // ------------------------------------------------------------ lifecycle
  async start() {
    try {
      if (this._started && this.ctx) {
        if (this.ctx.state === 'suspended') await this.ctx.resume();
        return;
      }
      if (this._startPromise) return await this._startPromise;
      this._startPromise = (async () => {
        const AC = (typeof window !== 'undefined') && (window.AudioContext || window.webkitAudioContext);
        if (!AC) return;
        const ctx = new AC({ latencyHint: 'interactive' });
        this.ctx = ctx;
        this._build();
        this._started = true;
        this._applyMaster(0.01);
        this._applyEnv(0.5);
        this._lastTick = ctx.currentTime;
        this._tick = setInterval(() => this._ambienceTick(), 50);
        if (ctx.state === 'suspended') {
          try { await ctx.resume(); } catch (e) { /* ignore */ }
        }
      })();
      await this._startPromise;
    } catch (e) {
      // never throw
    } finally {
      this._startPromise = null;
    }
  }

  dispose() {
    try {
      if (this._tick) clearInterval(this._tick);
      this._tick = null;
      for (const s of this._sources) { try { s.stop(); } catch (e) { /* */ } try { s.disconnect(); } catch (e) { /* */ } }
      this._sources = [];
      if (this.ctx) { const c = this.ctx; this.ctx = null; c.close().catch(() => {}); }
    } catch (e) { /* */ }
    this.ctx = null;
    this._started = false;
  }

  setMasterVolume(v) {
    try {
      this._volume = clamp(num(v, this._volume));
      this._applyMaster(0.05);
    } catch (e) { /* */ }
  }

  setMuted(m) {
    try {
      this._muted = !!m;
      this._applyMaster(0.05);
    } catch (e) { /* */ }
  }

  setEnvironment(spec) {
    try {
      const biome = spec && BIOMES[spec.biome] ? spec.biome : this._envSpec.biome;
      const weather = spec && WEATHER[spec.weather] ? spec.weather : this._envSpec.weather;
      const changed = biome !== this._envSpec.biome || weather !== this._envSpec.weather;
      this._envSpec = { biome, weather };
      this._env = this._computeEnv(this._envSpec);
      if (this._started && this.ctx) {
        this._applyEnv(1.5);
        if (changed || !this._birds.length) this._makeResidents();
      }
    } catch (e) { /* */ }
  }

  // ------------------------------------------------------------ helpers
  _now() { return this.ctx.currentTime; }

  _set(param, v, tc = 0.05) {
    if (!Number.isFinite(v)) return;
    try {
      const t = this.ctx.currentTime;
      param.cancelScheduledValues(t);
      param.setTargetAtTime(v, t, tc);
    } catch (e) { /* */ }
  }

  _gain(v = 0, dest = null) {
    const g = this.ctx.createGain();
    g.gain.value = v;
    if (dest) g.connect(dest);
    return g;
  }

  _filter(type, freq, q = 0.707, mono = false) {
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    if (mono) { f.channelCount = 1; f.channelCountMode = 'explicit'; }
    return f;
  }

  _loop(buffer) {
    const s = this.ctx.createBufferSource();
    s.buffer = buffer;
    s.loop = true;
    s.start(this.ctx.currentTime, Math.random() * buffer.duration);
    this._sources.push(s);
    return s;
  }

  _osc(type, freq) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    o.start();
    this._sources.push(o);
    return o;
  }

  // registers a one-shot voice: stops `src` (and `extra` sources) at `stopAt`, disconnects all nodes after.
  _voice(src, nodes, stopAt, extra = []) {
    this._voices++;
    let done = false;
    src.onended = () => {
      if (done) return;
      done = true;
      this._voices--;
      for (const n of nodes) { try { n.disconnect(); } catch (e) { /* */ } }
      for (const x of extra) { try { x.disconnect(); } catch (e) { /* */ } }
      try { src.disconnect(); } catch (e) { /* */ }
    };
    try { src.stop(stopAt); } catch (e) { /* */ }
    for (const x of extra) { try { x.stop(stopAt); } catch (e) { /* */ } }
  }

  _canVoice() { return this._voices < MAX_VOICES; }

  // generic filtered noise burst
  _burst({ t, dur, buf = 'white', type = 'bandpass', f = 1000, f1 = 0, q = 1, amp = 0.05, attack = 0.002, pan = 0, dest = null, echo = 0 }) {
    if (!this._canVoice()) return;
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this._buf[buf];
    const fl = this._filter(type, f, q, true);
    if (f1 > 0) fl.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(amp, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(attack + 0.002, dur));
    src.connect(fl).connect(g);
    const nodes = [fl, g];
    if (pan) {
      const p = c.createStereoPanner();
      p.pan.value = clamp(pan, -1, 1);
      g.connect(p).connect(dest || this.sfxBus);
      nodes.push(p);
    } else {
      g.connect(dest || this.sfxBus);
    }
    if (echo > 0) g.connect(this.echoIn);
    src.start(t, Math.random() * (src.buffer.duration - dur - 0.1));
    this._voice(src, nodes, t + dur + 0.05);
  }

  // ------------------------------------------------------------ 3D positioning
  // Distance falloff is inverse with a 4 m reference: the chase camera sits about 4.6 m away, so normal
  // driving plays near full level, a truck tumbling away gets quieter, and pan follows the screen.
  _makePanner() {
    const p = this.ctx.createPanner();
    p.panningModel = 'equalpower';
    p.distanceModel = 'inverse';
    p.refDistance = 4;
    p.rolloffFactor = 1.1;
    p.maxDistance = 80;
    return p;
  }

  _placeAt(node, x, y, z) {
    if (node.positionX) { const t = this.ctx.currentTime; node.positionX.setValueAtTime(x, t); node.positionY.setValueAtTime(y, t); node.positionZ.setValueAtTime(z, t); }
    else if (node.setPosition) node.setPosition(x, y, z);
  }

  // a one-shot's own point in space; freed once its sounds have finished
  _spot(p, life = 2.5) {
    const pn = this._makePanner();
    this._placeAt(pn, num(p && p.x), num(p && p.y), num(p && p.z));
    pn.connect(this.sfxBus);
    setTimeout(() => { try { pn.disconnect(); } catch (e) { /* */ } }, life * 1000);
    return pn;
  }

  // camera as the listener; called every frame with the camera's world position and orientation
  setListener(pos, fwd, up) {
    try {
      if (!this._started || !this.ctx) return;
      const L = this.ctx.listener, t = this.ctx.currentTime;
      if (L.positionX) {
        L.positionX.setValueAtTime(pos.x, t); L.positionY.setValueAtTime(pos.y, t); L.positionZ.setValueAtTime(pos.z, t);
        L.forwardX.setValueAtTime(fwd.x, t); L.forwardY.setValueAtTime(fwd.y, t); L.forwardZ.setValueAtTime(fwd.z, t);
        L.upX.setValueAtTime(up.x, t); L.upY.setValueAtTime(up.y, t); L.upZ.setValueAtTime(up.z, t);
      } else { L.setPosition(pos.x, pos.y, pos.z); L.setOrientation(fwd.x, fwd.y, fwd.z, up.x, up.y, up.z); }
    } catch (e) { /* */ }
  }

  setVehiclePosition(p) { try { if (this._started && this.vehPan) this._placeAt(this.vehPan, p.x, p.y, p.z); } catch (e) { /* */ } }

  // short sine/triangle tone with pitch glide and exp decay
  _tone({ t, dur, type = 'sine', f0 = 440, f1 = 0, amp = 0.05, attack = 0.003, pan = 0, dest = null, echo = 0 }) {
    if (!this._canVoice()) return;
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 > 0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(amp, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(attack + 0.002, dur));
    o.connect(g);
    const nodes = [g];
    let out = g;
    if (pan) {
      const p = c.createStereoPanner();
      p.pan.value = clamp(pan, -1, 1);
      g.connect(p);
      nodes.push(p);
      out = p;
    }
    out.connect(dest || this.sfxBus);
    if (echo > 0) out.connect(this.echoIn);
    o.start(t);
    this._voice(o, nodes, t + dur + 0.05);
  }

  // ------------------------------------------------------------ graph construction
  _build() {
    const c = this.ctx;
    this._buf = this._makeNoise();

    // master chain
    this.master = c.createGain();
    this.master.gain.value = 0;
    this.comp = c.createDynamicsCompressor();
    this.comp.threshold.value = -16;
    this.comp.knee.value = 12;
    this.comp.ratio.value = 5;
    this.comp.attack.value = 0.004;
    this.comp.release.value = 0.25;
    this.preLP = this._filter('lowpass', 10500, 0.5);
    this.preLP.connect(this.comp).connect(this.master).connect(c.destination);

    this.sfxBus = this._gain(1, this.preLP);
    this.ambBus = this._gain(1, this.preLP);
    this.birdBus = this._gain(1, this.ambBus);

    // shared echo (canyon walls / distance)
    this.echoIn = this._gain(0);
    this.echoDelay = c.createDelay(1.0);
    this.echoDelay.delayTime.value = 0.27;
    this.echoLP = this._filter('lowpass', 2400, 0.5);
    this.echoFB = this._gain(0.32);
    this.echoOut = this._gain(0.6, this.ambBus);
    this.echoIn.connect(this.echoDelay);
    this.echoDelay.connect(this.echoLP);
    this.echoLP.connect(this.echoFB).connect(this.echoDelay);
    this.echoLP.connect(this.echoOut);
    this.birdBus.connect(this.echoIn);

    // vehicle sounds (engine, tyres, servo, scrape) come from one point that follows the truck
    this.vehBus = this._gain(1);
    this.vehPan = this._makePanner();
    this.vehBus.connect(this.vehPan).connect(this.sfxBus);

    this._buildMotor();
    this._buildTires();
    this._buildServo();
    this._buildAmbience();
    this._makeResidents();
  }

  _makeNoise() {
    const c = this.ctx;
    const len = Math.floor(c.sampleRate * 3);
    const mk = (kind) => {
      const b = c.createBuffer(2, len, c.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = b.getChannelData(ch);
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
        for (let i = 0; i < len; i++) {
          const w = Math.random() * 2 - 1;
          if (kind === 'white') d[i] = w * 0.5;
          else if (kind === 'pink') {
            b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759;
            b2 = 0.96900 * b2 + w * 0.1538520; b3 = 0.86650 * b3 + w * 0.3104856;
            b4 = 0.55000 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.0168980;
            d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
            b6 = w * 0.115926;
          } else {
            last = (last + 0.02 * w) / 1.02;
            d[i] = last * 3.5;
          }
        }
        // crossfade the loop seam
        const fade = 2048;
        for (let i = 0; i < fade; i++) {
          const k = i / fade;
          d[len - fade + i] = d[len - fade + i] * (1 - k) + d[i] * k;
        }
      }
      return b;
    };
    return { white: mk('white'), pink: mk('pink'), brown: mk('brown') };
  }

  // Engine: a synthesised 3.6L V6 (Wrangler JL), not the RC's electric motor.
  // A V6 four-stroke fires 3 times per crank revolution, so the core voice is
  // a pulse train at rpm/20 Hz: ~38 Hz at idle, ~290 Hz near redline. Around
  // it: a half-order exhaust burble, combustion noise gated by each firing,
  // and soft saturation that grows with throttle and load.
  _buildMotor() {
    const c = this.ctx;
    this.mOut = this._gain(0, this.vehBus);

    // exhaust: low-passed, opens up with revs and throttle
    this.eLP = this._filter('lowpass', 500, 0.6);
    this.eShape = c.createWaveShaper();
    this.eShape.curve = this._satCurve(1.3);
    this.eShape.oversample = '2x';
    this.eDrive = this._gain(1);
    this.eDrive.connect(this.eShape).connect(this.eLP).connect(this.mOut);
    // a little body resonance around 120 Hz (exhaust pipe / cabin)
    this.eBody = this._filter('peaking', 120, 1.2);
    this.eBody.gain.value = 6;
    this.eLP.disconnect();
    this.eLP.connect(this.eBody).connect(this.mOut);

    // firing pulses: harmonic-rich, falling off like a real exhaust note
    // Overtones fall away steeply: a bright, flat series is what made the
    // first version read as an electronic buzz.
    const N = 12, re = new Float32Array(N + 1), im = new Float32Array(N + 1);
    for (let n = 1; n <= N; n++) im[n] = (n % 2 ? 1 : 0.7) / Math.pow(n, 1.5);
    this.eWave = c.createPeriodicWave(re, im);
    this.eFire = this._osc('sine', 38);
    this.eFire.setPeriodicWave(this.eWave);
    this.eFireG = this._gain(0.55, this.eDrive);
    this.eFire.connect(this.eFireG);

    // half-order burble: the slight unevenness that makes it sound like an engine
    this.eHalf = this._osc('triangle', 19);
    this.eHalfG = this._gain(0.25, this.eDrive);
    this.eHalf.connect(this.eHalfG);
    // crank-order sub rumble
    this.eSub = this._osc('sine', 13);
    this.eSubG = this._gain(0.35, this.eDrive);
    this.eSub.connect(this.eSubG);

    // combustion noise, amplitude-gated by the firing pulse
    this.vWhite = this._loop(this._buf.white);
    this.vBrown = this._loop(this._buf.brown);
    this.eNoiseBP = this._filter('bandpass', 320, 0.55, true);
    this.mBrushG = this._gain(0); // engine noise level (name kept for the watchdog)
    this.eGate = this._gain(0.5);
    this.vBrown.connect(this.eNoiseBP).connect(this.eGate).connect(this.mBrushG).connect(this.eDrive);
    this.eGateDepth = this._gain(0.7);
    this.eFire.connect(this.eGateDepth).connect(this.eGate.gain);

    // slow idle lope so the note never sits perfectly still
    this.eLope = this._osc('sine', 1.7);
    this.eLopeDepth = this._gain(0.6);
    this.eLope.connect(this.eLopeDepth).connect(this.eFire.frequency);
    // random cycle-to-cycle wander: no real engine fires perfectly evenly
    this.eJitSrc = this._loop(this._buf.brown);
    this.eJitLP = this._filter('lowpass', 9, 0.5, true);
    this.eJitDepth = this._gain(1);
    this.eJitSrc.connect(this.eJitLP).connect(this.eJitDepth).connect(this.eFire.frequency);
  }

  _satCurve(k) {
    const n = 1024, curve = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; curve[i] = Math.tanh(k * x) / Math.tanh(k); }
    return curve;
  }

  _buildTires() {
    this.tBP = this._filter('bandpass', 2000, 0.7, true);
    this.tG = this._gain(0, this.vehBus);
    this.vWhite.connect(this.tBP).connect(this.tG);

    this.tLP = this._filter('lowpass', 300, 0.8, true);
    this.tLowG = this._gain(0, this.vehBus);
    this.vBrown.connect(this.tLP).connect(this.tLowG);

    this.sBP = this._filter('bandpass', 1200, 0.9, true);
    this.sLP = this._filter('lowpass', 4000, 0.5, true);
    this.sG = this._gain(0, this.vehBus);
    this.vWhite.connect(this.sBP).connect(this.sLP).connect(this.sG);

    // body scrape: chassis/roof sliding on the ground (rollovers, high-centring). Its level and colour
    // follow the actual sliding speed and material of the body contacts.
    this.scrBP = this._filter('bandpass', 1400, 1.4, true);
    this.scrLP = this._filter('lowpass', 3500, 0.6, true);
    this.scrG = this._gain(0, this.vehBus);
    this.scrSrc = this._loop(this._buf.white);
    this.scrSrc.connect(this.scrBP).connect(this.scrLP).connect(this.scrG);
    this.scrLowG = this._gain(0, this.vehBus);
    this.scrLowLP = this._filter('lowpass', 260, 0.7, true);
    this.vBrown.connect(this.scrLowLP).connect(this.scrLowG);

    // tyre skid: sideways slide. On hard ground a soft rubber chirp, on loose ground a spray hiss.
    this.skBP = this._filter('bandpass', 900, 3, true);
    this.skG = this._gain(0, this.vehBus);
    this.vWhite.connect(this.skBP).connect(this.skG);
  }

  _buildServo() {
    this.svOsc = this._osc('sawtooth', 1500);
    this.svOsc2 = this._osc('square', 1500 * 0.5);
    this.svBP = this._filter('bandpass', 1600, 3);
    this.svLP = this._filter('lowpass', 2600, 0.5);
    this.svG = this._gain(0, this.vehBus);
    this.svOsc.connect(this.svBP);
    this.svOsc2.connect(this._gain(0.3, this.svBP));
    this.svBP.connect(this.svLP).connect(this.svG);
  }

  _buildAmbience() {
    const aBrown = this._loop(this._buf.brown);
    const aPink = this._loop(this._buf.pink);
    const aWhite = this._loop(this._buf.white);

    // wind body
    this.wLP = this._filter('lowpass', 400, 0.6);
    this.wG = this._gain(0, this.ambBus);
    aBrown.connect(this.wLP).connect(this.wG);
    // gust whistle (canyon/desert)
    this.whBP = this._filter('bandpass', 800, 2.5);
    this.whG = this._gain(0, this.ambBus);
    aPink.connect(this.whBP).connect(this.whG);
    // leaves rustle
    this.lvBP = this._filter('bandpass', 4200, 0.5);
    this.lvG = this._gain(0, this.ambBus);
    aPink.connect(this.lvBP).connect(this.lvG);

    // stream babble: 3 layers
    this.stG = this._gain(0, this.ambBus);
    this.stLayers = [
      { src: aPink, f: 380, q: 1.4, base: 0.55 },
      { src: aWhite, f: 1100, q: 2.2, base: 0.28 },
      { src: aWhite, f: 2700, q: 3.0, base: 0.14 },
    ].map((L) => {
      const bp = this._filter('bandpass', L.f, L.q);
      const g = this._gain(L.base);
      L.src.connect(bp).connect(g).connect(this.stG);
      return { bp, g, f: L.f, base: L.base, next: 0 };
    });
  }

  _applyMaster(tc) {
    if (!this.ctx || !this.master) return;
    this._set(this.master.gain, this._muted ? 0 : this._volume, tc);
  }

  _computeEnv({ biome, weather }) {
    const b = BIOMES[biome] || BIOMES.menu;
    const w = WEATHER[weather] || WEATHER.morning;
    return {
      wind: clamp(b.wind * w.wind),
      whistle: b.whistle,
      leaves: b.leaves,
      birds: b.birds * w.birds, // events / second
      stream: clamp(b.stream + (w.streamAdd || 0) * (b.stream > 0 || b.leaves > 0.2 ? 1 : 0.3)),
      crickets: clamp(b.crickets * w.crickets),
      drips: w.drips * b.drips,
      echo: b.echo,
      species: b.species,
      biome, weather,
    };
  }

  _applyEnv(tc) {
    if (!this.ctx) return;
    const e = this._env;
    this._set(this.stG.gain, e.stream * 0.11, tc);
    this._set(this.echoIn.gain, e.echo, tc);
    this._set(this.echoDelay.delayTime, e.biome === 'canyon' ? 0.34 : 0.22, tc);
    this._set(this.echoFB.gain, e.biome === 'canyon' ? 0.38 : 0.22, tc);
  }

  _makeResidents() {
    const e = this._env;
    const n = 4 + ((Math.random() * 2) | 0);
    this._birds = [];
    for (let i = 0; i < n; i++) {
      const species = pick(e.species);
      const base = {
        chirp: rand(3000, 4500), whistle: rand(2800, 3700), warble: rand(2500, 3900),
        trill: rand(3600, 5000), cascade: rand(2500, 3200), dove: rand(470, 580),
      }[species];
      this._birds.push({
        species, base,
        pan: rand(-0.9, 0.9),
        amp: rand(0.012, 0.04),
        wave: species === 'dove' ? 'triangle' : (Math.random() < 0.8 ? 'sine' : 'triangle'),
      });
    }
    this._lastBird = -1;
    this._crickets = [0, 1, 2].map(() => ({
      f: rand(4200, 5000), period: rand(0.55, 0.95), pan: rand(-0.8, 0.8),
      amp: rand(0.6, 1), next: 0, singing: Math.random() < 0.6, phaseEnd: 0,
    }));
  }

  // ------------------------------------------------------------ ambience tick (timer, ~20 Hz)
  _ambienceTick() {
    try {
      if (!this.ctx || this.ctx.state !== 'running') return;
      const now = this.ctx.currentTime;
      const dt = clamp(now - this._lastTick, 0, 0.5);
      this._lastTick = now;
      const e = this._env;

      // vehicle watchdog: fade out vehicle beds if update() stopped being called
      if (!this._vehicleQuiet && (this._lastUpdate < 0 || now - this._lastUpdate > 0.25)) {
        this._vehicleQuiet = true;
        for (const g of [this.mOut, this.tG, this.tLowG, this.sG, this.svG, this.mBrushG, this.scrG, this.scrLowG, this.skG]) this._set(g.gain, 0, 0.1);
      }

      // wind gusts
      if (now >= this._gustNext) {
        this._gustTarget = Math.pow(Math.random(), 0.7);
        this._gustNext = now + rand(1.2, 4.5);
      }
      this._gust += (this._gustTarget - this._gust) * clamp(dt * 0.6);
      const gst = this._gust;
      this._set(this.wG.gain, e.wind * (0.45 + 0.55 * gst) * 0.13, 0.4);
      this._set(this.wLP.frequency, 220 + 650 * gst * (0.5 + 0.5 * e.wind), 0.4);
      this._set(this.whG.gain, e.wind * e.whistle * gst * gst * 0.025, 0.5);
      this._set(this.whBP.frequency, 600 + 700 * gst + rand(-40, 40), 0.5);
      this._set(this.lvG.gain, e.leaves * (0.25 + gst * gst) * 0.028, 0.3);

      // stream babble modulation
      if (e.stream > 0.01) {
        for (const L of this.stLayers) {
          if (now >= L.next) {
            L.next = now + rand(0.05, 0.22);
            this._set(L.g.gain, L.base * rand(0.35, 1.4), 0.05);
            this._set(L.bp.frequency, L.f * rand(0.75, 1.35), 0.06);
          }
        }
        // bubbles / plips
        if (Math.random() < e.stream * 7 * dt) {
          const f = rand(350, 1100);
          this._tone({ t: now + rand(0, 0.05), dur: rand(0.03, 0.07), f0: f, f1: f * rand(1.4, 2.2), amp: 0.012 * e.stream, pan: rand(-0.6, 0.6), dest: this.ambBus });
        }
      }

      // birds
      if (e.birds > 0.001 && this._birds.length && Math.random() < e.birds * dt) {
        let i = (this._lastBird >= 0 && Math.random() < 0.55) ? this._lastBird : (Math.random() * this._birds.length) | 0;
        this._lastBird = i;
        this._birdCall(this._birds[i], now + rand(0.02, 0.1));
      }

      // after-rain drips
      if (e.drips > 0.01 && Math.random() < e.drips * 1.3 * dt) this._drip(now + rand(0, 0.05));

      // crickets
      if (e.crickets > 0.02) {
        for (const cr of this._crickets) {
          if (now >= cr.phaseEnd) {
            cr.singing = Math.random() < 0.3 + e.crickets * 0.5;
            cr.phaseEnd = now + (cr.singing ? rand(4, 14) : rand(2, 8));
          }
          if (!cr.singing) continue;
          if (cr.next < now) cr.next = now + rand(0, cr.period);
          while (cr.next < now + 0.12) {
            this._cricketChirp(cr, cr.next, e.crickets);
            cr.next += cr.period * rand(0.97, 1.03);
          }
        }
      }
    } catch (err) { /* */ }
  }

  _birdCall(bird, t) {
    if (!this._canVoice()) return;
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = bird.wave;
    const g = c.createGain();
    g.gain.value = 0;
    const p = c.createStereoPanner();
    p.pan.value = clamp(bird.pan + rand(-0.05, 0.05), -1, 1);
    o.connect(g).connect(p).connect(this.birdBus);
    const F = o.frequency;
    const G = g.gain;
    const amp = bird.amp * rand(0.8, 1.1);
    const B = bird.base * rand(0.97, 1.03);
    let tt = t;
    F.setValueAtTime(B, t);
    G.setValueAtTime(0, t);
    const note = (dur, f0, f1, a, gap) => {
      F.setValueAtTime(f0, tt);
      F.exponentialRampToValueAtTime(Math.max(40, f1), tt + dur);
      G.setValueAtTime(0, tt);
      G.linearRampToValueAtTime(a, tt + Math.min(0.015, dur * 0.25));
      G.linearRampToValueAtTime(a * 0.7, tt + dur * 0.7);
      G.linearRampToValueAtTime(0, tt + dur);
      tt += dur + gap;
    };
    const extra = [];
    switch (bird.species) {
      case 'chirp': {
        const n = 2 + ((Math.random() * 4) | 0);
        for (let i = 0; i < n; i++) note(rand(0.045, 0.075), B * 1.3, B * 0.78, amp, rand(0.05, 0.11));
        break;
      }
      case 'whistle': {
        note(0.28, B, B * 1.03, amp, 0.07);
        note(0.34, B * 0.84, B * 0.82, amp * 0.9, 0);
        break;
      }
      case 'warble': {
        const n = 6 + ((Math.random() * 5) | 0);
        let f = B;
        for (let i = 0; i < n; i++) {
          const f1 = B * rand(0.8, 1.5);
          note(rand(0.05, 0.09), f, f1, amp * rand(0.6, 1), rand(0.005, 0.03));
          f = B * rand(0.8, 1.5);
        }
        break;
      }
      case 'trill': {
        const dur = rand(0.5, 0.9);
        const lfo = c.createOscillator();
        lfo.frequency.value = rand(18, 30);
        const depth = c.createGain();
        depth.gain.value = B * 0.12;
        lfo.connect(depth).connect(F);
        lfo.start(t);
        extra.push(lfo, depth);
        note(dur, B, B * rand(0.9, 1.08), amp * 0.8, 0);
        break;
      }
      case 'cascade': { // canyon-wren style descending series
        const n = 8 + ((Math.random() * 5) | 0);
        for (let i = 0; i < n; i++) {
          const k = i / (n - 1);
          const f = B * lerp(1.45, 0.6, k);
          note(lerp(0.1, 0.07, k), f * 1.05, f * 0.95, amp * lerp(0.7, 1, Math.sin(k * Math.PI)), lerp(0.07, 0.035, k));
        }
        break;
      }
      case 'dove': {
        const a = amp * 1.3;
        note(0.25, B * 0.95, B, a, 0.08);
        note(0.45, B * 1.08, B * 0.92, a, 0.12);
        note(0.3, B * 0.92, B * 0.9, a * 0.9, 0.12);
        note(0.3, B * 0.92, B * 0.88, a * 0.8, 0);
        break;
      }
      default:
        note(0.08, B, B * 0.8, amp, 0);
    }
    o.start(t);
    const end = tt + 0.05;
    // the trill lfo is stopped with the main osc; its depth gain is disconnected with the voice
    const lfos = extra.filter((x) => typeof x.stop === 'function');
    const others = extra.filter((x) => typeof x.stop !== 'function');
    this._voice(o, [g, p, ...others], end, lfos);
  }

  _drip(t) {
    const pan = rand(-0.9, 0.9);
    if (Math.random() < 0.75) {
      const f = rand(1000, 2600);
      this._tone({ t, dur: rand(0.04, 0.07), f0: f, f1: f * rand(1.5, 2.1), amp: rand(0.008, 0.026), pan, dest: this.ambBus });
    } else { // drip on a leaf / puddle
      this._burst({ t, dur: 0.03, f: rand(2500, 4500), q: 2, amp: rand(0.008, 0.018), pan, dest: this.ambBus });
      this._tone({ t: t + 0.005, dur: 0.09, f0: rand(500, 800), f1: rand(900, 1300), amp: 0.01, pan, dest: this.ambBus });
    }
  }

  _cricketChirp(cr, t, level) {
    if (!this._canVoice()) return;
    const c = this.ctx;
    const o = c.createOscillator();
    o.frequency.value = cr.f;
    const g = c.createGain();
    g.gain.value = 0;
    const p = c.createStereoPanner();
    p.pan.value = cr.pan;
    o.connect(g).connect(p).connect(this.ambBus);
    const a = 0.006 * cr.amp * level;
    let tt = t;
    for (let i = 0; i < 3; i++) {
      g.gain.setValueAtTime(0, tt);
      g.gain.linearRampToValueAtTime(a, tt + 0.006);
      g.gain.linearRampToValueAtTime(0, tt + 0.018);
      tt += 0.032;
    }
    o.start(t);
    this._voice(o, [g, p], tt + 0.02);
  }

  // ------------------------------------------------------------ per-frame vehicle update
  update(p, dt) {
    try {
      if (!this._started || !this.ctx || this.ctx.state !== 'running') return;
      p = p || {};
      dt = clamp(num(dt, 1 / 60), 0, 0.1);
      const now = this.ctx.currentTime;
      this._lastUpdate = now;
      this._vehicleQuiet = false;

      const motor = clamp(num(p.motor));
      const thr = clamp(Math.abs(num(p.throttle)));
      const load = clamp(num(p.load));
      const speed = Math.max(0, num(p.speed));
      const slip = clamp(num(p.slip));
      const water = clamp(num(p.water));
      const susp = clamp(num(p.suspension));
      const steer = Math.abs(num(p.steerRate));
      const slide = Math.max(0, num(p.slide));                 // sideways tyre slide, m/s
      const scrapeV = clamp(num(p.scrape));                     // body sliding on the ground, 0..1
      const scrapeM = MAT[p.scrapeMat] ? p.scrapeMat : 'dirt';
      const grounded = clamp(num(p.grounded, 1));
      const surf = SURF[p.surface] || SURF.dirt;
      const s = clamp(speed / 0.4);
      const gnd = 0.25 + 0.75 * grounded;

      // ---- engine (V6). `rpm` is the drivetrain's position within the
      // current gear range; idle 800, redline ~5800.
      const rpmN = clamp(num(p.rpm, motor));
      let rpm = 800 + 5000 * Math.pow(rpmN, 0.85);
      // throttle revs the engine a little ahead of the wheels; a stall against a
      // rock bogs it down to a heavy, low-rpm labour
      rpm += 900 * thr * (1 - rpmN);
      const bog = thr > 0.15 && rpmN < 0.05;
      if (bog) rpm = 1300 + 300 * load;
      const fire = rpm / 20;
      const ftc = 0.06;
      this._set(this.eFire.frequency, fire, ftc);
      this._set(this.eHalf.frequency, fire / 2, ftc);
      this._set(this.eSub.frequency, fire / 3, ftc);
      this._set(this.eLopeDepth.gain, fire * 0.02 * (1 - rpmN), 0.2);
      this._set(this.eJitDepth.gain, fire * 0.05, 0.2);
      const push = clamp(0.25 + 0.75 * thr + 0.5 * load);
      // exhaust opens with revs and throttle, but stays dark enough not to buzz
      this._set(this.eLP.frequency, 260 + 700 * rpmN + 450 * push, 0.08);
      this._set(this.eDrive.gain, 0.5 + 0.45 * push, 0.08);       // light growl, never a square wave
      this._set(this.eHalfG.gain, 0.18 + 0.2 * (1 - rpmN), 0.1);
      this._set(this.eSubG.gain, 0.3 + 0.25 * load, 0.1);
      this._set(this.eNoiseBP.frequency, 240 + 700 * rpmN, ftc);
      this._set(this.mBrushG.gain, 0.22 + 0.4 * push, 0.08);
      // about half the first version's level (−6 dB), quieter still at idle
      const vol = (bog ? 0.8 : 0.3 + 0.4 * rpmN + 0.3 * thr) * 0.06;
      this._set(this.mOut.gain, vol, 0.06);

      // ---- tire rolling (blend toward water when submerged)
      const w = clamp(water * 1.5);
      const W = SURF.water;
      const tf = glerp(surf.f, W.f, w);
      const tlvl = lerp(surf.lvl, W.lvl, w);
      const tlow = lerp(surf.low, W.low, w);
      const tlowF = lerp(surf.lowF, W.lowF, w);
      const rough = rand(0.75, 1.25);
      const roll = Math.pow(s, 0.8) * gnd;
      this._set(this.tBP.frequency, tf * rand(0.9, 1.1), 0.08);
      this._set(this.tBP.Q, lerp(surf.q, W.q, w), 0.1);
      this._set(this.tG.gain, roll * tlvl * rough * 0.55, 0.04);
      this._set(this.tLP.frequency, tlowF * rand(0.85, 1.2), 0.08);
      this._set(this.tLowG.gain, (roll + w * 0.25 * clamp(motor * 4)) * tlow * rough * 0.6, 0.05);

      // ---- scrub (wheel slip), low/mid and soft — no screech
      const scrub = Math.pow(slip, 1.2) * (0.2 + 0.8 * clamp(motor * 1.5)) * gnd;
      this._set(this.sBP.frequency, glerp(surf.scrubF, W.scrubF, w) * rand(0.8, 1.2), 0.05);
      this._set(this.sG.gain, scrub * 0.06 * rand(0.7, 1.2), 0.04);

      // ---- tyre skid (sideways slide). Hard ground: a soft rubber chirp; loose ground: spray hiss.
      const hard = p.surface === 'rock' || p.surface === 'wood';
      const sk = clamp((slide - 0.25) / 1.5) * gnd * (1 - w);
      this._set(this.skBP.frequency, (hard ? 950 : 2600) * rand(0.9, 1.1), 0.05);
      this._set(this.skBP.Q, hard ? 3.5 : 0.7, 0.1);
      this._set(this.skG.gain, sk * (hard ? 0.05 : 0.07) * rand(0.8, 1.15), 0.04);

      // ---- body scrape: follows the real sliding speed of body contacts, coloured by material, with a
      // stick-slip flutter (plastic and steel catching and releasing on rock)
      const scr = scrapeV * gnd;
      const sm = MAT[scrapeM];
      const scrF = (sm.dull ? 700 : sm.hollow ? 900 : 1700) * rand(0.75, 1.3);
      this._set(this.scrBP.frequency, scrF, 0.02);
      this._set(this.scrLP.frequency, sm.dull ? 1600 : 4200, 0.1);
      this._set(this.scrG.gain, scr * (sm.dull ? 0.05 : 0.09) * (sm.dull ? 1 : rand(0.35, 1.2)), 0.015);
      this._set(this.scrLowG.gain, scr * 0.12 * rand(0.6, 1.1), 0.03);

      // ---- servo
      if (steer > 0.15) {
        const k = clamp(steer / 4);
        this._set(this.svOsc.frequency, 1250 + 650 * k + rand(-30, 30), 0.03);
        this._set(this.svOsc2.frequency, (1250 + 650 * k) * 0.5, 0.03);
        this._set(this.svG.gain, (0.25 + 0.75 * k) * 0.018, 0.02);
      } else {
        this._set(this.svG.gain, 0, 0.03);
      }

      // ---- grains: rock clicks / gravel crunch / dirt, plus scatter thrown by sliding tyres
      const gRate = (surf.grain * s + surf.grain * 0.8 * clamp(slide / 1.5)) * gnd * (1 - w);
      if (gRate > 0) {
        let n = Math.floor(gRate * dt + Math.random());
        n = Math.min(n, 3);
        for (let i = 0; i < n; i++) {
          this._burst({
            t: now + Math.random() * dt, dur: rand(surf.gDur[0], surf.gDur[1]),
            f: rand(surf.gF[0], surf.gF[1]), q: rand(surf.gQ[0], surf.gQ[1]),
            amp: surf.gLvl * rand(0.4, 1) * (0.5 + 0.5 * s), attack: 0.001,
          });
        }
      }

      // ---- mud squelch
      if (surf.squelch && Math.random() < (surf.squelch * s + 2 * slip * s) * dt * (1 - w * 0.5)) {
        const f0 = rand(250, 450);
        this._burst({ t: now, dur: rand(0.1, 0.24), buf: 'pink', f: f0, f1: f0 * rand(1.8, 2.8), q: rand(4, 8), amp: 0.06 * rand(0.5, 1) * (0.4 + s), attack: 0.02 });
      }

      // ---- water splashes while wading
      const splashRate = (5 * s + 2 * slip * clamp(motor * 3)) * w;
      if (splashRate > 0 && Math.random() < splashRate * dt) {
        this._burst({ t: now, dur: rand(0.05, 0.15), f: rand(1400, 3800), f1: rand(700, 1500), q: rand(0.8, 2), amp: 0.035 * rand(0.5, 1), attack: 0.004 });
        if (Math.random() < 0.4) {
          const bf = rand(500, 1300);
          this._tone({ t: now + rand(0.02, 0.08), dur: rand(0.03, 0.06), f0: bf, f1: bf * rand(1.5, 2.2), amp: 0.012 });
        }
      }

      // ---- suspension creaks and spring ticks (metal coil-over and link noise, not a cartoon boing)
      if (susp > 0.05 && Math.random() < susp * 5 * dt) {
        if (Math.random() < 0.72) this._creak(now, susp);
        else this._springTick(now, susp, this.vehBus);
      }

      // ---- chassis vibration on rough ground: body panels and links ticking against each other
      const vib = susp * clamp(speed / 0.25) * gnd;
      if (vib > 0.08 && Math.random() < vib * 14 * dt) this._rattle(now, 0.25 + 0.5 * vib, 1 + Math.round(2 * vib), 0.08, this.vehBus);
    } catch (e) { /* never throw */ }
  }

  _creak(t, k) {
    if (!this._canVoice()) return;
    const c = this.ctx;
    const dur = rand(0.06, 0.16);
    const o = c.createOscillator();
    o.type = 'sawtooth';
    const f0 = rand(90, 220);
    o.frequency.setValueAtTime(f0, t);
    o.frequency.linearRampToValueAtTime(f0 * rand(0.8, 1.3), t + dur);
    const bp = this._filter('bandpass', rand(1100, 2600), rand(5, 9));
    const g = c.createGain();
    const a = 0.014 * (0.4 + 0.6 * k);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(a, t + dur * 0.3);
    g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(bp).connect(g).connect(this.vehBus || this.sfxBus);
    o.start(t);
    this._voice(o, [bp, g], t + dur + 0.02);
  }

  // metal spring/link tick: two inharmonic partials with a fast decay
  _springTick(t, k, dest) {
    const f = rand(1700, 2600);
    const a = 0.008 + 0.012 * k;
    this._tone({ t, dur: rand(0.03, 0.06), f0: f, amp: a, attack: 0.0006, dest });
    this._tone({ t, dur: rand(0.02, 0.04), f0: f * rand(1.47, 1.61), amp: a * 0.6, attack: 0.0006, dest });
  }

  // a run of small plastic/metal clicks with falling level: loose body panels, light bar, links
  _rattle(t, k, n, span, dest) {
    for (let i = 0; i < n; i++) {
      const tt = t + Math.pow(Math.random(), 0.7) * span;
      const decay = 1 - (tt - t) / (span * 1.2);
      this._burst({ t: tt, dur: rand(0.006, 0.018), f: rand(1500, 4200), q: rand(4, 9), amp: (0.012 + 0.045 * k) * Math.max(0.15, decay) * rand(0.5, 1), attack: 0.0006, dest });
    }
  }

  // ------------------------------------------------------------ one-shots
  impact(strength, kind) {
    try {
      if (!this._started || !this.ctx || this.ctx.state !== 'running') return;
      const s = clamp(num(strength, 0.5));
      if (s < 0.02) return;
      const now = this.ctx.currentTime;
      const k = kind || 'rock';
      const last = this._lastImpact[k];
      if (last && now - last.t < 0.045 && s <= last.s) return;
      this._lastImpact[k] = { t: now, s };
      const t = now + 0.003;
      const echo = this._env.echo > 0.2 ? 1 : 0;

      switch (k) {
        case 'thud': {
          this._tone({ t, dur: 0.14 + 0.1 * s, f0: 95 + 30 * s, f1: 42, amp: 0.25 * s + 0.04, attack: 0.002, echo });
          this._burst({ t, dur: 0.1 + 0.06 * s, buf: 'brown', type: 'lowpass', f: 500, f1: 150, q: 0.8, amp: 0.3 * s + 0.03, attack: 0.002 });
          this._burst({ t: t + 0.004, dur: 0.06, f: rand(600, 900), q: 5, amp: 0.06 * s, attack: 0.001 }); // plastic rattle
          if (s > 0.5) this._burst({ t: t + rand(0.03, 0.06), dur: 0.03, f: rand(1500, 2500), q: 4, amp: 0.03 * s, attack: 0.001 });
          break;
        }
        case 'splash': {
          this._burst({ t, dur: 0.25 + 0.3 * s, f: 900, f1: 2600, q: 0.8, amp: 0.12 * s + 0.02, attack: 0.01 });
          this._burst({ t: t + 0.05, dur: 0.35 + 0.3 * s, type: 'lowpass', f: 3500, f1: 600, q: 0.5, amp: 0.06 * s + 0.01, attack: 0.03 });
          this._burst({ t, dur: 0.15, buf: 'brown', type: 'lowpass', f: 350, q: 0.7, amp: 0.15 * s, attack: 0.005 });
          const drops = 2 + Math.round(5 * s);
          for (let i = 0; i < drops; i++) {
            const bf = rand(700, 2200);
            this._tone({ t: t + rand(0.08, 0.5 + 0.3 * s), dur: rand(0.03, 0.06), f0: bf, f1: bf * rand(1.4, 2.0), amp: rand(0.008, 0.02) * (0.5 + s), pan: rand(-0.5, 0.5) });
          }
          break;
        }
        case 'scrape': {
          const dur = 0.2 + 0.35 * s;
          if (!this._canVoice()) break;
          const c = this.ctx;
          const src = c.createBufferSource();
          src.buffer = this._buf.white;
          const bp = this._filter('bandpass', rand(1200, 1800), 2, true);
          const lp = this._filter('lowpass', 3500, 0.5, true);
          const g = c.createGain();
          const a = 0.07 * s + 0.01;
          g.gain.setValueAtTime(0.0001, t);
          // rough, stuttering envelope (stick-slip of skid plate on rock)
          let tt = t;
          g.gain.linearRampToValueAtTime(a, t + 0.015);
          while (tt < t + dur - 0.03) {
            tt += rand(0.015, 0.04);
            g.gain.linearRampToValueAtTime(a * rand(0.3, 1), tt);
            bp.frequency.setValueAtTime(rand(1000, 2000), tt);
          }
          g.gain.linearRampToValueAtTime(0, t + dur);
          src.connect(bp).connect(lp).connect(g).connect(this.sfxBus);
          src.start(t, Math.random() * 2);
          this._voice(src, [bp, lp, g], t + dur + 0.03);
          this._burst({ t, dur: 0.05, f: 900, q: 6, amp: 0.04 * s, attack: 0.001 });
          break;
        }
        case 'rock':
        default: {
          // sharp plastic / rock knock
          this._burst({ t, dur: 0.03 + 0.03 * s, f: rand(2000, 3200), q: 2.5, amp: 0.12 * s + 0.02, attack: 0.0008, echo });
          this._burst({ t, dur: 0.06 + 0.05 * s, f: rand(700, 1100), q: 9, amp: 0.1 * s + 0.015, attack: 0.001 });
          this._tone({ t, dur: 0.07 + 0.05 * s, f0: 170 + 40 * s, f1: 80, amp: 0.14 * s + 0.02, attack: 0.001 });
          if (s > 0.35) this._burst({ t: t + rand(0.02, 0.05), dur: 0.02, f: rand(3000, 5000), q: 3, amp: 0.03 * s, attack: 0.0008 }); // pebble bounce
          break;
        }
      }
    } catch (e) { /* */ }
  }

  // ------------------------------------------------------------ physics-driven one-shots
  // Takes the frame's physics events (see CrawlerPhysics.events). Contacts from the same collision arrive
  // as many points across several substeps, so hits are merged per material+part first and only the
  // strongest few play; each key then has a short cooldown that a clearly harder hit can override.
  events(list) {
    try {
      if (!this._started || !this.ctx || this.ctx.state !== 'running' || !list || !list.length) return;
      const now = this.ctx.currentTime;
      this._cool = this._cool || {};
      const ok = (key, strength, gap) => {
        const c = this._cool[key];
        if (c && now - c.t < gap && strength < c.s * 1.4) return false;
        this._cool[key] = { t: now, s: strength };
        return true;
      };
      const hits = new Map();
      for (const e of list) {
        if (e.type === 'hit') {
          const key = e.mat + '|' + e.part;
          const h = hits.get(key);
          if (!h) hits.set(key, { ...e, n: 1, imp: num(e.impulse) });
          else { h.n++; h.imp += num(e.impulse); if (e.speed > h.speed) { h.speed = e.speed; h.p = e.p; } }
        } else if (e.type === 'touch') {
          if (ok('touch' + e.wheel, e.speed, 0.08)) this._touch(now, e);
        } else if (e.type === 'release') {
          if (ok('rel' + e.wheel, 1, 0.15)) this._release(now, e);
        } else if (e.type === 'takeoff') {
          if (ok('takeoff', 1, 0.3)) this._takeoff(now, e);
        } else if (e.type === 'land') {
          if (ok('land', e.speed, 0.25)) this._land(now, e);
        }
      }
      [...hits.values()].sort((a, b) => b.speed - a.speed).slice(0, 3).forEach((h) => {
        if (h.speed >= 0.35 && ok('hit|' + h.mat + '|' + h.part, h.speed, 0.07)) this._hit(now, h);
      });
    } catch (e) { /* never throw */ }
  }

  // A collision: a material layer (what was hit) + a truck layer (what part hit it), scaled by closing
  // speed and impulse. Light: a small plastic or metal knock. Heavy: deep thud, crunch, debris and a
  // rattle of loose parts. Every frequency gets a small random pitch, and layer choices vary per hit.
  _hit(now, h) {
    const m = MAT[h.mat] || MAT.dirt;
    const v = num(h.speed);
    const s = clamp((v - 0.3) / 3.7);                      // 0 = brush, 1 = ~4 m/s and up
    const force = clamp(h.imp / 2.5);
    const k = clamp(0.7 * s + 0.3 * force);
    const heavy = k > 0.45;
    const r = rand(0.92, 1.08);                            // per-hit pitch variation
    const t = now + 0.002;
    const dest = this._spot(h.p, 1.5);
    const echo = this._env.echo > 0.2 ? 1 : 0;

    // material: the surface's own click (rock, wood) or a dull push into soft ground
    if (m.dull) this._burst({ t, dur: 0.05 + 0.08 * k, buf: 'brown', type: 'lowpass', f: rand(m.knock[0], m.knock[1]) * r, q: 0.7, amp: 0.05 + 0.2 * k, attack: 0.002, dest });
    else this._burst({ t, dur: 0.025 + 0.04 * k, f: rand(m.knock[0], m.knock[1]) * r, q: m.kq, amp: 0.04 + 0.13 * k, attack: 0.0008, dest, echo });
    if (m.hollow) this._tone({ t, dur: 0.08 + 0.1 * k, f0: rand(m.body[0], m.body[1]) * r, f1: m.body[0] * 0.7 * r, amp: 0.05 + 0.15 * k, attack: 0.001, dest });

    // the truck's part
    switch (h.part) {
      case 'tyre':      // rubber meeting a wall: soft, low, no click
        this._burst({ t, dur: 0.07 + 0.06 * k, buf: 'brown', type: 'lowpass', f: 260 * r, q: 0.8, amp: 0.06 + 0.2 * k, attack: 0.003, dest });
        this._tone({ t, dur: 0.08 + 0.05 * k, f0: 72 * r, f1: 46 * r, amp: 0.05 + 0.14 * k, attack: 0.002, dest });
        break;
      case 'bump':      // suspension bottoming out: metal-on-rubber clunk
        this._tone({ t, dur: 0.05 + 0.04 * k, f0: 230 * r, f1: 170 * r, amp: 0.04 + 0.12 * k, attack: 0.001, dest });
        this._tone({ t, dur: 0.03 + 0.02 * k, f0: 610 * r, amp: 0.02 + 0.06 * k, attack: 0.0008, dest });
        this._tone({ t, dur: 0.1 + 0.06 * k, f0: 95 * r, f1: 55 * r, amp: 0.05 + 0.15 * k, attack: 0.002, dest });
        break;
      case 'skid':      // steel skid plate / diff: metallic knock
        this._tone({ t, dur: 0.04 + 0.05 * k, f0: rand(1700, 2300) * r, amp: 0.02 + 0.06 * k, attack: 0.0006, dest });
        this._tone({ t, dur: 0.03 + 0.04 * k, f0: rand(2600, 3300) * r, amp: 0.012 + 0.04 * k, attack: 0.0006, dest });
        this._tone({ t, dur: 0.07 + 0.06 * k, f0: 150 * r, f1: 85 * r, amp: 0.04 + 0.12 * k, attack: 0.001, dest });
        break;
      case 'roof':      // body shell: hollow, deeper plastic
        this._tone({ t, dur: 0.12 + 0.08 * k, f0: 125 * r, f1: 72 * r, amp: 0.05 + 0.16 * k, attack: 0.002, dest });
        this._burst({ t, dur: 0.04 + 0.03 * k, f: rand(700, 1000) * r, q: 7, amp: 0.03 + 0.08 * k, attack: 0.001, dest });
        break;
      default:          // bumper / body panel: plastic knock
        this._burst({ t, dur: 0.035 + 0.035 * k, f: rand(850, 1500) * r, q: rand(6, 9), amp: 0.03 + 0.1 * k, attack: 0.0008, dest });
        this._tone({ t, dur: 0.06 + 0.05 * k, f0: rand(150, 200) * r, f1: 80 * r, amp: 0.03 + 0.1 * k, attack: 0.001, dest });
    }

    if (heavy) {
      // deep thud, crunch with a stuttering envelope, debris, and loose parts rattling afterwards
      this._tone({ t, dur: 0.18 + 0.15 * k, f0: 78 * r, f1: 36 * r, amp: 0.12 + 0.25 * k, attack: 0.002, dest, echo });
      this._crunch(t, k, m, r, dest);
      this._debris(t + 0.02, k, m.debris, dest);
      this._rattle(t + 0.03, k, 3 + Math.round(8 * k * rand(0.7, 1.2)), 0.12 + 0.25 * k, dest);
    } else if (k > 0.15 && Math.random() < 0.6) {
      this._rattle(t + 0.01, k * 0.6, 1 + Math.round(2 * Math.random()), 0.06, dest);
    }
  }

  // plastic and steel deforming against the surface: a short noise burst with stick-slip flutter
  _crunch(t, k, m, r, dest) {
    if (!this._canVoice()) return;
    const c = this.ctx, dur = 0.08 + 0.17 * k;
    const src = c.createBufferSource();
    src.buffer = this._buf.pink;
    const bp = this._filter('bandpass', (m.dull ? 900 : 1500) * r, 1.2, true);
    const g = c.createGain();
    const a = 0.05 + 0.14 * k;
    g.gain.setValueAtTime(0.0001, t);
    let tt = t;
    g.gain.linearRampToValueAtTime(a, t + 0.004);
    while (tt < t + dur - 0.015) { tt += rand(0.008, 0.025); g.gain.linearRampToValueAtTime(a * rand(0.2, 1) * (1 - (tt - t) / dur), tt); }
    g.gain.linearRampToValueAtTime(0, t + dur);
    src.connect(bp).connect(g).connect(dest || this.sfxBus);
    src.start(t, Math.random() * 2);
    this._voice(src, [bp, g], t + dur + 0.02);
  }

  // what a hard hit throws about: pebbles skittering, dirt pattering, bark cracking, sand hiss, mud
  _debris(t, k, kind, dest) {
    const n = Math.round(2 + 6 * k);
    for (let i = 0; i < n; i++) {
      const tt = t + rand(0.01, 0.12 + 0.3 * k);
      const a = (0.008 + 0.03 * k) * rand(0.4, 1);
      if (kind === 'pebble' || kind === 'gravel') this._burst({ t: tt, dur: rand(0.004, 0.012), f: rand(2500, 5500), q: rand(3, 6), amp: a, attack: 0.0005, dest });
      else if (kind === 'bark') this._burst({ t: tt, dur: rand(0.01, 0.03), f: rand(900, 1800), q: rand(3, 6), amp: a * 0.8, attack: 0.0008, dest });
      else if (kind === 'sand') this._burst({ t: tt, dur: rand(0.04, 0.1), f: rand(4000, 7000), q: 0.6, amp: a * 0.5, attack: 0.01, dest });
      else if (kind === 'mud') { if (i < 2) this._burst({ t: tt, dur: rand(0.08, 0.15), buf: 'pink', f: rand(250, 450), f1: rand(600, 900), q: 5, amp: a * 1.2, attack: 0.015, dest }); }
      else this._burst({ t: tt, dur: rand(0.02, 0.05), buf: 'brown', type: 'lowpass', f: rand(500, 900), q: 0.7, amp: a, attack: 0.002, dest });
    }
  }

  // one tyre meeting the ground after being airborne: a soft rubber thump, a bit of the surface, and on
  // hard touchdowns the suspension compressing
  _touch(now, e) {
    const k = clamp(num(e.speed) / 3);
    if (k < 0.05) return;
    const m = MAT[e.mat] || MAT.dirt;
    const r = rand(0.9, 1.1), t = now + 0.002;
    const dest = this._spot(e.p, 1);
    this._burst({ t, dur: 0.05 + 0.06 * k, buf: 'brown', type: 'lowpass', f: rand(180, 260) * r, q: 0.8, amp: 0.04 + 0.16 * k, attack: 0.003, dest });
    this._tone({ t, dur: 0.06 + 0.05 * k, f0: 66 * r, f1: 44 * r, amp: 0.03 + 0.1 * k, attack: 0.002, dest });
    if (!m.dull) this._burst({ t, dur: 0.015 + 0.02 * k, f: rand(m.knock[0], m.knock[1]) * r * 0.8, q: m.kq, amp: 0.01 + 0.04 * k, attack: 0.0008, dest });
    else this._debris(t + 0.01, k * 0.4, m.debris, dest);
    if (k > 0.4) this._springTick(t + 0.02, k, dest);
  }

  // a tyre leaving the ground: the rubber unsticking and, if the suspension was loaded, the shock
  // topping out against its droop limit
  _release(now, e) {
    const dest = this._spot(e.p, 0.6);
    const t = now + 0.002;
    this._burst({ t, dur: 0.02, f: rand(550, 850), q: 3, amp: 0.008, attack: 0.002, dest });
    if (num(e.c) > 0.05) this._springTick(t + 0.01, clamp(num(e.c) * 4), dest);
  }

  // the whole truck leaving the ground: suspension extending
  _takeoff(now, e) {
    this._creak(now + 0.005, clamp(0.3 + num(e.up) * 0.2));
  }

  // the whole truck landing: the tyres already play their own touchdowns, so this adds the weight. Hard
  // landings get a heavy chassis thump and a rattle of loose parts; scaled by landing speed and airtime.
  _land(now, e) {
    const v = num(e.speed), air = num(e.air);
    const k = clamp((v - 1.2) / 5) * clamp(0.5 + air);
    if (k < 0.05) return;
    const dest = this._spot(e.p, 1.5);
    const r = rand(0.92, 1.08), t = now + 0.004;
    this._tone({ t, dur: 0.2 + 0.2 * k, f0: 62 * r, f1: 34 * r, amp: 0.08 + 0.3 * k, attack: 0.003, dest, echo: this._env.echo > 0.2 ? 1 : 0 });
    this._burst({ t, dur: 0.1 + 0.1 * k, buf: 'brown', type: 'lowpass', f: 320 * r, q: 0.7, amp: 0.06 + 0.22 * k, attack: 0.003, dest });
    if (k > 0.35) this._rattle(t + 0.03, k, 4 + Math.round(9 * k), 0.2 + 0.25 * k, dest);
  }

  uiClick() {
    try {
      if (!this._started || !this.ctx || this.ctx.state !== 'running') return;
      const t = this.ctx.currentTime + 0.002;
      this._tone({ t, dur: 0.035, f0: 1900, f1: 1200, amp: 0.05, attack: 0.001, dest: this.comp });
      this._burst({ t, dur: 0.012, f: 4000, q: 1.5, amp: 0.03, attack: 0.0005, dest: this.comp });
    } catch (e) { /* */ }
  }
}

