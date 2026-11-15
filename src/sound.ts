/**
 * All sound is synthesised live with Web Audio: no files. Each animal gets a quiet ambient bed and
 * occasional calls; the UI gets soft, slightly 8-bit clicks to match the ASCII look.
 * Browsers only allow audio after a click or key press, so it starts on the first one.
 */
let ctx: AudioContext | null = null;
let master: GainNode;
let bedGain: GainNode;
let bedNodes: AudioNode[] = [];
let timer = 0;
let current = "";
let volume = 0.6;
let enabled = true;
let ambient = true;

const R = (a: number, b: number) => a + Math.random() * (b - a);

function ensure() {
  if (ctx) return ctx;
  ctx = new AudioContext();
  master = ctx.createGain();
  master.gain.value = enabled ? volume : 0;
  // A touch of space on everything.
  const verb = ctx.createConvolver();
  const len = ctx.sampleRate * 1.6;
  const ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  }
  verb.buffer = ir;
  const wet = ctx.createGain();
  wet.gain.value = 0.25;
  master.connect(ctx.destination);
  master.connect(verb).connect(wet).connect(ctx.destination);
  bedGain = ctx.createGain();
  bedGain.gain.value = 0;
  bedGain.connect(master);
  return ctx;
}

let noiseBuf: AudioBuffer | null = null;
function noise(c: AudioContext) {
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    let b = 0;
    for (let i = 0; i < d.length; i++) { b = (b + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = b * 3.5; } // brown-ish
  }
  const s = c.createBufferSource();
  s.buffer = noiseBuf;
  s.loop = true;
  return s;
}
let whiteBuf: AudioBuffer | null = null;
function white(c: AudioContext) {
  if (!whiteBuf) {
    whiteBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = whiteBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const s = c.createBufferSource();
  s.buffer = whiteBuf;
  s.loop = true;
  return s;
}

/** A short enveloped tone. */
function tone(type: OscillatorType, f0: number, f1: number, dur: number, gain: number, at = 0, dest?: AudioNode) {
  const c = ensure();
  const t = c.currentTime + at;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + Math.min(0.012, dur / 4));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(dest || master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

/** A short burst of filtered noise. */
function puff(freq: number, q: number, dur: number, gain: number, at = 0, type: BiquadFilterType = "bandpass") {
  const c = ensure();
  const t = c.currentTime + at;
  const s = white(c);
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(master);
  s.start(t, Math.random());
  s.stop(t + dur + 0.05);
}

// ── ambient beds ──
type Bed = "air" | "water" | "night" | "pond" | "shore" | "none";
function startBed(kind: Bed) {
  const c = ensure();
  for (const n of bedNodes) try { (n as AudioScheduledSourceNode).stop?.(); n.disconnect(); } catch {}
  bedNodes = [];
  if (kind === "none" || !ambient) return;
  const src = noise(c);
  const f = c.createBiquadFilter();
  const lfo = c.createOscillator();
  const lfoG = c.createGain();
  const g = c.createGain();
  if (kind === "water") { f.type = "lowpass"; f.frequency.value = 380; g.gain.value = 0.5; lfo.frequency.value = 0.08; lfoG.gain.value = 120; }
  else if (kind === "air") { f.type = "bandpass"; f.frequency.value = 700; f.Q.value = 0.4; g.gain.value = 0.18; lfo.frequency.value = 0.05; lfoG.gain.value = 300; }
  else if (kind === "night") { f.type = "lowpass"; f.frequency.value = 260; g.gain.value = 0.2; lfo.frequency.value = 0.04; lfoG.gain.value = 60; }
  else if (kind === "pond") { f.type = "lowpass"; f.frequency.value = 500; g.gain.value = 0.22; lfo.frequency.value = 0.06; lfoG.gain.value = 150; }
  else { f.type = "bandpass"; f.frequency.value = 520; f.Q.value = 0.6; g.gain.value = 0.35; lfo.frequency.value = 0.11; lfoG.gain.value = 260; } // shore: waves
  lfo.connect(lfoG).connect(f.frequency);
  src.connect(f).connect(g).connect(bedGain);
  src.start();
  lfo.start();
  bedNodes = [src, lfo, f, g, lfoG];
  bedGain.gain.cancelScheduledValues(c.currentTime);
  bedGain.gain.setTargetAtTime(0.5, c.currentTime, 1.2);
}

// ── calls: one per animal, fired every few seconds ──
const CALLS: Record<string, { bed: Bed; every: [number, number]; call: () => void }> = {
  butterflies: { bed: "air", every: [2, 5], call: () => { for (let i = 0; i < 3; i++) puff(R(1800, 2600), 3, 0.06, 0.05, i * 0.09); } },
  moths: { bed: "night", every: [2, 5], call: () => { for (let i = 0; i < 4; i++) puff(R(900, 1400), 2, 0.07, 0.05, i * 0.12); } },
  swallows: { bed: "air", every: [1.2, 3.5], call: () => { const n = Math.ceil(R(1, 4)); for (let i = 0; i < n; i++) tone("sine", R(3200, 4200), R(2200, 2800), 0.07, 0.05, i * R(0.08, 0.14)); } },
  cranes: { bed: "air", every: [4, 9], call: () => { const f = R(520, 640); tone("sawtooth", f, f * 0.92, 0.32, 0.035); tone("square", f * 1.5, f * 1.4, 0.32, 0.012); tone("sawtooth", f * 1.05, f * 0.95, 0.26, 0.03, 0.42); } },
  jellyfish: { bed: "water", every: [2.5, 6], call: () => { const f = R(380, 720); tone("sine", f, f * 1.01, 1.4, 0.04); tone("sine", f * 1.5, f * 1.5, 1.2, 0.015, 0.05); } },
  mantas: { bed: "water", every: [3, 7], call: () => { tone("sine", R(70, 90), R(55, 65), 2, 0.07); for (let i = 0; i < 3; i++) tone("sine", R(500, 900), R(1200, 1800), 0.06, 0.03, 0.4 + i * R(0.1, 0.25)); } },
  koi: { bed: "pond", every: [1.5, 4], call: () => { for (let i = 0; i < Math.ceil(R(1, 3)); i++) tone("sine", R(300, 600), R(900, 1500), 0.05, 0.05, i * R(0.08, 0.2)); } },
  turtles: { bed: "water", every: [3, 6], call: () => { for (let i = 0; i < 5; i++) tone("sine", R(250, 500), R(700, 1300), 0.05, 0.035, i * R(0.06, 0.15)); } },
  fireflies: { bed: "night", every: [0.8, 2.2], call: () => {
    // crickets, and now and then a glassy chime for a flash
    const f = R(4200, 4800);
    for (let i = 0; i < 6; i++) tone("sine", f, f, 0.025, 0.02, i * 0.035);
    if (Math.random() < 0.35) tone("triangle", R(1200, 1800), R(1200, 1800), 0.9, 0.025, 0.3);
  } },
  dragonflies: { bed: "pond", every: [2, 5], call: () => { const c = ensure(); const t = c.currentTime; const o = c.createOscillator(); const g = c.createGain(); o.type = "sawtooth"; o.frequency.value = R(90, 130); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.02, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6); const f = c.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 900; o.connect(f).connect(g).connect(master); o.start(t); o.stop(t + 0.7); } },
  frogs: { bed: "pond", every: [1.5, 4], call: () => { const n = Math.ceil(R(1, 3)); const f = R(110, 170); for (let i = 0; i < n; i++) for (let k = 0; k < 6; k++) tone("square", f, f * 0.9, 0.02, 0.025, i * 0.28 + k * 0.025); } },
  crabs: { bed: "shore", every: [1, 3], call: () => { for (let i = 0; i < Math.ceil(R(2, 6)); i++) puff(R(3000, 5000), 8, 0.02, 0.06, i * R(0.05, 0.1)); } },
  hummingbirds: { bed: "air", every: [1.5, 4], call: () => { const c = ensure(); const t = c.currentTime; const o = c.createOscillator(); const g = c.createGain(); o.type = "triangle"; o.frequency.value = R(160, 200); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.03, t + 0.1); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.8); o.connect(g).connect(master); o.start(t); o.stop(t + 0.9); tone("sine", R(5000, 6500), R(4500, 6000), 0.04, 0.03, 0.3); tone("sine", R(5000, 6500), R(4500, 6000), 0.04, 0.03, 0.4); } },
  bats: { bed: "night", every: [1, 3], call: () => { for (let i = 0; i < Math.ceil(R(2, 5)); i++) tone("sine", R(6500, 8000), R(3500, 4500), 0.03, 0.025, i * R(0.05, 0.12)); } },
};

