'use client';

/**
 * Sound cues.
 *
 * Synthesized with WebAudio rather than shipped as audio files: no assets to
 * load, nothing to fail offline, and a few bytes instead of a few hundred
 * kilobytes. Everything is short, quiet and off by default.
 */

export type CueName = 'pattern' | 'collapse' | 'ghost' | 'trigger' | 'success' | 'error' | 'mail';

type Tone = { freq: number; at: number; dur: number; gain?: number; type?: OscillatorType };

const CUES: Record<CueName, Tone[]> = {
  // Rising major third — "something was understood".
  pattern: [
    { freq: 587.33, at: 0, dur: 0.16 },
    { freq: 880, at: 0.1, dur: 0.22 },
    { freq: 1174.66, at: 0.2, dur: 0.3, gain: 0.5 },
  ],
  // Soft convergence.
  collapse: [
    { freq: 1046.5, at: 0, dur: 0.14, gain: 0.4 },
    { freq: 698.46, at: 0.08, dur: 0.26, gain: 0.55 },
  ],
  // Two quiet violet taps.
  ghost: [
    { freq: 659.25, at: 0, dur: 0.1, gain: 0.35 },
    { freq: 987.77, at: 0.11, dur: 0.18, gain: 0.3 },
  ],
  trigger: [{ freq: 1318.51, at: 0, dur: 0.09, gain: 0.32 }],
  // Resolving perfect fifth.
  success: [
    { freq: 783.99, at: 0, dur: 0.14 },
    { freq: 1174.66, at: 0.09, dur: 0.34, gain: 0.5 },
  ],
  error: [
    { freq: 311.13, at: 0, dur: 0.16, gain: 0.4, type: 'triangle' },
    { freq: 233.08, at: 0.12, dur: 0.26, gain: 0.34, type: 'triangle' },
  ],
  mail: [{ freq: 1046.5, at: 0, dur: 0.07, gain: 0.22 }],
};

let ctx: AudioContext | null = null;

function context(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

export function playCue(name: CueName, masterGain = 0.06) {
  const audio = context();
  if (!audio) return;
  const tones = CUES[name];
  if (!tones) return;

  const now = audio.currentTime;
  for (const tone of tones) {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = tone.type ?? 'sine';
    osc.frequency.value = tone.freq;

    const peak = masterGain * (tone.gain ?? 1);
    const start = now + tone.at;
    // Short attack, exponential tail — no clicks, no ringing.
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + tone.dur);

    osc.connect(gain).connect(audio.destination);
    osc.start(start);
    osc.stop(start + tone.dur + 0.02);
  }
}
