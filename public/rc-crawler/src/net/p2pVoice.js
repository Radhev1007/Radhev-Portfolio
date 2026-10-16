// Direct (peer-to-peer) voice: the fallback when LiveKit is not configured or cannot be reached. Every pair of
// players on direct voice gets its own WebRTC connection; the game server only relays the setup messages
// (offer, answer, ICE candidates), audio goes browser to browser and is never recorded.
//
// Each connection carries one audio transceiver, created up front, so a player can listen without a
// microphone and the microphone can be added or muted later without renegotiating (replaceTrack / enabled).
// The player with the smaller session id always makes the offer, so two players never offer at once.
// Speaking indicators come from a level meter on each incoming stream and on our own microphone.
//
// When two browsers cannot reach each other (strict NATs, some mobile carriers, no TURN relay configured), that
// pair's audio goes through the game server instead (voiceRelay.js), so voice works on any network the game
// itself works on. A pair switches back to the direct route as soon as it connects. Upload grows with each
// direct listener (~24 kbps each); relayed audio is uploaded once.
import { VoiceRelay } from './voiceRelay.js';

const BITRATE = 24000;           // per outgoing stream, bits/s
const SPEAK_LEVEL = 0.018;       // RMS above which someone counts as speaking
const SPEAK_HOLD = 350;          // ms the indicator stays on after the level drops
const RELAY_AFTER = 6000;        // ms a direct connection gets before that pair falls back to the server relay
const MIC_GAIN = 2.5;            // outgoing voice boost, after the browser's echo cancelling and auto gain; a limiter
                                 // after it keeps loud voices from clipping

export class P2PVoice {
  constructor(mp, onChange, ctx = null) {
    this.mp = mp;
    this.onChange = onChange;
    this.ctx = ctx;              // shared, created during the Join tap (see Voice.join)
    this.peers = new Map();      // sid -> { pc, polite, el, stream, src, analyser, pending, state, restarts }
    this.mic = null;             // our MediaStreamTrack once the microphone was granted
    this.micLive = false;
    this.ice = [];
    this.active = false;
    this.speaking = new Set();
    this.lastLoud = new Map();
    this.buf = new Float32Array(1024);
    this.volumes = new Map();    // sid -> effective volume 0..1 (0 = muted)
    this.elBlocked = false;      // an audio element's autoplay was refused until the next click
    this.relay = new VoiceRelay(mp, () => this.audioCtx());
  }

  // autoplay blocked: an element refused to play, or the audio context is still waiting for a click
  get blocked() { return this.elBlocked || this.ctx?.state === 'suspended'; }

  audioCtx() {
    if (!this.ctx) this.ctx = new AudioContext();
    if (!this.ctxWatched) {
      this.ctxWatched = true;
      this.ctx.addEventListener('statechange', () => { this.useBoostWhenReady(); this.onChange(); });
    }
    return this.ctx;
  }

  me() { return this.mp.room?.sessionId; }

  start(ice) {
    this.ice = ice && ice.length ? ice : [{ urls: ['stun:stun.l.google.com:19302'] }];
    this.active = true;
    this.timer = setInterval(() => this.meter(), 100);
    this.sync();
  }

  stop() {
    this.active = false;
    clearInterval(this.timer);
    for (const sid of [...this.peers.keys()]) this.close(sid);
    this.dropMic();
    this.relay.stop();
    this.speaking.clear();
  }

  // who we should be connected to: everyone else on direct voice, connected to the room
  wanted() {
    const out = new Set(), st = this.mp.state, me = this.me();
    if (!st) return out;
    for (const [sid, p] of st.players) if (sid !== me && p.connected && p.voice && p.vmode === 'p2p') out.add(sid);
    return out;
  }