function loop() {
  clearTimeout(timer);
  const a = CALLS[current];
  if (!a || !ctx) return;
  const wait = R(a.every[0], a.every[1]) * 1000;
  timer = window.setTimeout(() => {
    if (enabled && ambient && document.visibilityState === "visible") a.call();
    loop();
  }, wait);
}

export const sound = {
  /** Call on the first user gesture. */
  unlock() {
    const c = ensure();
    if (c.state === "suspended") c.resume();
    if (current && !bedNodes.length) this.animal(current);
  },
  get ready() { return !!ctx; },
  animal(key: string) {
    current = key;
    if (!ctx) return;
    const a = CALLS[key];
    if (bedGain) bedGain.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
    setTimeout(() => { startBed(a ? a.bed : "none"); loop(); }, 400);
  },
  set(opts: { volume?: number; enabled?: boolean; ambient?: boolean }) {
    if (opts.volume !== undefined) volume = opts.volume;
    if (opts.enabled !== undefined) enabled = opts.enabled;
    if (opts.ambient !== undefined) { ambient = opts.ambient; if (ctx) { startBed(ambient && CALLS[current] ? CALLS[current].bed : "none"); loop(); } }
    if (ctx) master.gain.setTargetAtTime(enabled ? volume : 0, ctx.currentTime, 0.1);
  },
  preview() { CALLS[current]?.call(); },
  /** A click on the scene: a soft drop, plus the animal's own reaction. */
  tap(key: string) {
    if (!ctx || !enabled) return;
    const wet = ["koi", "jellyfish", "mantas", "turtles"].includes(key);
    if (wet) { tone("sine", 900, 260, 0.18, 0.06); puff(500, 1, 0.3, 0.03, 0.05, "lowpass"); }
    else { tone("triangle", 600, 300, 0.08, 0.03); }
    if (key === "crabs") for (let i = 0; i < 8; i++) puff(R(3000, 5000), 8, 0.02, 0.06, 0.05 + i * 0.04);
    if (key === "frogs") tone("square", 160, 120, 0.12, 0.03, 0.08);
    if (["butterflies", "moths", "swallows", "cranes", "bats", "hummingbirds", "dragonflies"].includes(key)) for (let i = 0; i < 4; i++) puff(R(1200, 2200), 2, 0.08, 0.04, 0.04 + i * 0.05);
  },
  // ── UI ──
  key() { if (!ctx || !enabled) return; puff(R(2400, 3400), 6, 0.025, 0.08); tone("square", R(900, 1100), 700, 0.018, 0.012); },
  backspace() { if (!ctx || !enabled) return; puff(1500, 5, 0.03, 0.07); },
  enter() { if (!ctx || !enabled) return; tone("square", 660, 660, 0.05, 0.03); tone("square", 990, 990, 0.08, 0.03, 0.06); },
  tick() { if (!ctx || !enabled) return; tone("square", 1800, 1800, 0.012, 0.012); },
  toggle(on: boolean) { if (!ctx || !enabled) return; tone("square", on ? 700 : 900, on ? 1050 : 600, 0.06, 0.02); },
  open() { if (!ctx || !enabled) return; puff(900, 0.8, 0.25, 0.05, 0, "lowpass"); tone("sine", 440, 660, 0.18, 0.025); },
  close() { if (!ctx || !enabled) return; puff(700, 0.8, 0.2, 0.04, 0, "lowpass"); tone("sine", 660, 440, 0.15, 0.02); },
  pick() { if (!ctx || !enabled) return; tone("square", 523, 523, 0.05, 0.025); tone("square", 784, 784, 0.07, 0.025, 0.05); },
  mode() { if (!ctx || !enabled) return; tone("triangle", 880, 1320, 0.07, 0.03); },
};
