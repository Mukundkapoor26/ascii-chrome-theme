import { ANIMALS, ANIMAL_KEYS, type AnimalKey } from "./animals";
import { AnimalEngine } from "./engine";
import { SHARED_CONTROLS, type KnobSpec } from "./flock";
import { sound } from "./sound";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const store = {
  get<T>(k: string, d: T): T {
    try { const v = localStorage.getItem("zoo5:" + k); return v ? { ...(d as object), ...JSON.parse(v) } as T : d; } catch { return d; }
  },
  raw<T>(k: string, d: T): T {
    try { const v = localStorage.getItem("zoo5:" + k); return v ? JSON.parse(v) : d; } catch { return d; }
  },
  set(k: string, v: unknown) { try { localStorage.setItem("zoo5:" + k, JSON.stringify(v)); } catch {} },
};

// ── settings that belong to the page, not the animal ──
const THEMES: Record<string, [string, string]> = {
  ice: ["#9fd8ff", "159,216,255"],
  ember: ["#ff9a5c", "255,154,92"],
  moss: ["#9be38a", "155,227,138"],
  lilac: ["#c9a6ff", "201,166,255"],
  rose: ["#ff8fb3", "255,143,179"],
  mono: ["#f2f2f2", "242,242,242"],
};
const page = store.get("page", { name: "", theme: "ice", mode: "google", search: true, keys: true, status: true,
  sound: true, volume: 0.6, ambient: true, typing: true, clock24: false, greeting: true });
sound.set({ volume: page.volume, enabled: page.sound, ambient: page.ambient });
const unlock = () => { sound.unlock(); removeEventListener("pointerdown", unlock); removeEventListener("keydown", unlock); };
addEventListener("pointerdown", unlock);
addEventListener("keydown", unlock);

// ── jet-black liquid glass: a displacement map that bends what's behind each pane at its rim ──
function glassMap(w: number, h: number, r: number) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d")!;
  const img = g.createImageData(w, h);
  const bezel = Math.min(22, r + 6, h / 2);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const px = x + 0.5 - w / 2, py = y + 0.5 - h / 2;
    const qx = Math.abs(px) - (w / 2 - r), qy = Math.abs(py) - (h / 2 - r);
    const ox = Math.max(qx, 0), oy = Math.max(qy, 0);
    const d = Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - r;
    let nx = 0, ny = 0;
    if (qx > 0 && qy > 0) { const l = Math.hypot(ox, oy) || 1; nx = ox / l; ny = oy / l; }
    else if (qx > qy) nx = 1; else ny = 1;
    nx *= Math.sign(px); ny *= Math.sign(py);
    const t = Math.max(0, 1 + d / bezel), k = t * t * (3 - 2 * t);
    const i = (y * w + x) * 4;
    img.data[i] = 128 - nx * k * 127;
    img.data[i + 1] = 128 - ny * k * 127;
    img.data[i + 2] = 128;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c.toDataURL();
}
let filterN = 0;
function glass(el: HTMLElement, strength = 50) {
  const svg = document.getElementById("svgdefs")!;
  const apply = () => {
    const w = Math.round(el.offsetWidth), h = Math.round(el.offsetHeight);
    if (w < 2 || h < 2) return;
    const r = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 12;
    const id = el.dataset.glass || `lg${filterN++}`;
    el.dataset.glass = id;
    svg.querySelector("#" + id)?.remove();
    svg.insertAdjacentHTML("beforeend",
      `<filter id="${id}" x="0" y="0" width="${w}" height="${h}" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
        <feImage href="${glassMap(w, h, Math.min(r, h / 2, w / 2))}" x="0" y="0" width="${w}" height="${h}" result="m"/>
        <feDisplacementMap in="SourceGraphic" in2="m" scale="${strength}" xChannelSelector="R" yChannelSelector="G"/>
      </filter>`);
    el.style.backdropFilter = `url(#${id}) blur(10px) saturate(140%)`;
  };
  new ResizeObserver(apply).observe(el);
  apply();
}

