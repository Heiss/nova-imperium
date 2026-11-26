// The cargo buttons of the fleet form (#240) as one rule for the browser and
// the server (#407, owner, 2026-11-25, O31): „alles (gleichmäßig)“ fills the
// holds evenly, an „alles“ under a field fills its resource up to the room
// the other fields leave; only the newest „alles“ stays computed (159b). The
// browser shows the amounts as a preview; the
// form sends the intent (`CargoIntent`), and the server computes the amounts
// again from its stock at the launch, so a stock that changed meanwhile
// neither refuses the launch nor loads other amounts than „alles“ means.
import type { Resources } from './types.ts';

type Key = keyof Resources;
/** The resources a fleet carries, in the order of the cargo fields. */
const CARGO_KEYS: readonly Key[] = ['m', 'c', 'd'];

/**
 * What the buttons asked for: `even` for „alles (gleichmäßig)“, or the one
 * resource whose „alles“ was pressed last (owner, 2026-11-26, 159b): a click
 * on another „alles“ turns the earlier one into the number it showed, as
 * the even fill does. A field typed by hand is a number and is not in it.
 */
export type CargoIntent = 'even' | readonly [Key];

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

/** The intent as sent, or null for none or for anything else (also more than one field). */
export function cargoIntentOf(raw: unknown): CargoIntent | null {
  if (raw === 'even') return 'even';
  if (!Array.isArray(raw) || raw.length !== 1) return null;
  const [key] = raw as unknown[];
  return CARGO_KEYS.includes(key as Key) ? [key as Key] : null;
}

/**
 * The cargo of a launch: the numbers typed, with the field of the intent
 * computed on `stock` (what can be loaded: whole units, Promethium after
 * the fuel) and `room` (the capacity of the ships), up to the room the other
 * fields leave; the even fill on the stock alone. The field of the intent
 * depends only on the other fields, never on what it held, so computing it
 * again gives the same cargo (CodeRabbit on #421).
 */
export function resolveCargo(
  stock: Resources,
  room: number,
  typed: Resources,
  intent: CargoIntent | null,
): Resources {
  if (intent === 'even') return fillEvenly(stock, room);
  if (!intent) return { ...typed };
  const [key] = intent;
  return { ...typed, [key]: fillOne(stock, room, typed, key) };
}

/**
 * The intent after an „alles“ under the field `key`: only `key` (159b); the
 * even fill or an earlier „alles“ becomes the numbers it showed.
 */
export const askOne = (key: Key): CargoIntent => [key];

/**
 * The intent after the field `key` was typed by hand: that field is a
 * number again; after the even fill all three are (the player changed what
 * it showed). Another field of „alles“ stays computed.
 */
export const typedCargo = (
  intent: CargoIntent | null,
  key: Key,
): CargoIntent | null =>
  Array.isArray(intent) && intent[0] !== key ? intent : null;
