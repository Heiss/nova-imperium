// The fleet form for the expeditions (#93): the position field takes the
// expedition position, the row „Haltezeit“ shows only for a mission that
// stays, and the title counts the expeditions against their slots.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { planet, U } from '../../test/fixtures.ts';
import type { ClientFleet, GameState } from '../logic/types.ts';
import { fleetView as fleet } from '../../test/fleet-view.ts';
import { realStay, timeRow } from '../logic/fleet-time.ts';
import { fleetForm } from '../logic/fleet-form.svelte.ts';
import { forgetForms } from '../logic/form-state.svelte.ts';
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

/** The start planet of the view is at 1:1:5; the fleet form starts from there. */
const EXPEDITION_AT = { g: 1, s: 2, p: 16 };
/** Bert's planet, a foreign target. */
const FOREIGN_AT = { g: 1, s: 2, p: 6 };

function view(
  research: Record<string, number>,
  fleets: ClientFleet[] = [],
  fm?: string,
  to: { g: number; s: number; p: number } = fm === 'expedition'
    ? EXPEDITION_AT
    : FOREIGN_AT,
): V {
  const s = {
    cfg: U,
    me: { id: 'u1', probes: 1, research },
    players: { u1: { name: 'Anna', points: 1 } },
    galaxy: [
      {
        id: 'p1_2_6',
        kind: 'planet',
        name: 'Beta',
        ...FOREIGN_AT,
        temp: 1,
        owner: 'u2',
      },
    ],
    debris: [],
    fleets,
  } as unknown as GameState;
  return {
    s,
    P: planet({ ships: { lc: 5 } }),
    R: { research, rq: null },
    now: 0,
    ui: { gal: 1, sys: 1, ft: to, ...(fm ? { fm } : {}) } as Ui,
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
    expect(fleet(view({ expo: 1 }, [], undefined, EXPEDITION_AT))).toContain(
      '<option value="expedition" selected="">Expedition</option>',
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

describe('the state of the form (#332)', () => {
  afterEach(forgetForms);

  it('shows the target of the page and no number while nothing was typed', () => {
    const html = fleet(view({}));
    expect(html).toMatch(/<input[^>]*id="f_lc"[^>]*>/);
    expect(/<input[^>]*id="f_lc"[^>]*>/.exec(html)![0]).not.toContain('value');
    for (const [id, at] of [
      ['t_g', 1],
      ['t_s', 2],
      ['t_p', 6],
    ] as const)
      expect(new RegExp(`id="${id}" value="${at}"`).test(html), id).toBe(true);
    expect(html).not.toMatch(/<select id="t_v"[^]*?selected[^]*?<\/select>/);
    expect(/<input[^>]*id="c_m"[^>]*>/.exec(html)![0]).not.toContain('value');
  });

  it('shows what was typed and chosen, an emptied field empty, over a redraw', () => {
    Object.assign(fleetForm, {
      ships: { lc: '3' },
      to: { g: '4', s: null, p: '' },
      speed: '5',
      cargo: { m: '20' },
    });
    const html = fleet(view({}));
    expect(/<input[^>]*id="f_lc"[^>]*>/.exec(html)![0]).toContain('value="3"');
    expect(html).toContain('id="t_g" value="4"');
    expect(html).toContain('id="t_s" value="2"');
    expect(html).toContain('id="t_p" value=""');
    expect(html).toContain('<option value="5" selected="">50 %</option>');
    expect(html).toContain('<option value="10">100 %</option>');
    expect(/<input[^>]*id="c_m"[^>]*>/.exec(html)![0]).toContain('value="20"');
  });
});

describe('the kind of target after a redraw (#332)', () => {
  afterEach(forgetForms);

  /** The target 1:2:6 with a moon next to the planet. */
  const withMoon = (): V => {
    const v = view({});
    v.s.galaxy.push({
      id: 'm1_2_6',
      kind: 'moon',
      name: 'Mond',
      ...FOREIGN_AT,
      temp: 1,
      owner: 'u2',
    } as GameState['galaxy'][number]);
    return v;
  };
  const kinds = (html: string): string =>
    /<select id="t_k"[^]*?<\/select>/.exec(html)![0];

  it('offers „Mond“ only where a moon is, and selects it only when chosen', () => {
    expect(kinds(fleet(view({})))).toContain('disabled');
    const open = kinds(fleet(withMoon()));
    expect(open).not.toContain('disabled');
    expect(open).not.toContain('selected');
    fleetForm.kind = 'moon';
    expect(kinds(fleet(withMoon()))).toMatch(
      /<option value="moon" selected="">Mond/,
    );
  });

  it('shows the planet for a moon that is not there, whatever was chosen', () => {
    fleetForm.kind = 'moon';
    const html = kinds(fleet(view({})));
    expect(html).toContain('disabled');
    expect(html).not.toContain('selected');
  });

  it('shows the moon of the typed position, not the one of the page', () => {
    fleetForm.kind = 'moon';
    fleetForm.to = { g: '1', s: '2', p: '6' };
    const v = withMoon();
    v.ui.ft = { g: 1, s: 1, p: 1 };
    expect(kinds(fleet(v))).toContain('selected');
    fleetForm.to = { g: '1', s: '2', p: '7' };
    expect(kinds(fleet(v))).not.toContain('selected');
  });
});

describe('the mission after a redraw (#332)', () => {
  afterEach(forgetForms);

  const list = (html: string): string =>
    /<select id="t_m"[^]*?<\/select>/.exec(html)![0];
  const values = (html: string): string[] =>
    [...list(html).matchAll(/<option value="([^"]*)"/g)].map((m) => m[1]!);
  const send = (html: string): string =>
    /<button id="t_send"[^>]*>/.exec(html)![0];

  it('shows the mission chosen, not the one of the page', () => {
    const v = view({ expo: 4 }, [], 'transport');
    expect(list(fleet(v))).toContain('<option value="transport" selected="">');
    fleetForm.mission = 'spy';
    const html = list(fleet(v));
    expect(html).toContain('<option value="spy" selected="">');
    expect(html).not.toContain('<option value="transport" selected');
  });

  it('shows the list of the typed target, not the one of the page', () => {
    const v = view({ expo: 4 }, [], 'transport');
    expect(values(fleet(v))).toContain('attack');
    fleetForm.to = { g: '1', s: '2', p: '16' };
    expect(values(fleet(v))).toEqual(['expedition']);
  });

  it('blocks the button while no mission fits the typed target, and frees it again', () => {
    const v = view({}, [], 'transport');
    // The planet the form starts from stands at 1:1:5.
    v.s.galaxy.push({
      id: 'p1_1_5',
      kind: 'planet',
      name: 'Heimat',
      g: 1,
      s: 1,
      p: 5,
      temp: 1,
      owner: 'u1',
    } as GameState['galaxy'][number]);
    expect(send(fleet(v))).not.toContain('disabled');
    fleetForm.to = { g: '1', s: '1', p: '5' };
    const html = fleet(v);
    expect(values(html)).toEqual(['']);
    expect(send(html)).toContain('disabled');
    fleetForm.to = { g: '1', s: '2', p: '6' };
    expect(send(fleet(v))).not.toContain('disabled');
  });

  it('names the planets against the limit for the Landnahme chosen', () => {
    const v = view({}, [], 'colonize', { g: 1, s: 2, p: 8 });
    expect(fleet(v)).toMatch(/<span id="t_limit" class="dim">Planeten: /);
    fleetForm.to = { g: '1', s: '2', p: '6' };
    expect(fleet(v)).toContain('<span id="t_limit" class="dim"></span>');
  });
});

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
