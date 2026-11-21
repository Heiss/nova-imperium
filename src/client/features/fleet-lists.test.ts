// The lists „Auftrag“ and „Schnellwahl“ of the fleet form (#253) and the line
// of the limit of planets (#237): what the form does on every change of the
// target, with a stub of the page.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { U } from '../../test/fixtures.ts';
import { fleetChoice } from '../logic/fleet-choice.ts';
import { fleetForm } from '../logic/fleet-form.svelte.ts';
import { forgetForms } from '../logic/form-state.svelte.ts';
import { client } from '../logic/state.svelte.ts';
import type { GameState } from '../logic/types.ts';
import type { V } from '../views/common.ts';
import { clientFeature } from './fleet.ts';
import { fakeCtx } from './test-ctx.ts';

vi.mock('../logic/game.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../logic/game.ts')>()),
  fleetPreview: vi.fn(() => null),
}));

type Field = Record<string, unknown>;
let fields: Record<string, Field>;
let listeners: Record<string, (e: unknown) => void>;

/** A field of the target position: the state of the form (#332), read and written as the field. */
function position(k: 'g' | 's' | 'p', start: string): Field {
  fleetForm.to[k] = start;
  return {
    get value() {
      return fleetForm.to[k] ?? '';
    },
    set value(typed: string) {
      fleetForm.to[k] = typed;
    },
  };
}

const place = (
  id: string,
  kind: 'planet' | 'moon',
  g: number,
  s: number,
  p: number,
  owner: string,
) => ({ id, kind, name: id, g, s, p, temp: 1, owner });

