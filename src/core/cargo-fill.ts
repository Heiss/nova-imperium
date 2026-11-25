// The cargo buttons of the fleet form (#240) as one rule for the browser and
// the server (#407, owner, 2026-11-25, O31): „alles (gleichmäßig)“ fills the
// holds evenly, an „alles“ under a field fills its resource up to the room
// the other fields leave. The browser shows the amounts as a preview; the
// form sends the intent (`CargoIntent`), and the server computes the amounts
// again from its stock at the launch, so a stock that changed meanwhile
// neither refuses the launch nor loads other amounts than „alles“ means.
import type { Resources } from './types.ts';

type Key = keyof Resources;
/** The resources a fleet carries, in the order of the cargo fields. */
const CARGO_KEYS: readonly Key[] = ['m', 'c', 'd'];

/**
 * What the buttons asked for: `even` for „alles (gleichmäßig)“, or the
 * resources whose „alles“ was pressed, in the order of the clicks. A field
 * typed by hand is a number and is not in it.
 */
export type CargoIntent = 'even' | readonly Key[];

/** What a planet can load on a flight: whole units, Promethium after the fuel. */
export const loadableStock = (res: Resources, fuel: number): Resources => ({
  m: Math.floor(res.m),
  c: Math.floor(res.c),
  d: Math.max(0, Math.floor(res.d - fuel)),
});

/**
 * Equal shares of the room (#240), the resource with the least stock first:
 * what it cannot fill goes to the others. A share is rounded up, so the room
 * is used fully when the stock allows.
 */
export function fillEvenly(stock: Resources, room: number): Resources {
  const out = { m: 0, c: 0, d: 0 };
  const order = [...CARGO_KEYS].sort((a, b) => stock[a] - stock[b]);
  order.forEach((k, i) => {
    out[k] = Math.min(stock[k], Math.ceil(room / (order.length - i)));
    room -= out[k];
  });
  return out;
}

/** „alles“ under a field: its resource up to the room the other fields leave. */
export function fillOne(
  stock: Resources,
  room: number,
  cargo: Resources,
  key: Key,
): number {
  const others = CARGO_KEYS.reduce(
    (sum, k) => (k === key ? sum : sum + cargo[k]),
    0,
  );
  return Math.max(0, Math.min(stock[key], room - others));
}

/** The intent as sent, or null for none or for anything else. */
export function cargoIntentOf(raw: unknown): CargoIntent | null {
  if (raw === 'even') return 'even';
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const keys = raw.filter((k): k is Key => CARGO_KEYS.includes(k as Key));
  return keys.length === raw.length && new Set(keys).size === keys.length
    ? keys
    : null;
}

/**
 * The cargo of a launch: the numbers typed, with the fields of the intent
 * computed on `stock` (what can be loaded: whole units, Promethium after
 * the fuel) and `room` (the capacity of the ships), in the order of the
 * clicks.
 */
export function resolveCargo(
  stock: Resources,
  room: number,
  typed: Resources,
  intent: CargoIntent | null,
): Resources {
  if (intent === 'even') return fillEvenly(stock, room);
  const cargo = { ...typed };
  for (const k of intent ?? []) cargo[k] = fillOne(stock, room, cargo, k);
  return cargo;
}

/**
 * The intent after an „alles“ under the field `key`: the even fill becomes
 * the numbers it showed, and `key` is asked for last.
 */
export const askOne = (intent: CargoIntent | null, key: Key): CargoIntent => [
  ...(Array.isArray(intent) ? intent.filter((k) => k !== key) : []),
  key,
];

/**
 * The intent after the field `key` was typed by hand: that field is a
 * number again; after the even fill all three are (the player changed what
 * it showed). Null when no field is left to compute.
 */
export function typedCargo(
  intent: CargoIntent | null,
  key: Key,
): CargoIntent | null {
  if (!Array.isArray(intent)) return null;
  const rest = intent.filter((k) => k !== key);
  return rest.length ? rest : null;
}
