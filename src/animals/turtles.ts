/**
 * Green sea turtles. Seen from above: a teardrop carapace of amber scutes
 * (a centre row of five, four either side, and a ring of small marginals),
 * a scaled head, two long front flippers that row in slow power strokes, and
 * small rear flippers that steer. Each power stroke (flippers sweeping back)
 * surges the turtle forward; the recovery brings them forward again.
 */
import { SHARED_TUNING, type Animal, type Creature } from "../flock";
import { INK_DARK, INK_SCALE, INK_SHIMMER, ink, type RGB } from "../ink";
import { frac, rand, TAU } from "../math";
import { inEllipse, seg, toSegment } from "./shapes";

interface Turtle extends Creature {
  phase: number;
  pace: number;
}

const SCUTE: RGB = [186, 140, 70];
const SCUTE_LIGHT: RGB = [232, 190, 104];
const SEAM: RGB = [58, 44, 24];
const RIM: RGB = [134, 104, 58];
const SKIN: RGB = [128, 176, 140];
const SKIN_DARK: RGB = [52, 76, 64];
const at = { x: 0, y: 0 };

const DEFAULTS = {
  ...SHARED_TUNING,
  detail: 1.5,
  density: 0.6,
  speed: 0.9,
  sway: 0.08,
  spread: 0.12,
  size: 1,
  farthest: 0.3,
  farBias: 1.4,
  grip: 1.3,
  separation: 260,
  trail: 0.9,
  trailFade: 0.6,
  shimmer: 0.2,
  sparkle: 0.04,
  stroke: 1,
};

/** Flipper sweep angle (0 straight out, + swept back) through the stroke: slow power, quicker recovery. */
function sweep(phase: number) {
  const p = frac(phase / TAU);
  return p < 0.6 ? -0.35 + 1.45 * (p / 0.6) : 1.1 - 1.45 * ((p - 0.6) / 0.4);
}

export const turtles: Animal<Turtle> = {
  key: "turtles",
  label: "Sea turtle",
  swatch: [120, 190, 120],
  defaults: DEFAULTS,
  controls: [
    ["Swimming", [
      { key: "stroke", label: "Stroke rate", min: 0.2, max: 2.5, step: 0.05, hint: "How fast the front flippers row." },
    ]],
  ],
  area: 85000,
  scale: 1.6,
  speed: 45,
  trail: { light: [90, 150, 170], dark: [110, 190, 210] },

  create: (c) => ({ ...c, phase: rand(0, TAU), pace: rand(0.85, 1.15) }),

  update(tt, flock, dt) {
    const k = flock.tuning as typeof DEFAULTS;
    const cruise = flock.cruise(tt);
    const acc = flock.begin();
    flock.steer(tt, flock.heading + tt.bias * k.spread, cruise * 0.8, k.grip);
    const p = frac(tt.phase / TAU);
    const power = p < 0.6 ? Math.sin((p / 0.6) * Math.PI) : 0;
    acc.x += Math.cos(tt.heading) * power * cruise * 1.6;
    acc.y += Math.sin(tt.heading) * power * cruise * 1.6;
    flock.separate(tt);
    const speed = flock.move(tt, dt, cruise * 1.6);
    if (flock.passed(tt)) flock.reenter(tt);
    if (speed > 4) flock.face(tt, dt, 1.2);
    tt.phase += dt * TAU * 0.4 * k.stroke * tt.pace;
  },

  draw(tt, pen) {
    const S = tt.span;
    const out = pen.ink;
    const pose = { x: tt.x, y: tt.y, heading: tt.heading, span: S, depth: tt.depth, id: tt.id };
    const a = sweep(tt.phase);
    const rearA = 0.6 + 0.25 * Math.sin(tt.phase + 1);
    const minW = (pen.cw * 0.5) / S;

    pen.shape(pose, 0.62, (u, v) => {
      const av = Math.abs(v);
      // Head: rounded, with a mosaic of scales.
      if (inEllipse(u, av, 0.34, 0, 0.085, 0.065)) {
        return frac(u * 40) < 0.2 || frac(av * 40 + 0.5) < 0.2 ? ink(out, ...SKIN_DARK, INK_DARK) : ink(out, ...SKIN, INK_SCALE);
      }
      if (inEllipse(u, av, 0.26, 0, 0.06, 0.05)) return ink(out, ...SKIN, INK_SCALE);
      // Carapace: a teardrop, broad in front.
      const cu = (u + 0.02) / 0.27;
      const halfW = 0.2 * Math.sqrt(Math.max(0, 1 - cu * cu)) * (cu > 0 ? 1 : 0.85 + 0.15 * (1 + cu));
      if (av < halfW && Math.abs(cu) <= 1) {
        const r = av / Math.max(halfW, 1e-3);
        if (r > 0.86 || Math.abs(cu) > 0.9) return frac((cu + 1) * 6 + r) < 0.12 ? ink(out, ...SEAM, INK_DARK) : ink(out, ...RIM, INK_SCALE);
        // Centre row of five and a side row of four, separated by dark seams.
        const row = r < 0.32 ? 0 : 1;
        const n = row === 0 ? 5 : 4;
        const cell = frac(((cu + 0.9) / 1.8) * n + (row ? 0.5 * 0.3 : 0));
        if (Math.abs(r - 0.32) < 0.05 || cell < 0.08) return ink(out, ...SEAM, INK_DARK);
        // Each scute is lighter toward its middle, with growth rings.
        const mid = 1 - Math.abs(cell - 0.5) * 2;
        const ring = frac(mid * 3) < 0.25;
        const c = mid > 0.55 ? SCUTE_LIGHT : SCUTE;
        return ink(out, ...c, ring ? INK_SCALE : INK_SHIMMER);
      }
      // Front flippers: long, tapering blades that row.
      const len = 0.42;
      const tipU = 0.12 - Math.sin(a) * len;
      const tipV = 0.16 + Math.cos(a) * len;
      const d = toSegment(u, av, 0.12, 0.13, tipU, tipV);
      const w = Math.max(minW, 0.065 * (1 - seg.t) ** 0.6 + 0.012);
      if (d < w) return seg.t > 0.75 || frac(seg.t * 6) < 0.15 ? ink(out, ...SKIN_DARK, INK_DARK) : ink(out, ...SKIN, INK_SCALE);
      // Rear flippers: short paddles.
      const rd = toSegment(u, av, -0.2, 0.1, -0.2 - Math.sin(rearA) * 0.14, 0.1 + Math.cos(rearA) * 0.14);
      if (rd < Math.max(minW, 0.04 * (1 - seg.t) + 0.012)) return ink(out, ...SKIN, INK_SCALE);
      return false;
    }, { light: 0.9 + 0.1 * Math.cos(tt.phase), tilt: a });

    // Eyes on the bigger ones.
    if (S * 0.06 > pen.cw) {
      for (const side of [-1, 1]) {
        pen.toWorld(pose, 0.36, 0.045 * side, at);
        pen.spot(at.x, at.y, "●", [250, 250, 240], [16, 18, 16], tt.depth);
      }
    }
    // Bubbles off the flipper tips on the power stroke.
    if (a > 0.6) {
      for (const side of [-1, 1]) {
        pen.toWorld(pose, 0.12 - Math.sin(a) * 0.42, (0.16 + Math.cos(a) * 0.42) * side, at);
        pen.shed(at.x, at.y, 0.06 * tt.depth);
      }
    }
  },
};
