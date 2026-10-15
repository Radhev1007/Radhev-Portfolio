// Voice chat over LiveKit, one voice room per multiplayer room. Audio never goes through the game server:
// the game server only mints a short-lived token (the API secret stays there), and LiveKit carries the audio
// over WebRTC. Voice is optional and independent: it can fail, reconnect or be switched off without touching
// driving. Nothing is recorded or stored.
//
// Microphone modes: 'muted' (listening only), 'open' (toggle on), 'ptt' (live only while the push-to-talk key
// or on-screen button is held). The microphone permission is requested the first time the mic goes live.
const PTT_KEY = 'rccrawler.voice.v1';

let lkLoad = null;
const loadLiveKit = () => (lkLoad ||= import(new URL('../../vendor/net/livekit-client.mjs', import.meta.url).href).catch((e) => { lkLoad = null; throw e; }));

export class Voice {
  constructor(mp) {
    this.mp = mp;
    this.lk = null; this.room = null;
    this.status = 'off';             // off | connecting | on | reconnecting | error
    this.error = '';
    this.micMode = 'muted';          // muted | open | ptt
    this.micLive = false;            // our microphone is actually publishing unmuted audio right now
    this.pttDown = false;
    this.speakerMuted = false;
    this.speaking = new Set();       // identities (session ids) currently speaking, ours included
    this.perPlayer = {};             // sid -> { muted, volume 0..1 }
    this.needsGesture = false;       // browser blocked autoplay until the next click
    this.listeners = {};
    try { const s = JSON.parse(localStorage.getItem(PTT_KEY) || '{}'); this.pttKey = s.pttKey || 't'; this.perPlayerVol = s.vol || {}; } catch { this.pttKey = 't'; this.perPlayerVol = {}; }
    this.audioBox = document.createElement('div'); this.audioBox.hidden = true; document.body.appendChild(this.audioBox);
    mp.on('voiceToken', (m) => this._tokenReply?.(m));
    addEventListener('keydown', (e) => { if (this.status === 'on' && this.micMode === 'ptt' && e.key.toLowerCase() === this.pttKey && !e.repeat && !isTyping(e)) this.setPtt(true); });
    addEventListener('keyup', (e) => { if (e.key.toLowerCase() === this.pttKey) this.setPtt(false); });
    addEventListener('blur', () => this.setPtt(false));
  }

  on(ev, fn) { (this.listeners[ev] ||= []).push(fn); }
  emit(ev) { (this.listeners[ev] || []).forEach((f) => f()); }
  set(k, v) { this[k] = v; this.emit('change'); }
  savePrefs() { try { localStorage.setItem(PTT_KEY, JSON.stringify({ pttKey: this.pttKey, vol: this.perPlayerVol })); } catch { /* ignore */ } }

  token() {
    return new Promise((res, rej) => {
      const t = setTimeout(() => { this._tokenReply = null; rej(new Error('The server did not answer')); }, 6000);
      this._tokenReply = (m) => { clearTimeout(t); this._tokenReply = null; m.error ? rej(new Error(m.error)) : res(m); };
      this.mp.room.send('voiceToken');
    });
  }

