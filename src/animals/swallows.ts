/**
 * Barn swallows. Seen from above: a glossy steel-blue back, rust forehead,
 * long pointed wings swept back like scythes, and a deeply forked tail with
 * two streamers. They flap in quick bursts, then glide with the wings swept
 * further back, banking a little side to side as they go.
 */
import { SHARED_TUNING, type Animal, type Creature } from "../flock";
import { INK_DARK, INK_SCALE, INK_SHIMMER, ink, type RGB } from "../ink";
import { clamp, rand, TAU } from "../math";
import { inEllipse } from "./shapes";

interface Swallow extends Creature {
  phase: number;
  pace: number;
  /** 0 flapping → 1 gliding. */
  glide: number;
  glideUntil: number;
  /** Wings spread: ~0.2 raised → 1 flat. */
  open: number;
  bank: number;
}

const BACK: RGB = [78, 132, 240];
const WING: RGB = [52, 78, 168];
const TIP: RGB = [30, 40, 100];
const RUST: RGB = [214, 96, 52];
const CREAM: RGB = [236, 220, 196];
const at = { x: 0, y: 0 };

const DEFAULTS = {
  ...SHARED_TUNING,
  detail: 1.6,
  density: 0.8,
  speed: 1.2,
  sway: 0.05,
  spread: 0.05,
  size: 1,
  farthest: 0.3,
  farBias: 1.5,
  grip: 2.5,
  separation: 260,
  trail: 0.7,
  trailFade: 0.9,
  shimmer: 0.45,
  sparkle: 0.06,
  wingbeat: 1,
  glide: 1.4,
  bank: 1,
};

export const swallows: Animal<Swallow> = {
  key: "swallows",
  label: "Swallow",
  swatch: [70, 110, 230],
  defaults: DEFAULTS,
  controls: [
    ["Flight", [
      { key: "wingbeat", label: "Wingbeat", min: 0.3, max: 2.5, step: 0.05, hint: "How fast their wings beat." },
      { key: "glide", label: "Glide", min: 0, max: 4, step: 0.05, hint: "How often they stop flapping and sweep into a glide." },
      { key: "bank", label: "Banking", min: 0, max: 3, step: 0.05, hint: "How much they weave and bank side to side." },
    ]],
  ],
  area: 42000,
  scale: 1.5,
  speed: 150,
  trail: { light: [60, 90, 180], dark: [90, 130, 230] },

  create: (c) => ({ ...c, phase: rand(0, TAU), pace: rand(0.85, 1.2), glide: 0, glideUntil: 0, open: 1, bank: 0 }),

  update(s, flock, dt) {
    const k = flock.tuning as typeof DEFAULTS;
    const t = flock.time;
    const cruise = flock.cruise(s);
    // A slow weave around the course, each bird on its own clock.
    s.bank = Math.sin(t * 0.9 * s.pace + s.id) * 0.28 * k.bank;
    flock.begin();
    flock.steer(s, flock.heading + s.bias * k.spread + s.bank, cruise * (1 + 0.25 * (1 - s.glide)), k.grip);
    flock.separate(s);
    const speed = flock.move(s, dt, cruise * 1.8);
    if (flock.passed(s)) flock.reenter(s);
    if (speed > 10) flock.face(s, dt, 5);

    if (s.glide < 0.5 && t > s.glideUntil && Math.random() < 0.5 * k.glide * dt) s.glideUntil = t + rand(0.5, 1.6);
    s.glide += ((t < s.glideUntil ? 1 : 0) - s.glide) * Math.min(1, dt * 5);
    s.phase += dt * TAU * 3.6 * k.wingbeat * s.pace * (1 - 0.92 * s.glide);
    const beat = 0.5 + 0.5 * Math.cos(s.phase);
    s.open = clamp(0.22 + 0.78 * (beat * (1 - s.glide) + s.glide), 0.2, 1);
  },

  draw(s, pen) {
    const S = s.span;
    const out = pen.ink;
    const pose = { x: s.x, y: s.y, heading: s.heading, span: S, depth: s.depth, id: s.id };
    const open = s.open;
    // Wings sweep further back when gliding or raised.
    const sweep = 0.5 + 0.45 * s.glide + 0.25 * (1 - open);
    const minW = (pen.cw * 0.45) / S;

    // Tail streamers.
    for (const side of [-1, 1]) pen.lineBody(pose, -0.2, 0.03 * side, -0.48, 0.1 * side, TIP);

    pen.shape(pose, 0.62, (u, v) => {
      const av = Math.abs(v);
      // Head with a rust forehead, then a glossy back.
      if (inEllipse(u, av, 0.14, 0, 0.055, Math.max(0.045, minW))) return u > 0.17 ? ink(out, ...RUST, INK_SCALE) : ink(out, ...BACK, INK_SHIMMER);
      if (inEllipse(u, av, 0.01, 0, 0.14, Math.max(0.055, minW))) return ink(out, ...BACK, INK_SHIMMER);
      // Forked tail: a short fan splitting into a V.
      if (u < -0.1 && u > -0.27) {
        const w = 0.035 + 0.25 * (-0.1 - u);
        const notch = 0.6 * (-0.13 - u);
        if (av < w && av > notch) return ink(out, ...WING, INK_DARK);
      }
      // Wings: scythe-shaped. Unfold v by how open the wings are.
      if (av < 0.04) return false;
      const vw = av / open;
      if (vw > 0.52) return false;
      const q = (vw - 0.04) / 0.48;
      const lead = 0.07 - sweep * 0.42 * Math.pow(q, 1.5);
      const chord = 0.13 * Math.pow(1 - q, 0.65) + 0.012;
      if (u > lead || u < lead - chord) return false;
      // Pale band of coverts near the body, dark primaries at the tip.
      if (q > 0.62) return ink(out, ...TIP, INK_DARK);
      if (u > lead - chord * 0.35 && q < 0.4) return ink(out, ...BACK, INK_SHIMMER);
      return ink(out, ...WING, INK_SCALE);
    }, { light: 0.75 + 0.25 * open, tilt: open * 2 + s.bank });

    // Cream throat flash on the bigger ones, and a glint of an eye.
    if (S * 0.05 > pen.cw) {
      for (const side of [-1, 1]) {
        pen.toWorld(pose, 0.155, 0.035 * side, at);
        pen.spot(at.x, at.y, "●", CREAM, TIP, s.depth);
      }
    }
    pen.toWorld(pose, -0.3, 0, at);
    pen.shed(at.x, at.y, 0.05 * s.depth * (1 - s.glide * 0.5));
  },
};