// ── engine ──
const canvas = $<HTMLCanvasElement>("c");
let current = store.raw<AnimalKey>("animal", "butterflies");
if (!ANIMAL_KEYS.includes(current)) current = "butterflies";
const tweaksFor = (k: AnimalKey) => store.raw<Record<string, number | boolean>>("tweaks:" + k, {});
const engine = new AnimalEngine(canvas, { animal: current, theme: "dark", tuning: tweaksFor(current) });

function switchAnimal(k: AnimalKey) {
  if (k === current) return;
  current = k;
  store.set("animal", k);
  sound.pick();
  sound.animal(k);
  canvas.classList.add("swap");
  setTimeout(() => {
    engine.setAnimal(k, tweaksFor(k));
    renderDrawer();
    renderStatus();
    canvas.classList.remove("swap");
  }, 260);
  for (const b of document.querySelectorAll<HTMLElement>(".ani")) b.classList.toggle("on", b.dataset.k === k);
}

// ── greeting + clock ──
const greet = $("greet");
function partOfDay(h: number) {
  return h < 5 ? "Still up" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : h < 22 ? "Good evening" : "Still up";
}
function renderGreeting() {
  const h = new Date().getHours();
  const p = partOfDay(h);
  const q = p === "Still up" ? "?" : "";
  greet.innerHTML = page.name
    ? `${p}, <span class="name" contenteditable spellcheck="false"></span>${q}<span class="cur"></span>`
    : `${p}${q}<span class="cur"></span>`;
  const n = greet.querySelector<HTMLElement>(".name");
  if (n) {
    n.textContent = page.name;
    n.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); n.blur(); } };
    n.onblur = () => { page.name = (n.textContent || "").trim(); savePage(); renderGreeting(); };
  }
}
function renderClock() {
  const d = new Date();
  const t = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: !page.clock24 });
  const day = d.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });
  $("clock").innerHTML = `<b>${t}</b> &nbsp;·&nbsp; ${day}`;
}
let lastPart = "";
setInterval(() => {
  renderClock();
  const p = partOfDay(new Date().getHours());
  if (p !== lastPart && document.activeElement?.className !== "name") { lastPart = p; renderGreeting(); }
}, 1000 * 15);

// ── search: google or ask ai ──
const q = $<HTMLInputElement>("q");
const pill = $("pill");
function renderMode() {
  for (const b of document.querySelectorAll<HTMLElement>("#modes button")) {
    const on = b.dataset.mode === page.mode;
    b.classList.toggle("on", on);
    if (on) { pill.style.left = b.offsetLeft + "px"; pill.style.width = b.offsetWidth + "px"; }
  }
  q.placeholder = page.mode === "google" ? "Search Google or type a URL" : "Ask anything";
}
for (const b of document.querySelectorAll<HTMLElement>("#modes button")) {
  b.onclick = () => { page.mode = b.dataset.mode!; savePage(); renderMode(); sound.mode(); q.focus(); };
}
q.addEventListener("keydown", (e) => {
  if (e.key === "Tab") { e.preventDefault(); page.mode = page.mode === "google" ? "ask" : "google"; savePage(); renderMode(); sound.mode(); return; }
  if (!page.typing || e.metaKey || e.ctrlKey) return;
  if (e.key === "Enter") sound.enter();
  else if (e.key === "Backspace") sound.backspace();
  else if (e.key.length === 1) sound.key();
});
$("search").addEventListener("submit", (e) => {
  e.preventDefault();
  const v = q.value.trim();
  if (!v) return;
  if (page.mode === "ask") location.href = "https://claude.ai/new?q=" + encodeURIComponent(v);
  else if (/^[\w-]+(\.[\w-]+)+(:\d+)?(\/\S*)?$/.test(v)) location.href = "https://" + v;
  else location.href = "https://www.google.com/search?q=" + encodeURIComponent(v);
});

