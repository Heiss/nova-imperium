// The scan of the Auspex-Phalanx (#53, okf/features/moons.md; owner,
// 2026-11-13 and 2026-11-15): from the active moon to a foreign planet in
// range. The checks are `scanError` of src/core/phalanx.ts; a refusal costs
// nothing, a scan costs 5,000 Promethium on the moon in the transaction of
// the action, also when no fleet is on its way. The scanned player gets no
// report and no push; only the audit log of the admin records the scan.
import { pay } from '../../core/economy.ts';
import {
  SCAN_PRICE,
  type ScanError,
  scanError,
  scanFlights,
} from '../../core/phalanx.ts';
import { parsePlaceId, placeId } from '../../core/place.ts';
import { type Action, mine } from './actions.ts';
import { fail } from './context.ts';
import type { ServerFeature } from './feature.ts';

/** The German message of each refusal [V]. */
export const SCAN_ERROR: Readonly<Record<ScanError, string>> = {
  notMoon: 'Ein Phalanx-Scan ist nur von einem Mond aus möglich.',
  noPhalanx: 'Auf diesem Mond steht keine Auspex-Phalanx.',
  outOfRange: 'Das Ziel liegt außerhalb der Reichweite der Auspex-Phalanx.',
  free: 'An dieser Position gibt es keinen Planeten.',
  moon: 'Monde lassen sich nicht erfassen.',
  notPlanet: 'Nur Planeten lassen sich erfassen.',
  own: 'Eigene Planeten lassen sich nicht erfassen.',
  cost: 'Nicht genug Promethium für den Phalanx-Scan.',
};

/**
 * Scans the place `d.target` (an id such as `p1_2_3`) from the active place
 * `d.planet` and answers its flights, by arrival, as `data.scan`.
 */
const scan: Action = (ctx, u, d, event) => {
  const moon = mine(ctx, u, d.planet);
  const place = parsePlaceId(String(d.target)) ?? fail('Unbekanntes Ziel.');
  const target = placeId(place);
  // The owner of the planet there; a moon or a Trümmerfeld is refused by
  // its kind before the owner counts.
  const owner = ctx.planets.get(target)?.owner;
  const error = scanError(moon, { place, owner });
  if (error) fail(SCAN_ERROR[error]);
  pay(moon, SCAN_PRICE);
  ctx.planets.save(moon);
  const flights = scanFlights(ctx.fleets.all(), target);
  if (event)
    event.detail = { planet: moon.id, target, flights: flights.length };
  return { msg: null, data: { scan: { by: moon.id, target, flights } } };
};

export const serverFeature = {
  actions: { scan },
} satisfies ServerFeature;
