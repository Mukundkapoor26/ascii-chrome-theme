/**
 * Luna moths at night. Pale mint wings edged in plum along the leading edge,
 * an eyespot on each wing (a yellow ring around a dark pupil), and long
 * trailing tails on the hindwings that swing as the moth flaps. A fuzzy white
 * body and feathered antennae. They flap slowly and loosely, with a wobbling,
 * drunken path and short glides.
 */
import { SHARED_TUNING, type Animal, type Creature } from "../flock";
import { INK_BODY, INK_DARK, INK_SCALE, INK_SHIMMER, INK_SPOT, ink, type RGB } from "../ink";
import { clamp, rand, TAU } from "../math";
import { inEllipse, seg, toSegment } from "./shapes";

interface Moth extends Creature {
  phase: number;
  open: number;
  glide: number;
  glideUntil: number;
  wobX: number;
  wobY: number;
}

const WING: RGB = [176, 236, 182];
const WING_DEEP: RGB = [118, 196, 140];
const PLUM: RGB = [132, 58, 98];
const RING: RGB = [250, 214, 96];
const PUPIL: RGB = [70, 30, 60];
const BODY: RGB = [240, 240, 228];
const at = { x: 0, y: 0 };

const DEFAULTS = {
  ...SHARED_TUNING,
  detail: 1.5,
  density: 0.85,
  speed: 0.9,
  sway: 0.1,
  spread: 0.2,
  size: 1,
  farthest: 0.25,
  farBias: 1.6,
  grip: 1.6,
  separation: 400,
  trail: 1,
  trailFade: 0.4,
  shimmer: 0.25,
  sparkle: 0.08,
  flapRate: 1,
  wobble: 1,
};

export const moths: Animal<Moth> = {
  key: "moths",
  label: "Luna moth",
  swatch: [170, 240, 180],
  defaults: DEFAULTS,
  controls: [
    ["Flight", [
      { key: "flapRate", label: "Flap rate", min: 0.2, max: 3, step: 0.05, hint: "How fast their wings beat." },
      { key: "wobble", label: "Wobble", min: 0, max: 3, step: 0.05, hint: "How loose and wandering their path is." },
    ]],
  ],
  area: 60000,
  scale: 1,
  speed: 55,
  trail: { light: [130, 190, 140], dark: [170, 240, 180] },

  create: (c) => ({ ...c, phase: rand(0, TAU), open: 1, glide: 0, glideUntil: 0, wobX: 0, wobY: 0 }),

  update(m, flock, dt) {
    const k = flock.tuning as typeof DEFAULTS;
    const t = flock.time;
    const cruise = flock.cruise(m);
    const acc = flock.begin();
    flock.steer(m, flock.heading + m.bias * k.spread, cruise, k.grip);
    const kick = Math.sqrt(dt) * 260 * k.wobble * (1 - 0.7 * m.glide) * (0.5 + 0.5 * m.depth);
    m.wobX += -m.wobX * 2 * dt + (Math.random() * 2 - 1) * kick;
    m.wobY += -m.wobY * 2 * dt + (Math.random() * 2 - 1) * kick;
    acc.x += m.wobX;
    acc.y += m.wobY;
    const down = Math.max(0, -Math.sin(m.phase)) * (1 - m.glide);
    acc.x += Math.cos(m.heading) * down * cruise * 1.2;
    acc.y += Math.sin(m.heading) * down * cruise * 1.2;
    flock.separate(m);
    const speed = flock.move(m, dt, cruise * 2);
    if (flock.passed(m)) flock.reenter(m);
    if (speed > 8) flock.face(m, dt, 4);
    if (m.glide < 0.5 && t > m.glideUntil && Math.random() < 0.25 * dt) m.glideUntil = t + rand(0.4, 1);
    m.glide += ((t < m.glideUntil ? 1 : 0) - m.glide) * Math.min(1, dt * 5);
    m.phase += dt * TAU * 1.8 * k.flapRate * (1 - 0.9 * m.glide);
    const beat = Math.pow(0.5 + 0.5 * Math.cos(m.phase), 0.9);
    m.open = clamp(0.12 + 0.88 * (beat * (1 - m.glide) + 0.95 * m.glide), 0.1, 1);
  },

  draw(m, pen) {
    const S = m.span;
    const out = pen.ink;
    const open = m.open;
    const pose = { x: m.x, y: m.y, heading: m.heading + 0.05 * Math.sin(m.phase), span: S, depth: m.depth, id: m.id };
    const minW = (pen.cw * 0.45) / S;
    // The tails swing behind the flap.
    const swing = 0.06 * Math.sin(m.phase - 1.2);

    // Feathered antennae.
    for (const side of [-1, 1]) pen.lineBody(pose, 0.16, 0.02 * side, 0.3, 0.12 * side, [200, 170, 120]);

    pen.shape(pose, 0.82, (u, v) => {
      const av = Math.abs(v);
      if (inEllipse(u, av, 0.02, 0, 0.17, Math.max(0.04, minW))) return ink(out, ...BODY, INK_BODY);
      if (av < 0.03) return false;
      const vw = av / open;
      // Forewing: swept a little back, plum leading edge, eyespot.
      const fu = u - 0.18 * vw;
      if (inEllipse(fu, vw, 0.05, 0.23, 0.13, 0.22)) {
        if (fu - 0.05 > 0.13 * Math.sqrt(Math.max(0, 1 - ((vw - 0.23) / 0.22) ** 2)) - 0.03) return ink(out, ...PLUM, INK_DARK);
        const e = Math.hypot(fu - 0.04, vw - 0.25);
        if (e < 0.022) return ink(out, ...PUPIL, INK_SPOT);
        if (e < 0.045) return ink(out, ...RING, INK_SPOT);
        return ink(out, ...(vw < 0.1 ? WING_DEEP : WING), INK_SHIMMER);
      }
      // Hindwing, then its long tail.
      if (inEllipse(u, vw, -0.11, 0.16, 0.13, 0.15)) {
        const e = Math.hypot(u + 0.1, vw - 0.19);
        if (e < 0.018) return ink(out, ...PUPIL, INK_SPOT);
        if (e < 0.036) return ink(out, ...RING, INK_SPOT);
        return ink(out, ...WING, INK_SCALE);
      }
      const d1 = toSegment(u, vw, -0.2, 0.15, -0.42, 0.12 + swing);
      const t1 = seg.t;
      if (d1 < Math.max(minW, 0.035 * (1 - 0.5 * t1))) return ink(out, ...WING, INK_SCALE);
      const d2 = toSegment(u, vw, -0.42, 0.12 + swing, -0.62, 0.15 + swing * 2);
      if (d2 < Math.max(minW, 0.017 + 0.012 * seg.t)) return seg.t > 0.7 ? ink(out, ...PLUM, INK_DARK) : ink(out, ...WING, INK_SCALE);
      return false;
    }, { light: 0.7 + 0.3 * open, tilt: open * 3 });

    const stroke = Math.max(0, -Math.sin(m.phase)) * (1 - m.glide);
    for (const side of [-1, 1]) {
      pen.toWorld(pose, 0.12, 0.42 * open * side, at);
      pen.shed(at.x, at.y, 0.05 * stroke * m.depth);
    }
  },
};
