// Audio worklets for relayed voice (see voiceRelay.js): runs on the browser's audio thread.
//   rc-voice-tx  microphone -> 16 kHz -> IMA ADPCM frames of 40 ms (323 bytes: predictor, step index, 640 nibbles)
//   rc-voice-rx  ADPCM frames -> jitter buffer -> resampled to the output rate
// Each frame carries its own decoder state, so a lost or dropped frame never corrupts the next one.
const RATE = 16000, FRAME = 640;
const STEP = [7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 19, 21, 23, 25, 28, 31, 34, 37, 41, 45, 50, 55, 60, 66, 73, 80, 88, 97, 107, 118, 130, 143, 157, 173, 190, 209, 230, 253, 279, 307, 337, 371, 408, 449, 494, 544, 598, 658, 724, 796, 876, 963, 1060, 1166, 1282, 1411, 1552, 1707, 1878, 2066, 2272, 2499, 2749, 3024, 3327, 3660, 4026, 4428, 4871, 5358, 5894, 6484, 7132, 7845, 8630, 9493, 10442, 11487, 12635, 13899, 15289, 16818, 18500, 20350, 22385, 24623, 27086, 29794, 32767];
const INDEX = [-1, -1, -1, -1, 2, 4, 6, 8, -1, -1, -1, -1, 2, 4, 6, 8];
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

class Tx extends AudioWorkletProcessor {
  constructor() {
    super();
    this.step = sampleRate / RATE;    // input samples per output sample
    this.pos = 0; this.acc = 0; this.n = 0;
    this.pcm = new Int16Array(FRAME); this.len = 0;
    this.pred = 0; this.index = 0;
    this.on = false;
    this.port.onmessage = (e) => { this.on = !!e.data.on; if (!this.on) this.len = 0; };
  }

  encode() {
    const out = new Uint8Array(3 + FRAME / 2);
    out[0] = this.pred & 255; out[1] = (this.pred >> 8) & 255; out[2] = this.index;
    let pred = this.pred, index = this.index, sum = 0;
    for (let i = 0; i < FRAME; i++) {
      const x = this.pcm[i]; sum += x * x;
      let diff = x - pred, code = 0;
      if (diff < 0) { code = 8; diff = -diff; }
      let step = STEP[index], delta = step >> 3;
      if (diff >= step) { code |= 4; diff -= step; delta += step; }
      step >>= 1; if (diff >= step) { code |= 2; diff -= step; delta += step; }
      step >>= 1; if (diff >= step) { code |= 1; delta += step; }
      pred = clamp(code & 8 ? pred - delta : pred + delta, -32768, 32767);
      index = clamp(index + INDEX[code], 0, 88);
      if (i & 1) out[3 + (i >> 1)] |= code << 4; else out[3 + (i >> 1)] = code;
    }
    this.pred = pred; this.index = index;
    this.port.postMessage({ frame: out, level: Math.sqrt(sum / FRAME) / 32768 }, [out.buffer]);
  }

  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch || !this.on) return true;
    for (let i = 0; i < ch.length; i++) {
      // box-filter decimation: average the input samples that fall into each 16 kHz sample
      this.acc += ch[i]; this.n++; this.pos += 1;
      if (this.pos >= this.step) {
        this.pos -= this.step;
        this.pcm[this.len++] = clamp(Math.round((this.acc / this.n) * 32767), -32768, 32767);
        this.acc = 0; this.n = 0;
        if (this.len === FRAME) { this.encode(); this.len = 0; }
      }
    }
    return true;
  }
}

const TARGET = RATE * 0.12, MAX = RATE * 0.5;   // start playing with 120 ms buffered; catch up beyond 500 ms

class Rx extends AudioWorkletProcessor {
  constructor() {
    super();
    this.q = []; this.cur = null; this.off = 0; this.buffered = 0;
    this.playing = false;
    this.step = RATE / sampleRate; this.phase = 0; this.a = 0; this.b = 0;
    this.port.onmessage = (e) => this.push(new Uint8Array(e.data));
  }

  push(f) {
    if (f.length < 3 + FRAME / 2) return;
    const pcm = new Float32Array(FRAME);
    let pred = (f[0] | (f[1] << 8)) << 16 >> 16, index = clamp(f[2], 0, 88);
    for (let i = 0; i < FRAME; i++) {
      const code = i & 1 ? f[3 + (i >> 1)] >> 4 : f[3 + (i >> 1)] & 15;
      const step = STEP[index];
      let delta = step >> 3;
      if (code & 4) delta += step;
      if (code & 2) delta += step >> 1;
      if (code & 1) delta += step >> 2;
      pred = clamp(code & 8 ? pred - delta : pred + delta, -32768, 32767);
      index = clamp(index + INDEX[code], 0, 88);
      pcm[i] = pred / 32768;
    }
    this.q.push(pcm); this.buffered += FRAME;
    while (this.buffered > MAX && this.q.length > 1) { this.buffered -= this.q.shift().length; }   // fell behind: skip ahead
  }

  next() {
    while (!this.cur || this.off >= this.cur.length) {
      if (!this.q.length) return null;
      this.cur = this.q.shift(); this.off = 0;
    }
    this.buffered--;
    return this.cur[this.off++];
  }

  process(_, outputs) {
    const out = outputs[0][0];
    if (!this.playing && this.buffered >= TARGET) this.playing = true;
    for (let i = 0; i < out.length; i++) {
      if (!this.playing) { out[i] = 0; continue; }
      this.phase += this.step;
      while (this.phase >= 1) {
        this.phase -= 1; this.a = this.b;
        const s = this.next();
        if (s === null) { this.playing = false; this.b = 0; break; }   // ran dry: wait for a fresh buffer
        this.b = s;
      }
      out[i] = this.a + (this.b - this.a) * this.phase;
    }
    return true;
  }
}

registerProcessor('rc-voice-tx', Tx);
registerProcessor('rc-voice-rx', Rx);
