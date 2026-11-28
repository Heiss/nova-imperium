// „Achtung“: the hostile fleets on their way to the shown place (#189, D5).
import { MISSION } from '../../../core/missions.ts';
import type { Mission } from '../../../core/types.ts';
import { coords } from '../format.ts';
import { fleetEnd, nameOf, sortFleets } from '../game.ts';
import { countdown } from '../overview.ts';
import type { CardItem, OverviewLines } from './contract.ts';

/**
 * The missions that are an attack on the way: the Sturmangriff, the
 * Mondbruch and the missiles. A spy, a transport or a holding fleet is none.
 */
const HOSTILE: ReadonlySet<Mission> = new Set([
  'attack',
  'moonbreak',
  'missile',
]);

/** The most incoming attacks the card names; the rest is counted. */
export const MOST_ATTACKS = 3;

export const overviewLines: readonly OverviewLines[] = [
  {
    card: 'attention',
    order: 10,
    keys: ['fleet', 'more-fleets'],
    lines: ({ s, now }) => {
      const incoming = sortFleets(
        s.fleets.filter(
          (f) =>
            f.owner !== s.me.id && f.state === 'out' && HOSTILE.has(f.mission),
        ),
      );
      const items: CardItem[] = incoming.slice(0, MOST_ATTACKS).map((f) => ({
        key: `fleet:${f.id}`,
        text: `${MISSION[f.mission]} von ${nameOf(s.players, f.owner)} ${coords(f.fromC)}`,
        due: countdown(fleetEnd(f), now),
      }));
      if (incoming.length > MOST_ATTACKS)
        items.push({
          key: 'more-fleets',
          text: `und ${incoming.length - MOST_ATTACKS} weitere Flotten`,
          link: { view: 'fleet', label: 'Zur Flotte' },
        });
      return items;
    },
  },
];
