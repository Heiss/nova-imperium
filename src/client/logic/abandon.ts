// „Kolonie aufgeben“ in the overview (#224, okf/features/abandon-colony.md):
// the button and its confirmation with the coordinates, the losses, the
// lock of the position and the password, like „Account löschen“. The
// browser asks only `abandonTargetError` (an own planet, not the main
// planet, D3); the server checks everything and words every refusal.
import { abandonTargetError, positionLocked } from '../../core/abandon.ts';
import type { Coords, Levels } from '../../core/types.ts';
import { coords, esc, fmt, resLine } from './format.ts';
import { lockEnd } from './main-planet.ts';
import { moonAt } from './moon.ts';
import type { GameState } from './types.ts';

type Shown = Pick<GameState, 'me' | 'mainPlanet' | 'galaxy' | 'round'>;
type Target = NonNullable<GameState['planet']>;

/** Whether the overview offers „Kolonie aufgeben“: an own planet that is not the main planet. */
export const abandonOffered = (P: Target, s: Shown): boolean =>
  abandonTargetError(P, s.me.id, s.mainPlanet ?? null) === null;

const sum = (l: Levels): number => Object.values(l).reduce((a, n) => a + n, 0);

const plural = (n: number, one: string, many: string): string =>
  `${fmt(n)} ${n === 1 ? one : many}`;

/** What is lost with the planet, one line each (Q1). */
export function abandonLosses(P: Target, s: Shown): string[] {
  const moon = moonAt(s.galaxy, P);
  return [
    `Gebäude: ${plural(sum(P.b), 'Stufe', 'Stufen')}`,
    `Schiffe: ${fmt(sum(P.ships))}`,
    `Verteidigung: ${fmt(sum(P.def))}`,
    `Rohstoffe: ${resLine(P.res)}`,
    ...(moon ? [`der Mond „${esc(moon.name)}“ mit allem, was darauf ist`] : []),
  ];
}

/** The confirmation: the exact target, the losses, the lock and the password. */
export function abandonDialog(P: Target, s: Shown): string {
  const losses = abandonLosses(P, s)
    .map((x) => `<li>${x}</li>`)
    .join('');
  return `<form id="abandonform" data-target="${esc(P.id)}"><p><b>Kolonie aufgeben</b></p><p>${esc(P.name)} ${coords(P)} wird aufgegeben. Dabei geht verloren:</p><ul>${losses}</ul><p>Die Position ${coords(P)} ist danach ${plural(s.round.abandonLock, 'Stunde', 'Stunden')} lang gesperrt.</p><p><b>Diese Aktion kann nicht rückgängig gemacht werden.</b></p><p><label for="abandon-password">Passwort zur Bestätigung</label> <input id="abandon-password" type="password" autocomplete="current-password" required></p><button class="red" type="submit">Kolonie aufgeben</button> <button type="button" data-act="closeModal">Abbrechen</button></form>`;
}

/**
 * A free position of the Sternenkarte (#224, owner, 2026-11-17): while it
 * is locked after an abandonment it says until when and offers no
 * Landnahme; the server refuses one anyway.
 */
export function freePosition(
  locks: GameState['locks'],
  c: Coords,
  now: number,
): { note: string; colonize: boolean } {
  const lock = (locks ?? []).find(
    (l) => l.g === c.g && l.s === c.s && l.p === c.p,
  );
  return lock && positionLocked(lock.until, now)
    ? { note: `gesperrt bis ${lockEnd(lock.until)}`, colonize: false }
    : { note: '–', colonize: true };
}
