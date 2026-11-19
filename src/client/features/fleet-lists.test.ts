// The lists „Auftrag“ and „Schnellwahl“ of the fleet form (#253) and the line
// of the limit of planets (#237): what the form does on every change of the
// target, with a stub of the page.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { U } from '../../test/fixtures.ts';
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

/** A select that rebuilds its options from the HTML it is given. */
function select(value: string, values: string[]): Field {
  const el: Field = {
    value,
    options: values.map((v) => ({ value: v })),
    html: '',
  };
  Object.defineProperty(el, 'innerHTML', {
    get: () => el.html,
    set: (html: string) => {
      el.html = html;
      el.options = [...html.matchAll(/<option value="([^"]*)"/g)].map((m) => ({
        value: m[1]!,
      }));
    },
  });
  return el;
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
    '#t_g': { value: '1' },
    '#t_s': { value: '2' },
    '#t_p': { value: '6' },
    '#t_k': { value: 'planet', querySelector: () => ({ disabled: false }) },
    '#t_info': { innerHTML: '' },
    '#t_hold': { hidden: false },
    '#t_m': select('attack', ['attack', 'transport', 'spy', 'hold']),
    '#t_limit': { textContent: '' },
    '#t_send': { disabled: false, dataset: { full: '' } },
    '#t_h': { value: '' },
    '#t_v': { value: '10' },
    '#c_m': { value: '' },
    '#c_c': { value: '' },
    '#c_d': { value: '' },
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
  client.view = { P: { id: 'p1_1_5', ships: {} } } as unknown as V;
  clientFeature.acts(
    fakeCtx({
      setInput: (sel, v) => {
        fields[sel]!.value = String(v);
      },
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  client.game = null;
  client.view = null;
});

const change = (target?: unknown): void => listeners.change!({ target });
const options = (): string[] =>
  (fields['#t_m']!.options as { value: string }[]).map((o) => o.value);

describe('the list „Auftrag“ follows the target', () => {
  it('keeps the list and the chosen mission while they fit', () => {
    fields['#t_m']!.value = 'spy';
    change();
    expect(options()).toEqual(['attack', 'transport', 'spy', 'hold']);
    expect(fields['#t_m']!.value).toBe('spy');
    expect(fields['#t_send']!.disabled).toBe(false);
  });

  it('switches to the first mission that fits when the coordinates change to an empty field', () => {
    fields['#t_p']!.value = '8';
    change();
    expect(options()).toEqual(['colonize', 'survey']);
    expect(fields['#t_m']!.value).toBe('colonize');
  });

  it('keeps the chosen mission when the new target fits it too', () => {
    fields['#t_m']!.value = 'transport';
    fields['#t_s']!.value = '3';
    fields['#t_p']!.value = '7';
    change();
    expect(options()).toEqual(['transport', 'deploy']);
    expect(fields['#t_m']!.value).toBe('transport');
  });

  it('says that none fits and blocks the button while the target is the start planet, and frees it again', () => {
    fields['#t_s']!.value = '1';
    fields['#t_p']!.value = '5';
    change();
    expect(options()).toEqual(['']);
    expect(fields['#t_m']!.value).toBe('');
    expect(fields['#t_send']!.disabled).toBe(true);
    fields['#t_s']!.value = '2';
    fields['#t_p']!.value = '6';
    change();
    expect(fields['#t_m']!.value).toBe('attack');
    expect(fields['#t_send']!.disabled).toBe(false);
  });

  it('keeps the button blocked while all slots are used', () => {
    (fields['#t_send']!.dataset as { full: string }).full = '1';
    change();
    expect(fields['#t_send']!.disabled).toBe(true);
  });

  it('names the planets against the limit for a Landnahme, and nothing for another mission', () => {
    fields['#t_p']!.value = '8';
    change();
    expect(fields['#t_limit']!.textContent).toBe(
      'Planeten: 2 / 6 · Kolonialverwaltung Stufe 0',
    );
    fields['#t_p']!.value = '6';
    change();
    expect(fields['#t_limit']!.textContent).toBe('');
  });
});

describe('the list „Schnellwahl“', () => {
  it('enters the coordinates of the place chosen, planet or moon, goes back to „– wählen –“ and lets the mission list follow', () => {
    const quick = { id: 't_q', value: 'm1_3_7' };
    change(quick);
    expect(fields['#t_g']!.value).toBe('1');
    expect(fields['#t_s']!.value).toBe('3');
    expect(fields['#t_p']!.value).toBe('7');
    expect(fields['#t_k']!.value).toBe('moon');
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
    fields['#t_m']!.value = '';
    await clientFeature.acts(ctx).send!({});
    expect(ctx.actHere).not.toHaveBeenCalled();
  });
});
