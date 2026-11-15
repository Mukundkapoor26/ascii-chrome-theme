import type { Animal } from "../flock";
import { butterflies } from "./butterflies";
import { koi } from "./koi";
import { jellyfish } from "./jellyfish";
import { dragonflies } from "./dragonflies";
import { frogs } from "./frogs";
import { cranes } from "./cranes";
import { crabs } from "./crabs";
import { mantas } from "./mantas";
import { swallows } from "./swallows";
import { fireflies } from "./fireflies";
import { turtles } from "./turtles";
import { moths } from "./moths";
import { hummingbirds } from "./hummingbirds";
import { bats } from "./bats";

/** Every animal, in the order the choices show them. */
export const ANIMALS = {
  butterflies, jellyfish, koi, swallows, mantas, fireflies, moths, turtles, dragonflies, frogs, cranes, crabs, hummingbirds, bats,
} satisfies Record<string, Animal<any>>;
export type AnimalKey = keyof typeof ANIMALS;
export const ANIMAL_KEYS = Object.keys(ANIMALS) as AnimalKey[];