  sync() {
    if (!this.active) return;
    const want = this.wanted(), me = this.me();
    for (const sid of want) if (!this.peers.has(sid) && me < sid) this.call(sid);
    // a call can arrive just before the room state says its caller joined voice: give new peers a moment
    for (const [sid, p] of [...this.peers]) if (!want.has(sid) && performance.now() - p.born > 4000) this.close(sid);
  }

  send(to, kind, extra) { this.mp.room?.send('rtc', { to, kind, ...extra }); }

  peer(sid, offerer) {
    let p = this.peers.get(sid);
    if (p) return p;
    const pc = new RTCPeerConnection({ iceServers: this.ice });
    p = { pc, offerer, pending: [], state: 'connecting', restarts: 0, el: null, born: performance.now() };
    this.peers.set(sid, p);
    pc.onicecandidate = (e) => { if (e.candidate) this.send(sid, 'ice', { cand: e.candidate.toJSON() }); };
    pc.ontrack = (e) => this.attach(sid, p, e.streams[0] || new MediaStream([e.track]));
    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      p.state = s === 'connected' ? 'connected' : s === 'failed' ? 'failed' : s === 'closed' ? 'closed' : 'connecting';
      if (s === 'connected') this.limitBitrate(p);
      // a dropped route: the offering side retries with fresh candidates, twice
      if (s === 'failed' && p.offerer && p.restarts < 2 && this.active) { p.restarts++; this.offer(sid, p, true); }
      this.onChange();
    };
    if (offerer) {
      const tr = pc.addTransceiver('audio', { direction: 'sendrecv' });
      if (this.mic) tr.sender.replaceTrack(this.mic);
    }
    return p;
  }

  async call(sid) { this.offer(sid, this.peer(sid, true), false); }

  async offer(sid, p, restart) {
    try {
      const o = await p.pc.createOffer(restart ? { iceRestart: true } : {});
      await p.pc.setLocalDescription(o);
      this.send(sid, 'offer', { sdp: p.pc.localDescription.sdp });
    } catch (e) { console.warn('[voice] offer failed', e); }
  }

  async signal(m) {
    // the server only relays between two players on direct voice, so an offer is accepted even before our copy
    // of the room state shows the caller in voice
    if (!this.active || !m || !m.from || m.from === this.me()) return;
    try {
      if (m.kind === 'offer') {
        const p = this.peer(m.from, false);
        await p.pc.setRemoteDescription({ type: 'offer', sdp: m.sdp });
        const tr = p.pc.getTransceivers()[0];
        if (tr) { tr.direction = 'sendrecv'; if (this.mic) await tr.sender.replaceTrack(this.mic); }
        await p.pc.setLocalDescription(await p.pc.createAnswer());
        this.send(m.from, 'answer', { sdp: p.pc.localDescription.sdp });
        this.flush(p);
      } else if (m.kind === 'answer') {
        const p = this.peers.get(m.from);
        if (!p || p.pc.signalingState !== 'have-local-offer') return;
        await p.pc.setRemoteDescription({ type: 'answer', sdp: m.sdp });
        this.flush(p);
      } else if (m.kind === 'ice') {
        const p = this.peers.get(m.from);
        if (!p) return;
        if (p.pc.remoteDescription) await p.pc.addIceCandidate(m.cand).catch(() => {});
        else p.pending.push(m.cand);
      }
    } catch (e) { console.warn('[voice] signalling', m.kind, e); }
  }

  flush(p) { for (const c of p.pending.splice(0)) p.pc.addIceCandidate(c).catch(() => {}); }

  async limitBitrate(p) {
    for (const s of p.pc.getSenders()) {
      try { const prm = s.getParameters(); if (!prm.encodings?.length) prm.encodings = [{}]; prm.encodings[0].maxBitrate = BITRATE; await s.setParameters(prm); } catch { /* not supported */ }
    }
  }

  attach(sid, p, stream) {
    if (p.stream === stream) return;
    p.stream = stream;
    if (!p.el) { p.el = new Audio(); p.el.autoplay = true; p.el.playsInline = true; }
    p.el.srcObject = stream;
    this.applyVolume(sid);
    p.el.play().then(() => { this.elBlocked = false; }, () => { this.elBlocked = true; this.onChange(); });
    // level meter for the speaking indicator (the element plays the audio; this only listens)
    try {
      const ctx = this.audioCtx();
      p.src = ctx.createMediaStreamSource(stream);
      p.analyser = ctx.createAnalyser(); p.analyser.fftSize = 1024;
      p.src.connect(p.analyser);
    } catch { /* no Web Audio: no indicator */ }
    this.onChange();
  }

  close(sid) {
    const p = this.peers.get(sid);
    if (!p) return;
    try { p.pc.close(); } catch { /* closed */ }
    if (p.el) { p.el.srcObject = null; p.el.remove?.(); }
    try { p.src?.disconnect(); } catch { /* gone */ }
    this.peers.delete(sid);
    this.relay.close(sid);
    this.speaking.delete(sid);
    if (p.relay) this.updateRelay();
    this.onChange();
  }

  // ---------- server relay for pairs without a direct route
  slot(sid) { return this.mp.state?.players.get(sid)?.slot; }

  updateRelay() {
    let mask = 0;
    for (const [sid, p] of this.peers) { const s = this.slot(sid); if (p.relay && s !== undefined) mask |= 1 << s; }
    this.relay.setSending(this.micLive, mask >>> 0, this.mic).catch((e) => console.warn('[voice] relay', e));
  }

  // audio relayed by the server: [sender slot u8][seq u16][frame]
  relayIn(bytes) {
    if (!this.active || !bytes || !bytes.length) return;
    let from = null;
    for (const [sid, q] of this.mp.state?.players || []) if (q.slot === bytes[0]) { from = sid; break; }
    if (from && from !== this.me()) this.relay.receive(bytes, from).catch((e) => console.warn('[voice] relay', e));
  }

  // ---------- microphone: asked for only when it first goes live
  async setMicLive(on) {
    // going live is a click or key press: create / wake the audio context now, while the browser allows it
    if (on) { try { this.audioCtx().resume().catch(() => {}); } catch { /* no Web Audio */ } }
    if (on && !this.mic) {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      this.rawMic = stream.getAudioTracks()[0];
      this.rawMic.onended = () => { this.dropMic(); this.onChange(); };
      // the boosted track only carries sound while the audio context runs; until it does, send the plain
      // microphone (useBoostWhenReady swaps it in), so a held-back context never means silence
      this.boosted = this.boost(this.rawMic);
      this.mic = this.boosted !== this.rawMic && this.ctx?.state === 'running' ? this.boosted : this.rawMic;
      for (const p of this.peers.values()) { const tr = p.pc.getTransceivers()[0]; if (tr) { if (tr.direction !== 'sendrecv') tr.direction = 'sendrecv'; await tr.sender.replaceTrack(this.mic); } }
      try {
        this.micAnalyser = this.audioCtx().createAnalyser(); this.micAnalyser.fftSize = 1024;
        this.micSrc.connect(this.micAnalyser);
      } catch { /* no indicator for ourselves */ }
    }
    for (const t of new Set([this.mic, this.rawMic, this.boosted])) if (t) t.enabled = on;   // muting keeps the permission and the connection, sends silence
    this.micLive = on && !!this.mic;
    this.updateRelay();
    return this.micLive;
  }

  // microphone -> gain -> limiter -> a new track to send (the raw microphone if Web Audio isn't available)
  boost(raw) {
    try {
      const ctx = this.audioCtx();
      const src = ctx.createMediaStreamSource(new MediaStream([raw]));
      const gain = ctx.createGain(); gain.gain.value = MIC_GAIN;
      const lim = ctx.createDynamicsCompressor();
      lim.threshold.value = -12; lim.knee.value = 6; lim.ratio.value = 12; lim.attack.value = 0.003; lim.release.value = 0.15;
      const dest = ctx.createMediaStreamDestination();
      src.connect(gain).connect(lim).connect(dest);
      this.micSrc = src; this.micChain = [src, gain, lim, dest];
      return dest.stream.getAudioTracks()[0];
    } catch {
      return raw;
    }
  }

  // the audio context started after the microphone went live: switch the sent track to the boosted one
  async useBoostWhenReady() {
    if (this.ctx?.state !== 'running' || !this.boosted || this.mic === this.boosted) return;
    this.mic = this.boosted;
    this.mic.enabled = this.micLive;
    for (const p of this.peers.values()) { const tr = p.pc.getTransceivers()[0]; if (tr) await tr.sender.replaceTrack(this.mic).catch(() => {}); }
    this.updateRelay();
  }

  dropMic() {
    for (const t of new Set([this.mic, this.rawMic, this.boosted])) if (t) t.stop();
    for (const n of this.micChain || []) { try { n.disconnect(); } catch { /* gone */ } }
    this.mic = null; this.rawMic = null; this.boosted = null; this.micChain = null; this.micSrc = null; this.micAnalyser = null;
    this.micLive = false;
  }

  async switchMic() {
    // the microphone went away (unplugged): drop it; the next "live" asks for the current default device
    this.dropMic();
    this.updateRelay();
  }

  // ---------- listening
  setVolume(sid, v) {
    this.volumes.set(sid, v);
    this.applyVolume(sid);
    this.relay.setVolume(sid, v);
  }
  applyVolume(sid) {
    const p = this.peers.get(sid);
    if (!p?.el) return;
    const v = this.volumes.get(sid) ?? 1;
    p.el.volume = Math.max(0, Math.min(1, v));
    p.el.muted = v === 0;
  }
  async unlock() {
    try { await this.ctx?.resume(); } catch { /* ignore */ }
    let ok = true;
    for (const p of this.peers.values()) if (p.el) await p.el.play().catch(() => { ok = false; });
    this.elBlocked = !ok;
  }

  meter() {
    const now = performance.now();
    let changed = false;
    const level = (an) => { an.getFloatTimeDomainData(this.buf); let s = 0; for (let i = 0; i < this.buf.length; i++) s += this.buf[i] * this.buf[i]; return Math.sqrt(s / this.buf.length); };
    const check = (sid, an, live) => {
      const loud = live && an && level(an) > SPEAK_LEVEL;
      if (loud) this.lastLoud.set(sid, now);
      const on = live && now - (this.lastLoud.get(sid) || 0) < SPEAK_HOLD;
      if (on !== this.speaking.has(sid)) { on ? this.speaking.add(sid) : this.speaking.delete(sid); changed = true; }
    };
    // a pair whose direct connection hasn't come up in time uses the server relay until it does
    let relayChanged = false;
    for (const [sid, p] of this.peers) {
      const relay = p.state !== 'connected' && now - p.born > RELAY_AFTER;
      if (relay !== !!p.relay) { p.relay = relay; relayChanged = changed = true; if (!relay) this.relay.close(sid); }
    }
    if (relayChanged) this.updateRelay();
    for (const [sid, p] of this.peers) {
      const viaServer = p.relay || this.relay.active(sid);
      check(sid, viaServer ? this.relay.analyser(sid) : p.analyser, (viaServer || p.state === 'connected') && (this.volumes.get(sid) ?? 1) > 0);
    }
    const me = this.me();
    if (me) check(me, this.micAnalyser, this.micLive);
    if (changed) this.onChange();
  }

  info(sid) {
    if (sid === this.me()) return { inVoice: true, reach: 'connected' };
    const p = this.peers.get(sid);
    if (!p) return { inVoice: false };
    return { inVoice: true, reach: p.relay ? 'relay' : p.state };
  }

  stream(sid) { const p = this.peers.get(sid); return p?.relay ? this.relay.stream(sid) : p?.stream || null; }
}
