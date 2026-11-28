// „Bereit“: „Bauschleife leer“ for the other own places the server named
// (`idle`), worded from the galaxy; a place the galaxy does not list is left
// out. At most `MOST_IDLE` lines, then „und N weitere“ (#189, D5).
import { placeName } from '../../../core/moon.ts';
import { coords } from '../format.ts';
import type { CardItem, OverviewLines } from './contract.ts';

/** The most places with an empty build queue the card names; the rest is counted. */
export const MOST_IDLE = 3;

export const overviewLines: readonly OverviewLines[] = [
  {
    card: 'ready',
    order: 30,
    keys: ['idle', 'more-idle'],
    lines: ({ s }) => {
      const places = (s.idle ?? []).flatMap((id) => {
        const p = s.galaxy.find((x) => x.id === id);
        return p ? [{ id, text: `${placeName(p)} ${coords(p)}` }] : [];
      });
      const items: CardItem[] = places.slice(0, MOST_IDLE).map((p) => ({
        key: `idle:${p.id}`,
        text: `Bauschleife leer: ${p.text}`,
        select: { id: p.id, label: 'Wechseln' },
      }));
      if (places.length > MOST_IDLE)
        items.push({
          key: 'more-idle',
          text: `und ${places.length - MOST_IDLE} weitere`,
        });
      return items;
    },
  },
];
