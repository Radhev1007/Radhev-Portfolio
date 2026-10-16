// Relayed voice: part of direct voice (p2pVoice.js). When two players' browsers cannot reach each other (strict
// NATs, mobile carriers, no TURN server), their audio goes through the game server instead, over the connection
// the game already has. The microphone is compressed on the audio thread (voiceWorklet.js: 16 kHz ADPCM, 40 ms
// frames, ~64 kbps while talking, nothing while silent) and played back through a small jitter buffer.
const WORKLET = new URL('./voiceWorklet.js', import.meta.url).href;
const GATE = 0.004;     // frame level below which the microphone counts as silent
const HANG = 400;       // ms to keep sending after the last sound, so word endings aren't clipped

export class VoiceRelay {
  constructor(mp, audioCtx) {
    this.mp = mp;
    this.audioCtx = audioCtx;   // () => the shared AudioContext
    this.loading = null;
    this.tx = null; this.src = null; this.mic = null;
    this.on = false; this.mask = 0; this.seq = 0; this.lastLoud = 0;
    this.rx = new Map();        // sid -> { node, gain, analyser, dest, at }
    this.volumes = new Map();
  }

  load() {
    const ctx = this.audioCtx();
    return (this.loading ||= ctx.audioWorklet.addModule(WORKLET));
  }

  // ---------- sending: mask = bit per player slot that should get our audio through the server
  async setSending(on, mask, mic) {
    this.on = on && !!mask && !!mic; this.mask = mask;
    if (this.on) {
      await this.load();
      if (mic !== this.mic) this.attachMic(mic);
    }
    this.tx?.port.postMessage({ on: this.on });
  }

  attachMic(mic) {
    const ctx = this.audioCtx();
    try { this.src?.disconnect(); } catch { /* gone */ }
    this.mic = mic; this.src = null;
    if (!mic) return;
    if (!this.tx) {
      this.tx = new AudioWorkletNode(ctx, 'rc-voice-tx', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1] });
      this.tx.port.onmessage = (e) => this.send(e.data);
      // the node has to reach the output to be processed; it outputs silence
      const sink = ctx.createGain(); sink.gain.value = 0;
      this.tx.connect(sink).connect(ctx.destination);
    }
    this.src = ctx.createMediaStreamSource(new MediaStream([mic]));
    this.src.connect(this.tx);
  }

  send({ frame, level }) {
    const now = performance.now();
    if (level > GATE) this.lastLoud = now;
    if (!this.on || !this.mask || now - this.lastLoud > HANG || !this.mp.room) return;
    const out = new Uint8Array(6 + frame.length);
    out[0] = this.mask & 255; out[1] = (this.mask >>> 8) & 255; out[2] = (this.mask >>> 16) & 255; out[3] = (this.mask >>> 24) & 255;
    out[4] = this.seq & 255; out[5] = (this.seq >> 8) & 255; this.seq = (this.seq + 1) & 0xffff;
    out.set(frame, 6);
    this.mp.room.sendBytes('va', out);
  }

  // ---------- receiving: [sender slot u8][seq u16][frame]
  async receive(bytes, sid) {
    if (!sid || bytes.length < 10) return;
    let r = this.rx.get(sid);
    if (!r) {
      await this.load();
      if (this.rx.has(sid)) r = this.rx.get(sid);
      else {
        const ctx = this.audioCtx();
        const node = new AudioWorkletNode(ctx, 'rc-voice-rx', { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [1] });
        const gain = ctx.createGain(), analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        node.connect(analyser); node.connect(gain).connect(ctx.destination);
        r = { node, gain, analyser, dest: null, at: 0 };
        this.rx.set(sid, r);
        this.applyVolume(sid);
      }
    }
    r.at = performance.now();
    const frame = bytes.slice(3);   // a copy: the worklet takes ownership of it
    r.node.port.postMessage(frame.buffer, [frame.buffer]);
  }

  // heard from this player through the server in the last second
  active(sid) { const r = this.rx.get(sid); return !!r && performance.now() - r.at < 1000; }
  analyser(sid) { return this.rx.get(sid)?.analyser || null; }

  setVolume(sid, v) { this.volumes.set(sid, v); this.applyVolume(sid); }
  applyVolume(sid) {
    const r = this.rx.get(sid);
    if (r) r.gain.gain.value = Math.max(0, Math.min(1, this.volumes.get(sid) ?? 1));
  }

  // the received audio as a stream (tests measure it the same way as a direct connection's track)
  stream(sid) {
    const r = this.rx.get(sid);
    if (!r) return null;
    if (!r.dest) { r.dest = this.audioCtx().createMediaStreamDestination(); r.node.connect(r.dest); }
    return r.dest.stream;
  }

  close(sid) {
    const r = this.rx.get(sid);
    if (!r) return;
    try { r.node.disconnect(); r.gain.disconnect(); r.node.port.close(); } catch { /* gone */ }
    this.rx.delete(sid);
  }

  stop() {
    for (const sid of [...this.rx.keys()]) this.close(sid);
    this.on = false;
    try { this.src?.disconnect(); this.tx?.disconnect(); this.tx?.port.close(); } catch { /* gone */ }
    this.tx = null; this.src = null; this.mic = null;
  }
}
