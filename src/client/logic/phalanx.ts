// The Auspex-Phalanx on the Sternenkarte (#53, owner, 2026-11-15): the scan
// is offered at a foreign planet row when the active place is a moon with a
// phalanx and the planet is in range (`scanReach` of the core, as the server
// checks it), and its answer shows in a panel there: per flight its ships,
// origin, target and arrival, by arrival.
import { placeName } from '../../core/moon.ts';
import { type ScannedFlight, scanReach } from '../../core/phalanx.ts';
import { parsePlaceId } from '../../core/place.ts';
import { text } from '../../core/text.ts';
import type { Levels, Planet } from '../../core/types.ts';
import { coords, fmt } from './format.ts';
import type { GalaxyPlanet } from './types.ts';

/** The answer of a scan: the moon it came from, the planet and its flights. */
export interface Scan {
  by: string;
  target: string;
  flights: ScannedFlight[];
}

const isRecord = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null;

const isFlight = (x: unknown): x is ScannedFlight =>
  isRecord(x) &&
  isRecord(x.ships) &&
  typeof x.from === 'string' &&
  typeof x.to === 'string' &&
  typeof x.arr === 'number';

/** The scan in the data of an action's answer, or null when there is none. */
export function scanOf(data: unknown): Scan | null {
  const s = isRecord(data) ? data.scan : null;
  if (!isRecord(s) || typeof s.by !== 'string') return null;
  if (typeof s.target !== 'string' || !Array.isArray(s.flights)) return null;
  if (!s.flights.every(isFlight)) return null;
  return { by: s.by, target: s.target, flights: s.flights };
}

/** Whether the Sternenkarte offers the scan of a foreign planet from `here`. */
export const canScan = (here: Planet, pl: GalaxyPlanet): boolean =>
  pl.kind === 'planet' &&
  scanReach(here, {
    place: { kind: 'planet', g: pl.g, s: pl.s, p: pl.p },
    owner: pl.owner,
  }) === null;

/** The ships of a flight with their names, in the order they came. */
export const shipsText = (ships: Levels): string =>
  Object.entries(ships)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${fmt(n)} ${text(k)?.n ?? k}`)
    .join(', ');

/** A place of a flight: its coordinates, a moon marked as such. */
export function placeText(id: string): string {
  const place = parsePlaceId(id);
  if (!place) return '[?]';
  return place.kind === 'moon' ? `${coords(place)} (Mond)` : coords(place);
}

/** One row of the panel. */
export interface ScanRow {
  ships: string;
  from: string;
  to: string;
  arr: number;
}

export const scanRows = (scan: Scan): ScanRow[] =>
  scan.flights.map((f) => ({
    ships: shipsText(f.ships),
    from: placeText(f.from),
    // A fleet that holds there shows so, until its holding ends (#55).
    to: f.holds ? `hält bei ${placeText(f.to)}` : placeText(f.to),
    arr: f.arr,
  }));

/** The heading of the panel: the scanned planet by its name, if known. */
export function scanTitle(scan: Scan, galaxy: readonly GalaxyPlanet[]): string {
  const planet = galaxy.find((x) => x.id === scan.target);
  const where = placeText(scan.target);
  return planet
    ? `Phalanx-Scan: ${placeName(planet)} ${where}`
    : `Phalanx-Scan: ${where}`;
}