// ── status line ──
function renderStatus() {
  const k = engine.tuning;
  const dir = k.corner ? "↗" : `${Math.round(+k.direction)}°`;
  $("status").innerHTML = `<span>${ANIMALS[current].label.toLowerCase()}</span> · ${dir} · ×${(+k.speed).toFixed(1)}`;
}

// ── drawer ──
const body = $("dbody");
const SIMPLE = ["density", "size", "speed", "direction"];
const DROP = new Set(["grid"]);

function knob(spec: KnobSpec) {
  const v = engine.tuning[spec.key];
  const save = () => {
    const t = tweaksFor(current);
    t[spec.key] = engine.tuning[spec.key];
    store.set("tweaks:" + current, t);
    renderStatus();
  };
  if ("toggle" in spec) {
    const row = document.createElement("label");
    row.className = "swrow";
    row.title = spec.hint;
    row.innerHTML = `<span>${spec.label}</span><input type="checkbox" class="sw" ${v ? "checked" : ""}>`;
    row.querySelector("input")!.onchange = (e) => { const on = (e.target as HTMLInputElement).checked; engine.set(spec.key, on); sound.toggle(on); save(); renderDrawer(); };
    return row;
  }
  const row = document.createElement("label");
  row.className = "knob";
  row.title = spec.hint + "  (double-click to reset)";
  const dec = spec.step < 1 ? 2 : 0;
  const label = spec.label.replace(" (°)", "");
  row.innerHTML = `<span>${label}</span><b></b><input type="range" min="${spec.min}" max="${spec.max}" step="${spec.step}">`;
  const input = row.querySelector("input")!;
  const out = row.querySelector("b")!;
  const show = (x: number) => {
    out.textContent = spec.key === "direction" ? `${Math.round(x)}°` : x.toFixed(dec);
    input.style.setProperty("--p", ((x - spec.min) / (spec.max - spec.min)) * 100 + "%");
  };
  input.value = String(v);
  show(+v);
  if (spec.disabledWhen && engine.tuning[spec.disabledWhen]) row.classList.add("off");
  let lastTick = 0;
  input.oninput = () => {
    engine.set(spec.key, +input.value); show(+input.value); save();
    const now = performance.now();
    if (now - lastTick > 45) { lastTick = now; sound.tick(); }
  };
  row.ondblclick = () => {
    const d = ANIMALS[current].defaults[spec.key] as number;
    engine.set(spec.key, d); input.value = String(d); show(d); save();
  };
  return row;
}

function sec(title: string) {
  const h = document.createElement("div");
  h.className = "sec";
  h.textContent = title;
  body.appendChild(h);
}

