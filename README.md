# ASCII Chrome Theme

A Chrome new tab that's alive. Fourteen animals drawn in ASCII drift across a jet-black page, with a greeting, a search bar and soft nature sounds.

**Live preview:** https://mukundkapoor.com/projects/ascii-browser-theme/

## Features

- **14 animals:** butterfly, jellyfish, koi, swallow, manta, firefly, luna moth, sea turtle, dragonfly, frog, crane, crab, hummingbird and bat. Each one moves the way the real animal does.
- **Interactive:** click the scene and an ASCII ripple spreads out. Koi swim over to eat, crabs bolt, frogs leap and butterflies scatter.
- **Keyboard:** `←` `→` switch animal (not while you're typing), `/` focuses search, `.` opens tweaks, `Tab` switches between Google and Ask AI, `Esc` closes.
- **Search:** Google search or URL, or ask AI.
- **Greeting:** "Good morning / afternoon / evening" with your name, and a clock.
- **Sound:** a quiet nature backdrop and calls for every animal, plus soft key clicks while you type. Everything is synthesised with Web Audio, so there are no audio files.
- **Tweaks:** six accent colours, colour presets per animal, density, size, speed, direction, and fine tuning. Settings are saved per animal.

## Install

1. Download this repo (Code → Download ZIP) and unzip it.
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and pick the folder.
4. Open a new tab.

## Develop

The page is `newtab.html`. Its script, `zoo.js`, is bundled from `src/`:

```bash
npx esbuild src/main.ts --bundle --format=iife --target=chrome110 --outfile=zoo.js
```

- `src/animals/`: one file per animal (shape, colours, motion).
- `src/sound.ts`: all sound.
- `src/main.ts`: the page and the tweaks drawer.

## Credits

The ASCII renderer and flocking engine (`src/engine.ts`, `flock.ts`, `renderer.ts`, `ink.ts`, `math.ts`, `animals/shapes.ts`) and the butterfly, koi, jellyfish, dragonfly, frog, crane and crab animals come from [ascii-animals](https://github.com/DesignerStephen1/ascii-animals) by drewdi, under the MIT licence (see `LICENSE-ascii-animals`). The swallow, manta, firefly, luna moth, sea turtle, hummingbird and bat animals, the sound, and the page design are new.

## Licence

MIT
