/**
 * Manta rays gliding through open water. Seen from above: a broad diamond of
 * wing, deep navy on the back with the two pale chevrons mantas have on their
 * shoulders, curled cephalic fins at the front and a whip of a tail behind.
 * They fly by undulation: a wave rolls out along each wing, so the tips lift
 * (and foreshorten) a beat after the roots.
 */
import { SHARED_TUNING, type Animal, type Creature } from "../flock";
import { INK_DARK, INK_SCALE, INK_SHIMMER, ink, type RGB } from "../ink";
import { rand, smoothstep, TAU } from "../math";
import { inEllipse } from "./shapes";

interface Manta extends Creature {
  phase: number;
  pace: number;
}

const BACK: RGB = [52, 118, 200];
const EDGE: RGB = [120, 196, 245];
const CHEVRON: RGB = [196, 226, 236];
const DARK: RGB = [30, 58, 116];
const at = { x: 0, y: 0 };
const bt = { x: 0, y: 0 };

const DEFAULTS = {
  ...SHARED_TUNING,
  detail: 1.5,
  density: 0.55,
  speed: 0.9,
  sway: 0.1,
  spread: 0.12,
  size: 1.1,
  farthest: 0.3,
  farBias: 1.4,
  grip: 1.2,
  separation: 220,
  trail: 0.8,
  trailFade: 0.6,
  shimmer: 0.35,
  sparkle: 0.05,
  stroke: 1,
  wave: 1,
};

export const mantas: Animal<Manta> = {
  key: "mantas",
  label: "Manta",
  swatch: [60, 170, 220],
  defaults: DEFAULTS,
  controls: [
    ["Swimming", [
      { key: "stroke", label: "Stroke rate", min: 0.2, max: 2.5, step: 0.05, hint: "How fast the wings roll." },
      { key: "wave", label: "Wave depth", min: 0, max: 2, step: 0.05, hint: "How far the wingtips lift on each stroke." },
    ]],
  ],
  area: 90000,
  scale: 1.7,
  speed: 60,
  trail: { light: [80, 150, 200], dark: [120, 200, 240] },

  create: (c) => ({ ...c, phase: rand(0, TAU), pace: rand(0.8, 1.15) }),

  update(m, flock, dt) {
    const k = flock.tuning as typeof DEFAULTS;
    const cruise = flock.cruise(m);
    const acc = flock.begin();
    flock.steer(m, flock.heading + m.bias * k.spread, cruise, k.grip);
    // Each downstroke gives a gentle surge.
    const surge = Math.max(0, Math.sin(m.phase)) * cruise * 0.6;
    acc.x += Math.cos(m.heading) * surge;
    acc.y += Math.sin(m.heading) * surge;
    flock.separate(m);
    const speed = flock.move(m, dt, cruise * 1.6);
    if (flock.passed(m)) flock.reenter(m);
    if (speed > 5) flock.face(m, dt, 1.5);
    m.phase += dt * TAU * 0.45 * k.stroke * m.pace;
  },

  draw(m, pen, flock) {
    const k = flock.tuning as typeof DEFAULTS;
    const S = m.span;
    const out = pen.ink;
    const pose = { x: m.x, y: m.y, heading: m.heading + 0.03 * Math.sin(m.phase), span: S, depth: m.depth, id: m.id };

    // Tail: a thin whip that trails the swimming wave.
    pen.toWorld(pose, -0.24, 0, at);
    pen.toWorld(pose, -0.62, 0.04 * Math.sin(m.phase - 1.5), bt);
    pen.line(at.x, at.y, bt.x, bt.y, DARK, m.depth);

    pen.shape(pose, 0.6, (u, v) => {
      const av = Math.abs(v);
      // Cephalic fins: two short curled lobes either side of the mouth.
      if (inEllipse(u, av, 0.21, 0.07, 0.06, 0.022)) return ink(out, ...DARK, INK_DARK);
      // Wing wave: the outer wing lifts later and higher, which foreshortens it.
      const q0 = Math.min(1, av / 0.5);
      const lift = Math.sin(m.phase - q0 * 1.6) * 0.22 * k.wave * smoothstep(0.1, 1, q0);
      const vw = av / (1 - Math.abs(lift));
      if (vw > 0.5) return false;
      const q = vw / 0.5;
      // Diamond: the leading edge curves back to the tip, the trailing edge comes in straighter.
      const lead = 0.2 * (1 - Math.pow(q, 1.5)) - 0.06 * q;
      const trail = -0.26 * Math.pow(1 - q, 0.9) - 0.06 * q;
      const du = lift * 0.08;
      if (u - du > lead || u - du < trail) return false;
      // Pale shoulder chevrons.
      const cu = u - (0.08 - 0.32 * q);
      if (q > 0.12 && q < 0.5 && Math.abs(cu) < 0.035 && u < 0.12) return ink(out, ...CHEVRON, INK_SCALE);
      // Lit edge where the wing curls up toward the light; dark wingtips.
      if (q > 0.88) return ink(out, ...DARK, INK_DARK);
      if (lead - (u - du) < 0.03) return ink(out, ...EDGE, INK_SHIMMER);
      const g = 0.85 + 0.35 * Math.max(0, -lift);
      return ink(out, BACK[0] * g, BACK[1] * g, BACK[2] * g, INK_SHIMMER);
    }, { light: 0.85 + 0.15 * Math.cos(m.phase), tilt: Math.sin(m.phase) });

    // Water stirred off the wingtips.
    for (const side of [-1, 1]) {
      pen.toWorld(pose, -0.08, 0.48 * side, at);
      pen.shed(at.x, at.y, 0.04 * m.depth * Math.max(0, Math.sin(m.phase)));
    }
  },
};
