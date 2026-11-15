/**
 * Bats at dusk. Membrane wings stretched between long finger bones (drawn as
 * dark ribs across a lighter, see-through membrane), a furry brown body, big
 * ears. Bats fly erratically: deep, fast wingbeats and sudden swerves as they
 * chase insects, never holding a line for long.
 */
import { SHARED_TUNING, type Animal, type Creature } from "../flock";
import { INK_BODY, INK_DARK, INK_GLASS, ink, type RGB } from "../ink";
import { clamp, rand, TAU } from "../math";
import { inEllipse, toSegment } from "./shapes";

interface Bat extends Creature {
  phase: number;
  open: number;
  swerve: number;
  swerveUntil: number;
}

const FUR: RGB = [150, 104, 78];
const MEMBRANE: RGB = [120, 90, 120];
const BONE: RGB = [40, 30, 44];
const EAR: RGB = [180, 120, 110];
const at = { x: 0, y: 0 };

const DEFAULTS = {
  ...SHARED_TUNING,
  detail: 1.6,
  density: 0.9,
  speed: 1.1,
  sway: 0.1,
  spread: 0.2,
  farthest: 0.3,
  farBias: 1.5,
  grip: 2,
  separation: 250,
  trail: 0.4,
  trailFade: 1.5,
  shimmer: 0.1,
  sparkle: 0.02,
  wingbeat: 1,
  erratic: 1,
};

/** Finger bones, from the wrist (u, v) out to the wing edge. */
const FINGERS: [number, number][] = [[0.08, 0.5], [-0.06, 0.48], [-0.18, 0.36]];
const WRIST: [number, number] = [0.06, 0.2];

export const bats: Animal<Bat> = {
  key: "bats",
  label: "Bat",
  swatch: [180, 120, 170],
  defaults: DEFAULTS,
  controls: [
    ["Flight", [
      { key: "wingbeat", label: "Wingbeat", min: 0.3, max: 2.5, step: 0.05, hint: "How fast their wings beat." },
      { key: "erratic", label: "Swerving", min: 0, max: 3, step: 0.05, hint: "How often and how hard they swerve after insects." },
    ]],
  ],
  area: 50000,
  scale: 0.95,
  speed: 110,
  trail: { light: [120, 90, 130], dark: [170, 130, 180] },

  create: (c) => ({ ...c, phase: rand(0, TAU), open: 1, swerve: 0, swerveUntil: 0 }),

  update(b, flock, dt) {
    const k = flock.tuning as typeof DEFAULTS;
    const t = flock.time;
    const cruise = flock.cruise(b);
    if (t > b.swerveUntil && Math.random() < 1.2 * k.erratic * dt) {
      b.swerve = rand(-1.1, 1.1) * k.erratic;
      b.swerveUntil = t + rand(0.15, 0.5);
    }
    if (t > b.swerveUntil) b.swerve *= 0.9;
    flock.begin();
    flock.steer(b, flock.heading + b.bias * k.spread + b.swerve, cruise, k.grip + 3);
    flock.separate(b);
    const speed = flock.move(b, dt, cruise * 1.8);
    if (flock.passed(b)) flock.reenter(b);
    if (speed > 10) flock.face(b, dt, 9);
    b.phase += dt * TAU * 5 * k.wingbeat;
    b.open = clamp(0.25 + 0.75 * (0.5 + 0.5 * Math.cos(b.phase)), 0.2, 1);
  },

  draw(b, pen) {
    const S = b.span;
    const out = pen.ink;
    const pose = { x: b.x, y: b.y, heading: b.heading, span: S, depth: b.depth, id: b.id };
    const open = b.open;
    const minW = (pen.cw * 0.45) / S;

    pen.shape(pose, 0.58, (u, v) => {
      const av = Math.abs(v);
      // Ears, head, furry body.
      if (inEllipse(u, av, 0.2, 0.035, 0.05, 0.022)) return ink(out, ...EAR, INK_BODY);
      if (inEllipse(u, av, 0.12, 0, 0.06, Math.max(0.05, minW))) return ink(out, ...FUR, INK_BODY);
      if (inEllipse(u, av, -0.04, 0, 0.14, Math.max(0.065, minW))) return ink(out, ...FUR, INK_BODY);
      if (av < 0.05) return false;
      const vw = av / open;
      // Bones: arm to the wrist, then the fingers.
      const bw = Math.max(minW * 0.6, 0.014);
      if (toSegment(u, vw, 0.04, 0.05, WRIST[0], WRIST[1]) < bw) return ink(out, ...BONE, INK_DARK);
      for (const [fu, fv] of FINGERS) if (toSegment(u, vw, WRIST[0], WRIST[1], fu, fv) < bw) return ink(out, ...BONE, INK_DARK);
      // Membrane: between body, fingers and a scalloped trailing edge.
      if (vw > 0.52) return false;
      const lead = 0.06 + 0.06 * Math.sin(Math.min(1, vw / 0.5) * Math.PI);
      const scallop = 0.03 * Math.abs(Math.sin(vw * 22));
      const trail = -0.14 - 0.2 * (vw / 0.5) + scallop;
      if (u > lead || u < trail) return false;
      return ink(out, ...MEMBRANE, INK_GLASS, "%#");
    }, { light: 0.75 + 0.25 * open });

    if (S * 0.05 > pen.cw) {
      for (const side of [-1, 1]) {
        pen.toWorld(pose, 0.15, 0.025 * side, at);
        pen.spot(at.x, at.y, "●", [255, 220, 200], [10, 6, 8], b.depth);
      }
    }
  },
};
