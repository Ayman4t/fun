// Web Audio oscillators + a "هيلا هوب" chant. Call initAudio() from a user gesture (the Join click).
let ctx: AudioContext | null = null;
let muted = false;
let ready = false;
let lastChant = 0;

export function initAudio() {
  if (typeof window === "undefined") return;
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx ??= new AC();
    if (ctx.state === "suspended") void ctx.resume();
    ready = true;
  } catch {}
}

export function setMuted(m: boolean) {
  muted = m;
  if (m && typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
}

function sweep(f1: number, f2: number, dur: number, type: OscillatorType, vol: number, delay = 0) {
  if (!ctx || muted) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f1, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(f2, 1), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g);
  g.connect(ctx.destination);
  o.start(t);
  o.stop(t + dur);
}

/** Arcade tap; pitch climbs with the player's taps-per-second. */
export const tapSound = (rate: number) => {
  const r = Math.min(rate, 25);
  sweep(300 + r * 30, 200 + r * 20, 0.07, "square", 0.05);
};

/** Referee whistle on a change of lead. */
export const whistle = () => sweep(2200, 2900, 0.35, "sine", 0.1);

/** Zaghrouda-style trill: a rising carrier with fast vibrato. */
export function zaghrouda() {
  if (!ctx || muted) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  const g = ctx.createGain();
  o.type = "sawtooth";
  o.frequency.setValueAtTime(900, t);
  o.frequency.linearRampToValueAtTime(1250, t + 0.5);
  o.frequency.linearRampToValueAtTime(1100, t + 1.3);
  lfo.frequency.value = 16;
  lfoGain.gain.value = 140;
  lfo.connect(lfoGain);
  lfoGain.connect(o.frequency);
  g.gain.setValueAtTime(0.001, t);
  g.gain.exponentialRampToValueAtTime(0.08, t + 0.1);
  g.gain.exponentialRampToValueAtTime(0.001, t + 1.4);
  o.connect(g);
  g.connect(ctx.destination);
  o.start(t);
  lfo.start(t);
  o.stop(t + 1.4);
  lfo.stop(t + 1.4);
}

/** Round-win jingle. */
export const victory = () => [523, 659, 784, 1047].forEach((f, i) => sweep(f, f * 1.01, 0.3, "triangle", 0.12, i * 0.14));

/**
 * "هيلا هوب" chant. Plays /audio/hela-hop.mp3 if you add one to public/audio/,
 * otherwise falls back to the browser's Arabic speech synthesis.
 */
export function chant() {
  if (!ready || muted || typeof window === "undefined") return;
  const now = Date.now();
  if (now - lastChant < 4000) return;
  lastChant = now;
  const speak = () => {
    if (!("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance("هيلا هوب");
    u.lang = "ar-EG";
    u.rate = 1.15;
    u.pitch = 1.2;
    u.volume = 0.8;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  };
  const a = new Audio("/audio/hela-hop.mp3");
  a.volume = 0.9;
  a.play().catch(speak);
}
