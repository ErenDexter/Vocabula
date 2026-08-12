/**
 * Every sound here is synthesised at runtime. No audio files ship with the game,
 * which keeps the bundle asset-free and matches the pencil-and-paper feel.
 * On by default; the player turns it off from the header.
 */

let ctx: AudioContext | null = null;
let enabled = true;

/**
 * Flag only — deliberately does not touch the AudioContext. Since sound is on by
 * default this runs at page load, and constructing a context outside a user
 * gesture leaves it suspended and logs an autoplay warning. The context is built
 * lazily by the first actual sound, which always follows a click or keypress.
 */
export function setEnabled(value: boolean): void {
  enabled = value;
}

export function isEnabled(): boolean {
  return enabled;
}

/** Must be called from a user gesture the first time, or the context stays suspended. */
function ensureContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as any).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function noiseBuffer(audio: AudioContext, seconds: number): AudioBuffer {
  const frames = Math.max(1, Math.floor(audio.sampleRate * seconds));
  const buffer = audio.createBuffer(1, frames, audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function tone(
  audio: AudioContext,
  freq: number,
  start: number,
  duration: number,
  gain: number,
  type: OscillatorType = "sine"
): void {
  const osc = audio.createOscillator();
  const amp = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, audio.currentTime + start);
  amp.gain.setValueAtTime(0, audio.currentTime + start);
  amp.gain.linearRampToValueAtTime(gain, audio.currentTime + start + 0.01);
  amp.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + start + duration);
  osc.connect(amp).connect(audio.destination);
  osc.start(audio.currentTime + start);
  osc.stop(audio.currentTime + start + duration + 0.02);
}

/** Short bandpassed noise burst: a pencil stroke on paper. */
export function scratch(): void {
  const audio = enabled ? ensureContext() : null;
  if (!audio) return;

  const src = audio.createBufferSource();
  src.buffer = noiseBuffer(audio, 0.07);

  const filter = audio.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 1800 + Math.random() * 900;
  filter.Q.value = 1.2;

  const amp = audio.createGain();
  amp.gain.setValueAtTime(0.12, audio.currentTime);
  amp.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.07);

  src.connect(filter).connect(amp).connect(audio.destination);
  src.start();
}

/** Rising three-note flourish on a correct word. */
export function correct(): void {
  const audio = enabled ? ensureContext() : null;
  if (!audio) return;
  tone(audio, 523.25, 0, 0.12, 0.09); // C5
  tone(audio, 659.25, 0.08, 0.12, 0.09); // E5
  tone(audio, 783.99, 0.16, 0.22, 0.1); // G5
}

/** Dull low thud on a wrong word. */
export function wrong(): void {
  const audio = enabled ? ensureContext() : null;
  if (!audio) return;
  tone(audio, 155, 0, 0.18, 0.09, "triangle");
  tone(audio, 116, 0.05, 0.22, 0.07, "triangle");
}

/** Softer tick for undo and reshuffle. */
export function tick(): void {
  const audio = enabled ? ensureContext() : null;
  if (!audio) return;
  tone(audio, 320, 0, 0.05, 0.05, "square");
}
