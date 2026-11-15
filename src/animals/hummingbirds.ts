/**
 * Ruby-throated hummingbirds. Emerald back, a ruby gorget that flashes, a
 * long needle bill and wings beating so fast they read as a blurred fan. They
 * fly in darts: a quick burst along the course, a sudden stop to hover in
 * place (bobbing, turning to look about), then the next dart.
 */
import { SHARED_TUNING, type Animal, type Creature } from "../flock";
import { INK_DARK, INK_GLASS, INK_SCALE, INK_SHIMMER, ink, type RGB } from "../ink";
import { rand, TAU } from "../math";
import { inEllipse } from "./shapes";

interface Hummer extends Creature {
  phase: number;
  /** Time left in the current hover (> 0) or dart (< 0), s. */
  until: number;
  hovering: boolean;
  look: number;
}

const BACK: RGB = [70, 235, 140];
const BELLY: RGB = [200, 214, 200];
const GORGET: RGB = [240, 40, 80];
const WING: RGB = [120, 140, 160];
const BILL: RGB = [40, 40, 46];
const at = { x: 0, y: 0 };

const DEFAULTS = {
  ...SHARED_TUNING,
  detail: 1.6,
  density: 0.9,
  speed: 1,
  sway: 0.05,
  spread: 0.2,
  farthest: 0.3,
  farBias: 1.5,
  grip: 3,
  separation: 300,
  trail: 0.6,
  trailFade: 1,
  shimmer: 0.6,
  sparkle: 0.15,
  hover: 1,
  dart: 1,
};

export const hummingbirds: Animal<Hummer> = {
  key: "hummingbirds",
  label: "Hummingbird",
  swatch: [60, 210, 130],
  defaults: DEFAULTS,
  controls: [
    ["Flight", [
      { key: "hover", label: "Hover time", min: 0.1, max: 3, step: 0.05, hint: "How long they hang in place between darts." },
      { key: "dart", label: "Dart speed", min: 0.3, max: 3, step: 0.05, hint: "How fast each dart is." },
    ]],
  ],
  area: 45000,
  scale: 1.15,
  speed: 120,
  trail: { light: [60, 180, 110], dark: [90, 230, 150] },

  create: (c) => ({ ...c, phase: rand(0, TAU), until: rand(0.2, 1.5), hovering: Math.random() < 0.5, look: 0 }),

  update(h, flock, dt) {
    const k = flock.tuning as typeof DEFAULTS;
    const cruise = flock.cruise(h);
    h.until -= dt;
    if (h.until <= 0) {
      h.hovering = !h.hovering;
      h.until = h.hovering ? rand(0.4, 1.8) * k.hover : rand(0.25, 0.7);
    }
    const acc = flock.begin();
    if (h.hovering) {
      // Brake hard, bob, glance about.
      acc.x += -h.vx * 8;
      acc.y += -h.vy * 8 + Math.sin(flock.time * 6 + h.id) * 40;
      h.look = Math.sin(flock.time * 1.7 + h.id) * 0.5;
    } else {
      flock.steer(h, flock.heading + h.bias * k.spread, cruise * 2.4 * k.dart, 6);
      h.look *= 0.9;
    }
    flock.separate(h);
    flock.move(h, dt, cruise * 3 * k.dart);
    if (flock.passed(h)) flock.reenter(h);
    const target = flock.heading + h.bias * k.spread + h.look;
    flock.face(h, dt, 6, h.hovering ? target : Math.atan2(h.vy, h.vx));
    h.phase += dt * TAU * 13;
  },

  draw(h, pen) {
    const S = h.span;
    const out = pen.ink;
    const pose = { x: h.x, y: h.y, heading: h.heading, span: S, depth: h.depth, id: h.id };
    const minW = (pen.cw * 0.45) / S;
    // Blurred wings: the fan swept out to where the wing has been this beat.
    const sweep = 0.5 + 0.5 * Math.sin(h.phase);
    pen.lineBody(pose, 0.26, 0, 0.5, 0, BILL);

    pen.shape(pose, 0.55, (u, v) => {
      const av = Math.abs(v);
      if (inEllipse(u, av, 0.17, 0, 0.075, Math.max(0.06, minW))) return u > 0.2 ? ink(out, ...BACK, INK_SHIMMER) : ink(out, ...GORGET, INK_SHIMMER);
      if (inEllipse(u, av, -0.02, 0, 0.17, Math.max(0.075, minW))) return av > 0.05 ? ink(out, ...BELLY, INK_SCALE) : ink(out, ...BACK, INK_SHIMMER);
      // Tail: a short dark fan.
      if (u < -0.15 && u > -0.32 && av < 0.03 + 0.25 * (-0.15 - u)) return ink(out, ...BILL, INK_DARK);
      // Wings: a translucent blurred fan.
      if (av > 0.06) {
        const a = Math.atan2(u - 0.02, av);
        const r = Math.hypot(u - 0.02, av);
        const lo = -0.3 - 0.5 * sweep, hi = 0.6 - 0.3 * sweep;
        if (a > lo && a < hi && r < 0.42) return ink(out, ...WING, INK_GLASS, ".:'");
      }
      return false;
    }, { light: 0.9, tilt: h.phase * 0.05 });

    if (S * 0.05 > pen.cw) {
      for (const side of [-1, 1]) {
        pen.toWorld(pose, 0.19, 0.035 * side, at);
        pen.spot(at.x, at.y, "●", [255, 255, 255], [10, 10, 12], h.depth);
      }
    }
    if (!h.hovering) { pen.toWorld(pose, -0.3, 0, at); pen.shed(at.x, at.y, 0.06 * h.depth); }
  },
};
