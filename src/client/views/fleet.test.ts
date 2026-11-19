// The fleet form for the expeditions (#93): the position field takes the
// expedition position, the row „Haltezeit“ shows only for a mission that
// stays, and the title counts the expeditions against their slots.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { planet, U } from '../../test/fixtures.ts';
import type { ClientFleet, GameState } from '../logic/types.ts';
import { fleet, realStay, timeRow } from './fleet.ts';
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

  it('shows the stay of an expedition and the holding time of a Halten in rows of their own, never both', () => {
    const rows = (html: string) => ({
      hold: /<tr id="t_hold"[^>]*>/.exec(html)?.[0],
      stay: /<tr id="t_stay_row"[^>]*>/.exec(html)?.[0],
    });
    // No mission picked or another one: the holding time, hidden; no stay.
    for (const fm of [undefined, 'transport'] as const) {
      const html = fleet(view({ expo: 4 }, [], fm));
      expect(rows(html).hold, String(fm)).toContain('hidden');
      expect(rows(html).stay, String(fm)).toBeUndefined();
      expect(html).not.toContain('id="t_stay"');
    }
    // A Halten: the holding time, shown; no stay.
    const hold = fleet(view({ expo: 4 }, [], 'hold'));
    expect(rows(hold).hold).not.toContain('hidden');
    expect(rows(hold).stay).toBeUndefined();
    // An expedition: the stay, shown, and no field of the holding time (no label twice).
    const expedition = fleet(view({ expo: 4 }, [], 'expedition'));
    expect(rows(expedition).stay).toBeDefined();
    expect(rows(expedition).stay).not.toContain('hidden');
    expect(rows(expedition).hold).toBeUndefined();
    expect(expedition).not.toContain('id="t_h"');
    expect(expedition.match(/aria-label="Haltezeit/g)).toHaveLength(1);
  });

  it('asks for hours from 1 up to the level, at least 1', () => {
    expect(fleet(view({ expo: 4 }, [], 'expedition'))).toContain(
      'type="number" id="t_stay" min="1" max="4" value="1" aria-label="Haltezeit in Stunden"> Stunden am Ziel',
    );
    expect(fleet(view({ expo: 9 }, [], 'expedition'))).toContain('max="9"');
    expect(fleet(view({}, [], 'expedition'))).toContain(
      'id="t_stay" min="1" max="1"',
    );
  });

  it('takes the hours per level and the extra places of the round into the form and the title', () => {
    const v = view({ expo: 4 }, [out('a', 'expedition')], 'expedition');
    v.s.cfg = {
      ...U,
      roundExpeditionHours: 6,
      roundExpeditionExtraSlots: 2,
    };
    const html = fleet(v);
    expect(html).toContain('id="t_stay" min="1" max="24"');
    expect(html).toContain('Expeditionen (1 / 4)');
    // Without the research the settings add nothing.
    const none = view({}, [], 'expedition');
    none.s.cfg = v.s.cfg;
    expect(fleet(none)).not.toContain('Expeditionen (');
  });

  it('says the real time of a stay beside it only when the speed divides it', () => {
    expect(realStay(3, U)).toBe('');
    const fast = { ...U, speed: 5, roundExpeditionSpeed: 1 };
    expect(realStay(5, fast)).toBe(
      'entspricht 1h 00m 00s (durch Tempo 5 geteilt)',
    );
    expect(realStay(1, fast)).toBe(
      'entspricht 12m 00s (durch Tempo 5 geteilt)',
    );
    // No hours, no text.
    expect(realStay(0, fast)).toBe('');
    expect(realStay(Number.NaN, fast)).toBe('');
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

/** The little of the page `timeRow` touches: the row of the time at the target, its field and the note. */
function page(rowId: 't_hold' | 't_stay_row', hours = '') {
  const row = { id: rowId, hidden: false, outerHTML: '' };
  const real = { textContent: '' };
  const field = { value: hours };
  vi.stubGlobal('document', {
    querySelector: (sel: string) =>
      sel === '#t_hold, #t_stay_row' ? row : null,
    getElementById: (id: string) =>
      id === 't_real' ? real : id === 't_stay' ? field : null,
  });
  return { row, real };
}

describe('the row of the time at the target follows the mission (#55, #93)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('replaces the holding time by the stay when an expedition is picked, and back', () => {
    const v = view({ expo: 4 });
    const toExpedition = page('t_hold');
    timeRow('expedition', v);
    expect(toExpedition.row.outerHTML).toContain('<tr id="t_stay_row">');
    expect(toExpedition.row.outerHTML).not.toContain('id="t_h"');
    const toHold = page('t_stay_row');
    timeRow('hold', v);
    expect(toHold.row.outerHTML).toContain('<tr id="t_hold">');
    expect(toHold.row.outerHTML).toContain('id="t_h"');
    expect(toHold.row.outerHTML).not.toContain('id="t_stay"');
  });

  it('only shows or hides the row that is there: the holding time for a Halten, nothing for the others', () => {
    const v = view({ expo: 4 });
    const hold = page('t_hold');
    hold.row.hidden = true;
    timeRow('hold', v);
    expect([hold.row.hidden, hold.row.outerHTML]).toEqual([false, '']);
    timeRow('transport', v);
    expect(hold.row.hidden).toBe(true);
    // The stay stays shown for an expedition.
    const stay = page('t_stay_row', '2');
    timeRow('expedition', v);
    expect([stay.row.hidden, stay.row.outerHTML]).toEqual([false, '']);
  });

  it('writes the real time of the stay beside it, only with the speed dividing it', () => {
    const v = view({ expo: 4 });
    const real = page('t_stay_row', '5');
    timeRow('expedition', v);
    expect(real.real.textContent).toBe('');
    v.s.cfg = { ...U, speed: 5, roundExpeditionSpeed: 1 };
    timeRow('expedition', v);
    expect(real.real.textContent).toBe(
      'entspricht 1h 00m 00s (durch Tempo 5 geteilt)',
    );
  });

  it('does nothing without the row', () => {
    vi.stubGlobal('document', { querySelector: () => null });
    expect(() => timeRow('expedition', view({ expo: 4 }))).not.toThrow();
  });
});