function renderDrawer() {
  const scroll = body.scrollTop;
  body.innerHTML = "";
  const a = ANIMALS[current];
  const visible = (s: KnobSpec) => !a.hide?.includes(s.key as never) && !DROP.has(s.key);
  const all = [...SHARED_CONTROLS.movement, ...SHARED_CONTROLS.look].filter(visible);
  const byKey = new Map(all.map((s) => [s.key, s]));

  sec("animal");
  const grid = document.createElement("div");
  grid.id = "animals";
  for (const k of ANIMAL_KEYS) {
    const an = ANIMALS[k];
    const b = document.createElement("button");
    b.className = "ani" + (k === current ? " on" : "");
    b.dataset.k = k;
    b.style.setProperty("--sw", `rgb(${an.swatch.join(",")})`);
    b.innerHTML = `<i>■■□</i>${an.label}`;
    b.onclick = () => switchAnimal(k);
    grid.appendChild(b);
  }
  body.appendChild(grid);

  sec("colour");
  const cw = document.createElement("div");
  cw.id = "colours";
  const sw = `rgb(${a.swatch.join(",")})`;
  const hues = [0, 35, 75, 130, 180, -130, -75, -35];
  const cur = +engine.tuning.hueShift || 0;
  for (const h of hues) {
    const b = document.createElement("button");
    b.className = "col" + (Math.abs(cur - h) < 1 ? " on" : "");
    b.title = h === 0 ? "natural" : `${h > 0 ? "+" : ""}${h}°`;
    b.style.setProperty("--c", sw);
    b.style.filter = `hue-rotate(${h}deg)`;
    b.onclick = () => { setHue(h); };
    cw.appendChild(b);
  }
  const rnd = document.createElement("button");
  rnd.className = "mini";
  rnd.textContent = "shuffle";
  rnd.onclick = () => setHue(Math.round(Math.random() * 360 - 180));
  cw.appendChild(rnd);
  body.appendChild(cw);

  sec("motion");
  for (const key of SIMPLE) { const s = byKey.get(key); if (s) body.appendChild(knob(s)); }
  const corner = byKey.get("corner");
  if (corner) body.appendChild(knob(corner));

  for (const [title, knobs] of a.controls) {
    sec(title.toLowerCase());
    for (const s of knobs) body.appendChild(knob(s));
  }

  const more = document.createElement("details");
  more.open = store.raw("more", false);
  more.ontoggle = () => store.set("more", more.open);
  more.innerHTML = `<summary>fine tuning</summary>`;
  for (const s of all) if (!SIMPLE.includes(s.key) && s.key !== "corner") more.appendChild(knob(s));
  body.appendChild(more);

  sec("page");
  const nameRow = document.createElement("div");
  nameRow.className = "field";
  nameRow.innerHTML = `<label for="nm">Your name</label><input id="nm" class="txt" placeholder="for the greeting" maxlength="24">`;
  const nm = nameRow.querySelector("input")!;
  nm.value = page.name;
  nm.oninput = () => { page.name = nm.value.trim(); savePage(); renderGreeting(); };
  body.appendChild(nameRow);

  const themeRow = document.createElement("div");
  themeRow.className = "field";
  themeRow.innerHTML = `<label>Accent</label><div id="themes"></div>`;
  const tw = themeRow.querySelector("#themes")!;
  for (const [id, [hex]] of Object.entries(THEMES)) {
    const b = document.createElement("button");
    b.className = "th" + (page.theme === id ? " on" : "");
    b.title = id;
    b.style.setProperty("--c", hex);
    b.onclick = () => { page.theme = id; savePage(); applyTheme(); for (const x of tw.children) x.classList.toggle("on", x === b); };
    tw.appendChild(b);
  }
  body.appendChild(themeRow);

  const pageSwitch = (key: keyof typeof page, label: string, after?: () => void) => {
    const row = document.createElement("label");
    row.className = "swrow";
    row.innerHTML = `<span>${label}</span><input type="checkbox" class="sw" ${page[key] ? "checked" : ""}>`;
    row.querySelector("input")!.onchange = (e) => {
      const on = (e.target as HTMLInputElement).checked;
      (page as any)[key] = on;
      savePage(); applyPage(); after?.(); sound.toggle(on);
    };
    body.appendChild(row);
  };
  pageSwitch("greeting", "Greeting");
  pageSwitch("clock24", "24-hour clock", renderClock);
  pageSwitch("search", "Search bar");
  pageSwitch("keys", "Keyboard hints");
  pageSwitch("status", "Status line");

  sec("sound");
  pageSwitch("sound", "Sound", () => sound.set({ enabled: page.sound }));
  pageSwitch("ambient", "Nature sounds", () => sound.set({ ambient: page.ambient }));
  pageSwitch("typing", "Typing sounds");
  const vol = knob({ key: "__vol", label: "Volume", min: 0, max: 1, step: 0.05, hint: "How loud everything is." } as KnobSpec);
  const vi = vol.querySelector("input")!;
  const vb = vol.querySelector("b")!;
  const showV = (x: number) => { vb.textContent = Math.round(x * 100) + "%"; vi.style.setProperty("--p", x * 100 + "%"); };
  vi.value = String(page.volume); showV(page.volume);
  vi.oninput = () => { page.volume = +vi.value; savePage(); sound.set({ volume: page.volume }); showV(page.volume); };
  vol.ondblclick = null;
  body.appendChild(vol);
  const pv = document.createElement("button");
  pv.className = "mini";
  pv.style.margin = "4px 0 0";
  pv.textContent = "▶ hear " + a.label.toLowerCase();
  pv.onclick = () => { sound.unlock(); sound.preview(); };
  body.appendChild(pv);
  const hint = document.createElement("p");
  hint.className = "hint";
  hint.textContent = "Double-click any slider to reset it. Settings are kept per animal.";
  body.appendChild(hint);
  body.scrollTop = scroll;
}

