// The Mondbruch in the battle report (#95; owner, 2026-11-13, the decided
// wording): the attacker reads both rolls with their chances, the owner of
// a broken moon that it is gone.
import type { Coords } from '../../core/types.ts';
import { coords } from './format.ts';

/** A chance in % as the report shows it: German, at most two decimals [V]. */
export const chanceText = (chance: number): string =>
  chance.toLocaleString('de-DE', { maximumFractionDigits: 2 });

interface Rolls {
  chance: number;
  broken: boolean;
  loss: number;
  lost: boolean;
}

const isRolls = (x: unknown): x is Rolls =>
  typeof x === 'object' &&
  x !== null &&
  typeof (x as Rolls).chance === 'number' &&
  typeof (x as Rolls).loss === 'number';

/** The lines of the rolls; none when the report has none. */
function rollLines(x: unknown): string[] {
  if (!isRolls(x)) return [];
  const moon = x.broken
    ? `Der Mond ist zerbrochen (Chance ${chanceText(x.chance)} %).`
    : `Der Mond hält stand (Chance ${chanceText(x.chance)} %).`;
  return x.lost
    ? [
        moon,
        `Die Weltenbrecher wurden vom eigenen Schuss zerrissen (Chance ${chanceText(x.loss)} %).`,
      ]
    : [moon];
}

/** The lines of a battle report about a Mondbruch. */
export function moonbreakLines(r: Readonly<Record<string, unknown>>): string[] {
  const lost =
    r.moonLost === true
      ? [`Dein Mond bei ${coords(r.coords as Coords)} wurde zerstört.`]
      : [];
  return [...rollLines(r.moonbreak), ...lost];
}
