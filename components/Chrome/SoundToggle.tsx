"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { ease } from "@/lib/motion";

/** Root frequencies of a slow four-chord loop, in Hz (A minor-ish, low register). */
const CHORDS = [
  [110.0, 164.81, 220.0, 329.63], // A2  E3  A3  E4
  [98.0, 146.83, 196.0, 293.66], // G2  D3  G3  D4
  [87.31, 130.81, 174.61, 261.63], // F2  C3  F3  C4
  [82.41, 123.47, 164.81, 246.94], // E2  B2  E3  B3
];

const CHORD_SECONDS = 11;
const MASTER_GAIN = 0.07;

/**
 * Ambient pad generated in the browser — no audio file, so nothing to host
 * and no licence to clear. Four sine voices per chord through a soft lowpass,
 * with a slow LFO breathing on the cutoff and long crossfades between chords.
 *
 * Sound is always off until the visitor asks for it: browsers block unprompted
 * audio, and a portfolio that makes noise on arrival is a portfolio people close.
 * The AudioContext is only constructed inside the click handler, which is the
 * user gesture the autoplay policy requires.
 */
export function SoundToggle({ className = "" }: { className?: string }) {
  const [on, setOn] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const stopRef = useRef<(() => void) | null>(null);

  const teardown = useCallback(() => {
    stopRef.current?.();
    stopRef.current = null;
    const ctx = ctxRef.current;
    const master = masterRef.current;
    if (ctx && master) {
      // Fade out before closing so it never clicks.
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
      master.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.2);
      window.setTimeout(() => {
        ctx.close().catch(() => {});
      }, 1400);
    }
    ctxRef.current = null;
    masterRef.current = null;
  }, []);

  const start = useCallback(() => {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return false;

    const ctx = new Ctor();
    const master = ctx.createGain();
    master.gain.setValueAtTime(0, ctx.currentTime);
    master.gain.linearRampToValueAtTime(MASTER_GAIN, ctx.currentTime + 2.5);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(620, ctx.currentTime);
    filter.Q.value = 0.6;

    // Slow breath on the cutoff, so the pad never sits perfectly still.
    const lfo = ctx.createOscillator();
    const lfoDepth = ctx.createGain();
    lfo.frequency.value = 0.045;
    lfoDepth.gain.value = 180;
    lfo.connect(lfoDepth).connect(filter.frequency);
    lfo.start();

    filter.connect(master).connect(ctx.destination);

    let voices: { osc: OscillatorNode; gain: GainNode }[] = [];

    const playChord = (freqs: number[], at: number) => {
      const next = freqs.map((f, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = f;
        // A few cents of detune per voice keeps it from sounding synthetic.
        osc.detune.value = (i % 2 === 0 ? 1 : -1) * (3 + i * 2);
        gain.gain.setValueAtTime(0, at);
        gain.gain.linearRampToValueAtTime(0.28 / freqs.length + (i === 0 ? 0.06 : 0), at + 4);
        osc.connect(gain).connect(filter);
        osc.start(at);
        return { osc, gain };
      });

      // Fade the previous chord under the new one.
      voices.forEach(({ osc, gain }) => {
        gain.gain.cancelScheduledValues(at);
        gain.gain.setValueAtTime(gain.gain.value, at);
        gain.gain.linearRampToValueAtTime(0, at + 4.5);
        osc.stop(at + 5);
      });
      voices = next;
    };

    let i = 0;
    playChord(CHORDS[0], ctx.currentTime);
    const id = window.setInterval(() => {
      i = (i + 1) % CHORDS.length;
      playChord(CHORDS[i], ctx.currentTime);
    }, CHORD_SECONDS * 1000);

    stopRef.current = () => {
      window.clearInterval(id);
      try {
        lfo.stop();
      } catch {
        /* already stopped */
      }
    };
    ctxRef.current = ctx;
    masterRef.current = master;
    return true;
  }, []);

  const toggle = () => {
    if (on) {
      teardown();
      setOn(false);
    } else if (start()) {
      setOn(true);
    }
  };

  // Never leave an AudioContext running behind a navigation.
  useEffect(() => teardown, [teardown]);

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={on}
      aria-label={on ? "Turn sound off" : "Turn sound on"}
      title={on ? "Sound on" : "Sound off"}
      className={`relative grid size-9 place-items-center overflow-hidden border border-line text-bone transition-colors duration-300 hover:border-bone/40 ${className}`}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.svg
          key={on ? "on" : "off"}
          viewBox="0 0 24 24"
          className="size-[17px]"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.6, opacity: 0 }}
          transition={{ duration: 0.3, ease: ease.outExpo }}
        >
          <path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z" />
          {on ? (
            <>
              <path d="M15.6 9.2a4 4 0 0 1 0 5.6" />
              <path d="M18.2 6.6a7.6 7.6 0 0 1 0 10.8" />
            </>
          ) : (
            <path d="M16.5 10l4 4m0-4l-4 4" />
          )}
        </motion.svg>
      </AnimatePresence>
    </button>
  );
}
