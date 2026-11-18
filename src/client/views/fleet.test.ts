// The fleet form for the expeditions (#93): the position field takes the
// expedition position, the row „Haltezeit“ shows only for a mission that
// stays, and the title counts the expeditions against their slots.
import { describe, expect, it } from 'vitest';
import { planet, U } from '../../test/fixtures.ts';
import type { ClientFleet, GameState } from '../logic/types.ts';
import { fleet } from './fleet.ts';
import type { Ui, V } from './common.ts';

const out = (
  id: string,
  mission: ClientFleet['mission'],
  owner = 'u1',
): ClientFleet => ({
  id,
  owner,
  fromC: { g: 1, s: 1, p: 5 },
  toC: { g: 1, s: 2, p: 16 },
  to: 'p1_2_16',
  mission,
  state: 'out',
  arr: 5000,
  ships: { lc: 1 },
});

function view(
  research: Record<string, number>,
  fleets: ClientFleet[] = [],
  fm?: string,
): V {
  const s = {
    cfg: U,
    me: { id: 'u1', probes: 1 },
    players: { u1: { name: 'Anna', points: 1 } },
    galaxy: [],
    debris: [],
    fleets,
  } as unknown as GameState;
  return {
    s,
    P: planet({ ships: { lc: 5 } }),
    R: { research, rq: null },
    now: 0,
    ui: { gal: 1, sys: 1, ...(fm ? { fm } : {}) } as Ui,
  };
}

describe('the fleet form', () => {
  it('takes the position after the last planet position', () => {
    expect(fleet(view({}))).toContain('min="1" max="16" aria-label="Position"');
    const wide = view({});
    wide.s.cfg = { ...U, positions: 20 };
    expect(fleet(wide)).toContain('min="1" max="21" aria-label="Position"');
  });

  it('offers the mission Expedition', () => {
    expect(fleet(view({ expo: 1 }))).toContain(
      '<option value="expedition" >Expedition</option>',
    );
  });

  it('shows the stay only while an expedition is the mission picked', () => {
    const row = (html: string) => /<tr id="t_hold"[^>]*>/.exec(html)![0];
    expect(row(fleet(view({ expo: 4 })))).toContain('hidden');
    expect(row(fleet(view({ expo: 4 }, [], 'transport')))).toContain('hidden');
    expect(row(fleet(view({ expo: 4 }, [], 'expedition')))).not.toContain(
      'hidden',
    );
  });

  it('asks for hours from 1 up to the level, at least 1', () => {
    expect(fleet(view({ expo: 4 }, [], 'expedition'))).toContain(
      'type="number" id="t_h" min="1" max="4" value="1" aria-label="Haltezeit in Stunden"> Stunden am Ziel',
    );
    expect(fleet(view({ expo: 9 }, [], 'expedition'))).toContain('max="9"');
    expect(fleet(view({}, [], 'expedition'))).toContain(
      'id="t_h" min="1" max="1"',
    );
  });

  it('counts the own expeditions against the slots of the level, in the title', () => {
    const fleets = [
      out('a', 'expedition'),
      out('b', 'transport'),
      out('c', 'expedition', 'u2'),
    ];
    expect(fleet(view({ expo: 4, computer: 2 }, fleets))).toContain(
      'Flotten unterwegs (2 / 3 Slots) · Expeditionen (1 / 2)',
    );
    expect(fleet(view({ expo: 1 }, []))).toContain(
      'Flotten unterwegs (0 / 1 Slots) · Expeditionen (0 / 1)',
    );
    // Without the research no word about expeditions.
    expect(fleet(view({}, fleets))).not.toContain('Expeditionen (');
    expect(fleet(view({ expo: 0 }, fleets))).not.toContain('Expeditionen (');
  });
});