  async join() {
    if (!this.mp.room || this.status === 'connecting' || this.status === 'on') return;
    this.error = ''; this.set('status', 'connecting');
    try {
      const [lk, tok] = await Promise.all([loadLiveKit(), this.token()]);
      this.lk = lk;
      const room = new lk.Room({ adaptiveStream: false, dynacast: false, audioCaptureDefaults: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      this.room = room;
      const E = lk.RoomEvent;
      room.on(E.TrackSubscribed, (track, pub, part) => { if (track.kind === 'audio') { const el = track.attach(); this.audioBox.appendChild(el); this.applyVolume(part); } });
      room.on(E.TrackUnsubscribed, (track) => track.detach().forEach((el) => el.remove()));
      room.on(E.ParticipantConnected, (part) => { this.applyVolume(part); this.emit('change'); });
      room.on(E.ParticipantDisconnected, () => this.emit('change'));
      room.on(E.ActiveSpeakersChanged, (sp) => { this.speaking = new Set(sp.map((p) => p.identity)); this.emit('change'); });
      room.on(E.TrackMuted, () => this.emit('change'));
      room.on(E.TrackUnmuted, () => this.emit('change'));
      room.on(E.LocalTrackPublished, () => this.emit('change'));
      room.on(E.AudioPlaybackStatusChanged, () => this.set('needsGesture', !room.canPlaybackAudio));
      room.on(E.MediaDevicesChanged, () => this.onDevicesChanged());
      room.on(E.MediaDevicesError, (e) => this.micError(e));
      room.on(E.Reconnecting, () => this.set('status', 'reconnecting'));
      room.on(E.Reconnected, () => this.set('status', 'on'));
      room.on(E.Disconnected, () => this.onDisconnected());
      await room.connect(tok.url, tok.token, { autoSubscribe: true });
      this.set('status', 'on');
      this.set('needsGesture', !room.canPlaybackAudio);
      for (const p of room.remoteParticipants.values()) this.applyVolume(p);
      if (this.micMode === 'open') await this.setMicLive(true);
      this.report();
    } catch (e) {
      this.cleanup();
      this.error = /token|configured|server/i.test(e.message) ? e.message : 'Could not connect to voice: ' + (e.message || e);
      this.set('status', 'error');
    }
  }

  async leave() {
    this.wantOff = true;
    const r = this.room; this.cleanup();
    if (r) { try { await r.disconnect(); } catch { /* gone */ } }
    this.wantOff = false;
    this.error = ''; this.set('status', 'off');
    this.report();
  }

  cleanup() {
    this.room = null; this.micLive = false; this.speaking.clear();
    this.audioBox.replaceChildren();
  }

  // the voice service dropped us (LiveKit already retried): try again with a fresh token, a few times
  async onDisconnected() {
    if (this.wantOff || !this.room) return;
    this.cleanup(); this.set('status', 'reconnecting');
    for (let i = 0; i < 4 && this.mp.room && this.status === 'reconnecting'; i++) {
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
      this.status = 'off';
      await this.join();
      if (this.status === 'on') return;
      this.status = 'reconnecting';
    }
    if (this.status === 'reconnecting') { this.error = 'Voice disconnected'; this.set('status', 'error'); }
    this.report();
  }

  // ---------- microphone
  async setMicMode(mode) {
    this.micMode = mode;
    if (mode === 'open') await this.setMicLive(true);
    else await this.setMicLive(mode === 'ptt' && this.pttDown);
    this.emit('change');
  }

  async setPtt(down) {
    if (down === this.pttDown) return;
    this.pttDown = down;
    if (this.micMode === 'ptt') await this.setMicLive(down);
  }

  async setMicLive(on) {
    if (!this.room) { this.micLive = false; return; }
    try {
      await this.room.localParticipant.setMicrophoneEnabled(on);
      this.micLive = on && !!this.room.localParticipant.isMicrophoneEnabled;
      if (on) this.error = '';
    } catch (e) { this.micError(e); }
    this.report(); this.emit('change');
  }

  micError(e) {
    const n = e?.name || '';
    this.micLive = false;
    if (this.micMode !== 'muted') this.micMode = 'muted';
    this.error = n === 'NotAllowedError' || n === 'SecurityError' ? 'Microphone permission was denied. Allow it in the browser to talk; you can still listen.'
      : n === 'NotFoundError' || n === 'OverconstrainedError' ? 'No microphone found. You can still listen.'
      : n === 'NotReadableError' ? 'The microphone is busy in another app.'
      : 'Microphone error: ' + (e?.message || n || e);
    this.emit('change'); this.report();
  }

  async onDevicesChanged() {
    // the active microphone was unplugged: switch to the system default if one is left
    if (!this.room || !this.micLive) return this.emit('change');
    try {
      const devs = await navigator.mediaDevices.enumerateDevices();
      if (!devs.some((d) => d.kind === 'audioinput')) return this.micError({ name: 'NotFoundError' });
      await this.room.switchActiveDevice('audioinput', 'default');
    } catch { /* keep whatever LiveKit chose */ }
    this.emit('change');
  }

  // ---------- listening
  setSpeakerMuted(m) { this.speakerMuted = m; if (this.room) for (const p of this.room.remoteParticipants.values()) this.applyVolume(p); this.emit('change'); }
  setPlayerVolume(sid, v) { this.perPlayerVol[sid] = Math.max(0, Math.min(1, v)); this.savePrefs(); this.applyVolume(this.room?.remoteParticipants.get(sid)); this.emit('change'); }
  togglePlayerMute(sid) { const p = (this.perPlayer[sid] ||= {}); p.muted = !p.muted; this.applyVolume(this.room?.remoteParticipants.get(sid)); this.emit('change'); }
  playerVolume(sid) { return this.perPlayerVol[sid] ?? 1; }
  playerMuted(sid) { return !!this.perPlayer[sid]?.muted; }
  applyVolume(part) {
    if (!part?.setVolume) return;
    const v = this.speakerMuted || this.playerMuted(part.identity) ? 0 : this.playerVolume(part.identity);
    part.setVolume(v);
  }
  async unlockAudio() { try { await this.room?.startAudio(); } catch { /* still blocked */ } this.set('needsGesture', !!this.room && !this.room.canPlaybackAudio); }

  // what the UI shows next to a player: are they in voice, is their mic live, are they speaking
  info(sid) {
    if (!this.room) return null;
    const me = sid === this.mp.room?.sessionId;
    const p = me ? this.room.localParticipant : this.room.remoteParticipants.get(sid);
    if (!p) return { inVoice: false };
    return { inVoice: true, mic: me ? this.micLive : !!p.isMicrophoneEnabled, speaking: this.speaking.has(sid), muted: this.playerMuted(sid), volume: this.playerVolume(sid) };
  }

  report() { this.mp.room?.send('voice', { on: this.status === 'on', mic: this.micLive }); }
}

const isTyping = (e) => /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName || '');
