/**
 * The park's sound, synthesised rather than sampled.
 *
 * There are no audio files here and none are downloaded. A brushed RC motor
 * is a whine whose pitch tracks wheel speed, gravel is filtered noise, water
 * is brighter filtered noise, wind is darker filtered noise, and a creaking
 * plank is a short band-passed burst. All of that is a few oscillators and a
 * noise buffer, which costs a couple of kilobytes of code instead of a couple
 * of megabytes of samples — and the motor has to follow the throttle
 * continuously anyway, which a looped sample does badly.
 *
 * Nothing starts until the visitor asks for it: browsers suspend an
 * AudioContext created without a gesture, and a portfolio that makes noise
 * on page load deserves the back button.
 */

type Surface = "dirt" | "rock" | "water";

export type AudioState = {
  speed: number;
  throttle: number;
  grounded: boolean;
  surface: Surface;
  inWater: boolean;
};

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

export class GarageAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;

  private motor?: { osc: OscillatorNode; sub: OscillatorNode; filter: BiquadFilterNode; gain: GainNode };
  private roll?: { src: AudioBufferSourceNode; filter: BiquadFilterNode; gain: GainNode };
  private water?: { src: AudioBufferSourceNode; filter: BiquadFilterNode; gain: GainNode };
  private wind?: { src: AudioBufferSourceNode; filter: BiquadFilterNode; gain: GainNode };

  private lastThud = 0;
  private wasAirborne = false;

  get running() {
    return this.ctx !== null;
  }

  /** Must be called from a user gesture. */
  async start() {
    if (this.ctx) return;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    if (ctx.state === "suspended") await ctx.resume();
    this.ctx = ctx;

    this.master = ctx.createGain();
    this.master.gain.value = 0.0001;
    this.master.connect(ctx.destination);
    this.master.gain.exponentialRampToValueAtTime(0.5, ctx.currentTime + 1.2);

    // One second of white noise, reused by every noise voice.
    const len = ctx.sampleRate;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.noise = buf;

    this.motor = this.buildMotor(ctx, this.master);
    this.roll = this.buildNoiseVoice(ctx, this.master, "bandpass", 900, 1.1);
    this.water = this.buildNoiseVoice(ctx, this.master, "highpass", 1600, 0.7);
    this.wind = this.buildNoiseVoice(ctx, this.master, "lowpass", 420, 0.6);
    if (this.wind) this.wind.gain.gain.value = 0.05;
  }

  private buildMotor(ctx: AudioContext, out: GainNode) {
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = 60;
    const sub = ctx.createOscillator();
    sub.type = "square";
    sub.frequency.value = 30;
    sub.detune.value = -8;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 700;
    filter.Q.value = 3.5;

    const gain = ctx.createGain();
    gain.gain.value = 0;

    const subGain = ctx.createGain();
    subGain.gain.value = 0.35;

    osc.connect(filter);
    sub.connect(subGain).connect(filter);
    filter.connect(gain).connect(out);
    osc.start();
    sub.start();
    return { osc, sub, filter, gain };
  }

  private buildNoiseVoice(ctx: AudioContext, out: GainNode, type: BiquadFilterType, freq: number, q: number) {
    if (!this.noise) return undefined;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    src.connect(filter).connect(gain).connect(out);
    src.start();
    return { src, filter, gain };
  }

  /** Called every frame while driving. Ramps, never jumps. */
  update(s: AudioState) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const k = 0.08;

    // Motor: pitch follows wheel speed, body follows throttle. It idles
    // audibly because a brushed motor under no load still sings.
    if (this.motor) {
      const rpm = 52 + s.speed * 26 + Math.abs(s.throttle) * 38;
      this.motor.osc.frequency.setTargetAtTime(rpm, t, k);
      this.motor.sub.frequency.setTargetAtTime(rpm * 0.5, t, k);
      this.motor.filter.frequency.setTargetAtTime(520 + s.speed * 190 + Math.abs(s.throttle) * 420, t, k);
      const load = s.grounded ? 1 : 0.45;
      this.motor.gain.gain.setTargetAtTime((0.035 + Math.abs(s.throttle) * 0.16) * load, t, k);
    }

    // Tyres: louder and brighter on rock than on dirt, silent in the air.
    if (this.roll) {
      const base = s.grounded ? clamp(s.speed / 7, 0, 1) : 0;
      const bite = s.surface === "rock" ? 1 : s.surface === "water" ? 0.55 : 0.6;
      this.roll.gain.gain.setTargetAtTime(base * 0.1 * bite, t, k);
      this.roll.filter.frequency.setTargetAtTime(
        (s.surface === "rock" ? 1500 : 820) + s.speed * 95,
        t,
        k,
      );
    }

    if (this.water) {
      this.water.gain.gain.setTargetAtTime(s.inWater ? 0.03 + clamp(s.speed / 6, 0, 1) * 0.14 : 0.004, t, 0.12);
    }

    // A landing gets a thud, rate-limited so a bouncing truck does not machine-gun.
    if (this.wasAirborne && s.grounded && t - this.lastThud > 0.25) {
      this.lastThud = t;
      this.burst(140, 2.2, 0.26, 0.22);
    }
    this.wasAirborne = !s.grounded;
  }

  /** Short filtered noise burst — impacts, creaks, splashes. */
  private burst(freq: number, q: number, gain: number, decay: number) {
    const ctx = this.ctx;
    if (!ctx || !this.noise || !this.master) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + decay + 0.02);
  }

  /** Timber taking weight. */
  creak() {
    this.burst(320 + Math.random() * 260, 7, 0.09, 0.42);
  }

  /** Entering water. */
  splash() {
    this.burst(2200, 0.8, 0.2, 0.3);
  }

  setMuted(muted: boolean) {
    if (!this.ctx || !this.master) return;
    this.master.gain.setTargetAtTime(muted ? 0.0001 : 0.5, this.ctx.currentTime, 0.08);
  }

  dispose() {
    this.ctx?.close();
    this.ctx = null;
    this.master = null;
  }
}


/**
 * One instance for the scene. Components that make a noise — a plank taking
 * weight, a wheel entering water — reach for this rather than having a
 * callback threaded down to them through three layers of props.
 */
export const garageAudio = new GarageAudio();
