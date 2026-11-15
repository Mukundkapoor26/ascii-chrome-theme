/**
 * Fireflies drifting on a summer night. A small dark beetle with a red-orange
 * pronotum and two glassy wing cases held out while it flies; the last third
 * of the abdomen is the lantern. Each one flashes on its own rhythm (a quick
 * rise, a slower fade, then dark for a few seconds), and while lit it throws
 * a halo and leaves a smear of light behind. They wander loosely along the
 * course, bobbing and drifting rather than flying straight.
 */
import { SHARED_TUNING, type Animal, type Creature } from "../flock";
import { INK_BODY, INK_GLASS, INK_GLOW, INK_LIT, ink, type RGB } from "../ink";
import { clamp, rand, TAU } from "../math";
import { inEllipse } from "./shapes";

interface Firefly extends Creature {
  /** Seconds until the next flash starts. */
  next: number;
  /** Time into the current flash, s; < 0 when dark. */
  flash: number;
  glow: number;
  wanderX: number;
  wanderY: number;
  buzz: number;
}

const BODY: RGB = [44, 34, 26];
const SHIELD: RGB = [214, 92, 48];
const WING: RGB = [120, 110, 90];
const LAMP: RGB = [214, 255, 90];
const LAMP_OFF: RGB = [120, 120, 60];
const HALO: RGB = [190, 255, 110];
const at = { x: 0, y: 0 };

const DEFAULTS = {
  ...SHARED_TUNING,
  detail: 1.6,
  density: 1.4,
  speed: 0.8,
  sway: 0.2,
  spread: 0.4,
  size: 1,
  farthest: 0.25,
  farBias: 1.8,
  grip: 0.7,
  separation: 120,
  trail: 2,
  trailFade: 0.7,
  shimmer: 0.1,
  sparkle: 0.03,
  grid: 0.8,
  rhythm: 1,
  wander: 1,
  halo: 1,
};

export const fireflies: Animal<Firefly> = {
  key: "fireflies",
  label: "Firefly",
  swatch: [200, 255, 90],
  defaults: DEFAULTS,
  controls: [
    ["Glow", [
      { key: "rhythm", label: "Flash rate", min: 0.2, max: 3, step: 0.05, hint: "How often each one lights up." },
      { key: "halo", label: "Halo", min: 0, max: 2, step: 0.05, hint: "How far the light spills around a lit lantern." },
      { key: "wander", label: "Wander", min: 0, max: 3, step: 0.05, hint: "How much they drift and bob off their path." },
    ]],
  ],
  area: 26000,
  max: 160,
  scale: 0.6,
  speed: 30,
  trail: { light: [150, 190, 60], dark: [190, 255, 100] },

  create: (c) => ({ ...c, next: rand(0, 4), flash: -1, glow: 0, wanderX: 0, wanderY: 0, buzz: rand(0, TAU) }),

  update(f, flock, dt) {
    const k = flock.tuning as typeof DEFAULTS;
    const cruise = flock.cruise(f);
    const acc = flock.begin();
    flock.steer(f, flock.heading + f.bias * k.spread, cruise, k.grip);
    const kick = Math.sqrt(dt) * 140 * k.wander * (0.5 + 0.5 * f.depth);
    f.wanderX += -f.wanderX * 1.2 * dt + (Math.random() * 2 - 1) * kick;
    f.wanderY += -f.wanderY * 1.2 * dt + (Math.random() * 2 - 1) * kick;
    acc.x += f.wanderX;
    acc.y += f.wanderY;
    flock.separate(f);
    const speed = flock.move(f, dt, cruise * 2.5);
    if (flock.passed(f)) flock.reenter(f);
    if (speed > 4) flock.face(f, dt, 3);
    f.buzz += dt * 40;

    // Flash: rise in 0.15s, hold, fade over ~0.6s, then dark until the next.
    if (f.flash < 0) {
      f.next -= dt * k.rhythm;
      if (f.next <= 0) f.flash = 0;
    } else {
      f.flash += dt;
      if (f.flash > 1.6) {
        f.flash = -1;
        f.next = rand(0.6, 2.6);
      }
    }
    const x = f.flash;
    f.glow = x < 0 ? 0 : x < 0.15 ? x / 0.15 : x < 0.7 ? 1 : clamp(1 - (x - 0.7) / 0.9, 0, 1);
  },

  draw(f, pen, flock) {
    const k = flock.tuning as typeof DEFAULTS;
    const S = f.span;
    const out = pen.ink;
    const pose = { x: f.x, y: f.y, heading: f.heading, span: S, depth: f.depth, id: f.id };
    const g = f.glow;
    const haloR = 0.55 * k.halo * g;
    const wingOpen = 0.75 + 0.25 * Math.sin(f.buzz);

    pen.shape(pose, Math.max(0.6, haloR + 0.35), (u, v) => {
      const av = Math.abs(v);
      if (inEllipse(u, av, 0.24, 0, 0.09, 0.11)) return ink(out, ...SHIELD, INK_BODY);
      // Lantern: the rear of the abdomen.
      if (inEllipse(u, av, -0.2, 0, 0.16, 0.085)) {
        if (g > 0.05) return ink(out, LAMP[0], LAMP[1], LAMP[2] * (0.5 + 0.5 * g), INK_LIT);
        return ink(out, ...LAMP_OFF, INK_BODY);
      }
      if (inEllipse(u, av, 0.04, 0, 0.2, 0.085)) return ink(out, ...BODY, INK_BODY);
      // Wing cases held out, buzzing.
      if (inEllipse(u - 0.25 * av, av, 0.0, 0.22 * wingOpen, 0.18, 0.12 * wingOpen)) return ink(out, ...WING, INK_GLASS, ".:");
      // Halo around the lantern while lit.
      if (g > 0.05) {
        const d = Math.hypot(u + 0.2, v) / haloR;
        if (d < 1) {
          const a = (1 - d) * g;
          return ink(out, HALO[0] * a, HALO[1] * a, HALO[2] * a, INK_GLOW);
        }
      }
      return false;
    }, { light: 1 });

    if (g > 0.05) {
      pen.toWorld(pose, -0.22, 0, at);
      pen.shed(at.x, at.y, 0.1 * g * f.depth);
    }
  },
};