function setHue(h: number) {
  engine.set("hueShift", h);
  const t = tweaksFor(current);
  t.hueShift = h;
  store.set("tweaks:" + current, t);
  sound.pick();
  renderDrawer();
}

// ── page state ──
function savePage() { store.set("page", page); }
function applyTheme() {
  const [hex, rgb] = THEMES[page.theme] || THEMES.ice;
  document.documentElement.style.setProperty("--accent", hex);
  document.documentElement.style.setProperty("--accent-rgb", rgb);
}
function applyPage() {
  $("hero").classList.toggle("hide-search", !page.search);
  $("keys").style.display = page.keys && page.search ? "" : "none";
  $("status").style.opacity = page.status ? "1" : "0";
  $("greet").style.display = page.greeting ? "" : "none";
}
const setOpen = (o: boolean) => {
  if (o !== document.body.classList.contains("open")) (o ? sound.open : sound.close)();
  document.body.classList.toggle("open", o);
  if (!o) q.focus({ preventScroll: true });
};
$("open").onclick = () => setOpen(true);
$("close").onclick = () => setOpen(false);
$("scrim").onclick = () => setOpen(false);
$("reset").onclick = () => {
  store.set("tweaks:" + current, {});
  engine.setAnimal(current);
  renderDrawer();
  renderStatus();
};
// Click the water/sky: an ASCII ripple spreads out from the spot, and the animals react their own way.
canvas.addEventListener("pointerdown", (e) => {
  const x = e.clientX, y = e.clientY;
  sound.tap(current);
  for (let i = 0; i < 7; i++) {
    setTimeout(() => {
      const r = 2 + i * 2.2;
      const n = Math.round(6 + r * 3);
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2;
        engine.splash(x + Math.cos(a) * r * 9, y + Math.sin(a) * r * 9, 1, 0.9 - i * 0.11);
      }
    }, i * 70);
  }
});

addEventListener("keydown", (e) => {
  const el = e.target as HTMLElement;
  const typing = el.matches("textarea,[contenteditable]") || (el.matches("input") && ((el as HTMLInputElement).type !== "text" || (el as HTMLInputElement).value !== ""));
  if (!typing && (e.key === "ArrowLeft" || e.key === "ArrowRight") && !e.metaKey && !e.altKey) {
    e.preventDefault();
    const i = ANIMAL_KEYS.indexOf(current);
    switchAnimal(ANIMAL_KEYS[(i + (e.key === "ArrowRight" ? 1 : -1) + ANIMAL_KEYS.length) % ANIMAL_KEYS.length]);
    return;
  }
  if (e.key === "Escape") setOpen(false);
  else if (!typing && e.key === "/") { e.preventDefault(); q.focus(); }
  else if (!typing && e.key === ".") setOpen(!document.body.classList.contains("open"));
});

applyTheme();
applyPage();
renderClock();
renderGreeting();
lastPart = partOfDay(new Date().getHours());
sound.animal(current);
renderDrawer();
renderStatus();
requestAnimationFrame(renderMode);
for (const el of document.querySelectorAll<HTMLElement>(".glass")) glass(el);