beforeEach(() => {
  listeners = {};
  fields = {
    '#t_g': position('g', '1'),
    '#t_s': position('s', '2'),
    '#t_p': position('p', '6'),
    '#t_info': { innerHTML: '' },
    '#t_hold': { hidden: false },
    '#t_h': { value: '' },
    ...Object.fromEntries(
      ['i_dist', 'i_dur', 'i_arr', 'i_fuel', 'i_cap'].map((id) => [
        `#${id}`,
        { innerHTML: '' },
      ]),
    ),
  };
  vi.stubGlobal('document', {
    querySelector: (sel: string) => fields[sel] ?? null,
    querySelectorAll: () => [],
    addEventListener: (type: string, fn: (e: unknown) => void) => {
      listeners[type] = fn;
    },
  });
  client.ui.view = 'fleet';
  client.ui.fm = 'attack';
  client.ui.fk = undefined;
  client.game = {
    cfg: {
      ...U,
      roundColonyBase: 6,
      roundColonyResearch: 1,
      roundColonyPerLevel: 2,
      roundColonyMaxLevel: 4,
    },
    planet: { id: 'p1_1_5' },
    me: { id: 'u1', research: {} },
    galaxy: [
      place('p1_1_5', 'planet', 1, 1, 5, 'u1'),
      place('p1_2_6', 'planet', 1, 2, 6, 'u2'),
      place('p1_3_7', 'planet', 1, 3, 7, 'u1'),
      place('m1_3_7', 'moon', 1, 3, 7, 'u1'),
    ],
    fleets: [],
    debris: [],
    players: {},
  } as unknown as GameState;
  client.view = {
    P: { id: 'p1_1_5', ships: {} },
    ui: client.ui,
  } as unknown as V;
  clientFeature.listen(
    fakeCtx({
      setInput: (sel, v) => {
        fields[sel]!.value = String(v);
      },
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  forgetForms();
  client.game = null;
  client.view = null;
});

const change = (target?: unknown): void => listeners.change!({ target });
/** What the form shows for its state (the component asks the same function). */
const shows = () =>
  fleetChoice(
    { s: client.game!, P: client.view!.P, ui: client.ui },
    fleetForm,
    client.now(),
  );
const options = (): string[] => shows().missions.map((o) => o.value);

describe('the list „Auftrag“ follows the target', () => {
  it('keeps the list and the chosen mission while they fit', () => {
    fleetForm.mission = 'spy';
    change();
    expect(options()).toEqual(['attack', 'transport', 'spy', 'hold']);
    expect(shows().mission).toBe('spy');
    expect(fleetForm.mission).toBe('spy');
    expect(client.ui.fm).toBe('spy');
  });

  it('shows the mission of the page while none was chosen', () => {
    expect(shows().mission).toBe('attack');
    client.ui.fm = 'transport';
    expect(shows().mission).toBe('transport');
    change();
    expect(fleetForm.mission).toBe('transport');
  });

  it('switches to the first mission that fits when the coordinates change to an empty field', () => {
    fields['#t_p']!.value = '8';
    change();
    expect(options()).toEqual(['colonize', 'survey']);
    expect(shows().mission).toBe('colonize');
    expect(fleetForm.mission).toBe('colonize');
    expect(client.ui.fm).toBe('colonize');
  });

  it('keeps the chosen mission when the new target fits it too', () => {
    fleetForm.mission = 'transport';
    fields['#t_s']!.value = '3';
    fields['#t_p']!.value = '7';
    change();
    expect(options()).toEqual(['transport', 'deploy']);
    expect(shows().mission).toBe('transport');
  });

  it('says that none fits while the target is the start planet, and frees the mission again', () => {
    fields['#t_s']!.value = '1';
    fields['#t_p']!.value = '5';
    change();
    expect(options()).toEqual(['']);
    expect(shows().mission).toBe('');
    expect(shows().missions).toEqual([
      {
        value: '',
        label: 'Kein Auftrag passt zum Ziel',
        selected: true,
        disabled: true,
      },
    ]);
    fields['#t_s']!.value = '2';
    fields['#t_p']!.value = '6';
    change();
    expect(shows().mission).toBe('attack');
  });

  it('names the planets against the limit for a Landnahme, and nothing for another mission', () => {
    fields['#t_p']!.value = '8';
    change();
    expect(shows().limit).toBe('Planeten: 2 / 6 · Kolonialverwaltung Stufe 0');
    fields['#t_p']!.value = '6';
    change();
    expect(shows().limit).toBe('');
  });

  it('asks for the kind as it is chosen, and settles a moon that is not there before the next list', () => {
    fields['#t_p']!.value = '8';
    fleetForm.kind = 'moon';
    expect(options()).not.toEqual(['colonize', 'survey']);
    change();
    expect(fleetForm.kind).toBe('planet');
    expect(options()).toEqual(['colonize', 'survey']);
  });
});

/**
 * The mission is the state of the form (#332): a redraw of the view (the poll
 * mounts it anew, and `afterRender` calls the form again) shows it again, also
 * a mission that the options of the page's own target do not hold.
 */
describe('the list „Auftrag“ after the view is drawn anew', () => {
  const afterRedraw = (): void => clientFeature.afterRender!();

  it('keeps a mission chosen for a free position that the page target does not hold', () => {
    fields['#t_p']!.value = '8';
    change();
    fleetForm.mission = 'survey';
    change({ id: 't_m', value: 'survey' });
    afterRedraw();
    expect(options()).toEqual(['colonize', 'survey']);
    expect(shows().mission).toBe('survey');
  });

  it('keeps the mission chosen', () => {
    fleetForm.mission = 'spy';
    change();
    afterRedraw();
    expect(shows().mission).toBe('spy');
  });

  it('falls back to the first mission that fits when the chosen one does not fit the target any more', () => {
    fields['#t_p']!.value = '8';
    change();
    fleetForm.mission = 'survey';
    change();
    fields['#t_s']!.value = '3';
    fields['#t_p']!.value = '7';
    afterRedraw();
    expect(options()).toEqual(['transport', 'deploy']);
    expect(shows().mission).toBe('transport');
    // The choice that did not fit is forgotten: it does not come back with the target.
    fields['#t_s']!.value = '2';
    fields['#t_p']!.value = '8';
    afterRedraw();
    expect(shows().mission).toBe('colonize');
  });

  it('chooses again the remembered mission when the target fits it once more', () => {
    fleetForm.mission = 'spy';
    change();
    fields['#t_s']!.value = '1';
    fields['#t_p']!.value = '5';
    change();
    expect(shows().mission).toBe('');
    fields['#t_s']!.value = '2';
    fields['#t_p']!.value = '6';
    change();
    expect(shows().mission).toBe('spy');
  });

  it('starts the next form of a fresh render with the mission remembered', () => {
    client.ui.ft = { g: 1, s: 2, p: 6 };
    fleetForm.mission = 'spy';
    change();
    forgetForms();
    expect(fleetForm.mission).toBeNull();
    expect(shows().mission).toBe('spy');
  });
});

/**
 * „Zielart“ is the state of the form (#332): the component shows it again
 * after every redraw, so the form only has to keep it right: „Mond“ only where
 * a moon is, the choice kept, and remembered in `client.ui.fk` for the next
 * form of a fresh render.
 */
describe('the kind of target „Zielart“', () => {
  /** The player picks „Mond“ at 1:3:7, where a moon is: the select writes the state, the page listener the memory. */
  const aimAtMoon = (): void => {
    fields['#t_s']!.value = '3';
    fields['#t_p']!.value = '7';
    fleetForm.kind = 'moon';
    change({ id: 't_k', value: 'moon' });
    expect(fleetForm.kind).toBe('moon');
  };
  const afterRedraw = (): void => clientFeature.afterRender!();

  it('keeps „Mond“ chosen for a place with a moon, over a redraw', () => {
    aimAtMoon();
    afterRedraw();
    expect(fleetForm.kind).toBe('moon');
    expect(client.ui.fk).toBe('moon');
  });

  it('keeps „Planet“ when the player chose it for a place with a moon', () => {
    aimAtMoon();
    fleetForm.kind = 'planet';
    change({ id: 't_k', value: 'planet' });
    afterRedraw();
    expect(fleetForm.kind).toBe('planet');
    expect(client.ui.fk).toBe('planet');
  });

  it('goes back to „Planet“ for a place without a moon, and stays there at a place with one', () => {
    aimAtMoon();
    fields['#t_s']!.value = '2';
    fields['#t_p']!.value = '6';
    afterRedraw();
    expect(fleetForm.kind).toBe('planet');
    expect(client.ui.fk).toBe('planet');
    fields['#t_s']!.value = '3';
    fields['#t_p']!.value = '7';
    afterRedraw();
    expect(fleetForm.kind).toBe('planet');
  });

  it('keeps the moon chosen in the Schnellwahl', () => {
    change({ id: 't_q', value: 'm1_3_7' });
    afterRedraw();
    expect(fleetForm.kind).toBe('moon');
    expect(client.ui.fk).toBe('moon');
  });

  it('is settled by the first calculation to what the page shows: the moon of the page only where it is', () => {
    client.ui.ft = { g: 1, s: 3, p: 7, kind: 'moon' };
    fleetForm.to = { g: null, s: null, p: null };
    afterRedraw();
    expect(fleetForm.kind).toBe('moon');
    client.ui.ft = { g: 1, s: 2, p: 6, kind: 'moon' };
    forgetForms();
    afterRedraw();
    expect(fleetForm.kind).toBe('planet');
  });

  it('forgets the choice once the fleet is sent', async () => {
    aimAtMoon();
    await clientFeature.acts(fakeCtx()).send!({});
    expect(client.ui.fk).toBeUndefined();
  });
});

describe('the list „Schnellwahl“', () => {
  it('enters the coordinates of the place chosen, planet or moon, goes back to „– wählen –“ and lets the mission list follow', () => {
    const quick = { id: 't_q', value: 'm1_3_7' };
    change(quick);
    expect(fields['#t_g']!.value).toBe('1');
    expect(fields['#t_s']!.value).toBe('3');
    expect(fields['#t_p']!.value).toBe('7');
    expect(fleetForm.kind).toBe('moon');
    expect(quick.value).toBe('');
  });

  it('enters nothing for „– wählen –“ and for a place that is gone', () => {
    for (const value of ['', 'p9_9_9']) {
      fields['#t_p']!.value = '6';
      change({ id: 't_q', value });
      expect(fields['#t_p']!.value).toBe('6');
    }
  });

  it('is only asked in the fleet view, and only for its own list', () => {
    const other = { id: 't_k', value: 'm1_3_7' };
    change(other);
    expect(fields['#t_s']!.value).toBe('2');
    client.ui.view = 'galaxy';
    change({ id: 't_q', value: 'm1_3_7' });
    expect(fields['#t_s']!.value).toBe('2');
  });
});

describe('sending with the list empty', () => {
  it('sends nothing while no mission fits', async () => {
    const ctx = fakeCtx();
    fields['#t_s']!.value = '1';
    fields['#t_p']!.value = '5';
    await clientFeature.acts(ctx).send!({});
    expect(ctx.actHere).not.toHaveBeenCalled();
  });
});
