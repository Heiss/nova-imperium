// The generic list (#118): every entry of a kind gets its row from the
// catalog, without HTML of its own; the component shows the view state of
// the state module. Rendered on the server side of Svelte, as text.
import { render } from 'svelte/server';
import { afterEach, describe, expect, it } from 'vitest';
import { BUILD, buildable, DEF, RES, SHIPS } from '../../core/catalog.ts';
import { text } from '../../core/text.ts';
import { planet, U } from '../../test/fixtures.ts';
import type { CatalogKind } from '../logic/catalog-list.ts';
import { client } from '../logic/state.svelte.ts';
import type { GameState } from '../logic/types.ts';
import CatalogList from './CatalogList.svelte';
import type { Ui, V } from './common.ts';

const view = (name = 'Heimat'): V => ({
  s: {
    cfg: U,
    me: { id: 'u1', explain: 'icon' },
    labs: [],
    galaxy: [],
    homePlanet: 'p1_1_5',
  } as unknown as GameState,
  P: planet({ name, b: { lab: 1, yard: 1 } }),
  R: { research: {}, rq: null },
  now: 0,
  ui: { openEx: {} } as unknown as Ui,
});

function html(kind: CatalogKind, v: V | null = view()): string {
  client.shown = v;
  return render(CatalogList, { props: { kind } }).body;
}

afterEach(() => (client.shown = null));

const ENTRIES: Record<CatalogKind, string[]> = {
  building: Object.keys(BUILD).filter((k) => buildable(k, 'planet')),
  // The Kolonialverwaltung only in a round that has it (#237, below).
  research: Object.keys(RES).filter((k) => k !== 'colonial'),
  ship: Object.keys(SHIPS),
  defense: Object.keys(DEF),
};

describe('CatalogList', () => {
  it('shows nothing before the first render', () => {
    // Svelte's hydration markers are comments; nothing else is rendered.
    expect(html('building', null)).toMatch(/^(?:<!--[^>]*-->)*$/);
  });

  it.each(Object.entries(ENTRIES))(
    'gives every %s of the catalog one row with its name',
    (kind, keys) => {
      const out = html(kind as CatalogKind);
      expect(out.match(/<div class="item[ "]/g)).toHaveLength(keys.length);
      for (const key of keys)
        expect(out).toContain(`<div class="nm">${text(key)!.n} `);
    },
  );

  it('lists the Kolonialverwaltung in a round that has it (#237)', () => {
    const v = view();
    v.s.cfg = {
      ...U,
      roundColonyBase: 6,
      roundColonyResearch: 1,
      roundColonyPerLevel: 2,
      roundColonyMaxLevel: 4,
    };
    const out = html('research', v);
    expect(out.match(/<div class="item[ "]/g)).toHaveLength(
      ENTRIES.research.length + 1,
    );
    expect(out).toContain(`<div class="nm">${text('colonial')!.n} `);
  });

  it('follows the view state of the client', () => {
    expect(html('research', view('Kolonie'))).toContain(
      '<h2>Forschung auf Kolonie</h2>',
    );
    expect(html('research', view('Heimat'))).toContain(
      '<h2>Forschung auf Heimat</h2>',
    );
  });

  it('escapes what players write', () => {
    const out = html('research', view('<img src=x onerror=alert(1)>'));
    expect(out).not.toContain('<img src=x');
    expect(out).toContain('&lt;img src=x onerror=alert(1)>');
  });

  it('gives each unit its order field and each building its button', () => {
    const units = html('defense');
    expect(units).toContain('id="q_rl"');
    expect(units).toContain('data-act="maxq" data-k="rl" data-max="');
    const buildings = html('building');
    expect(buildings).toContain('data-act="build" data-k="metal"');
  });

  it('puts a separator before „Zurückbauen“ only together with the button (#202)', () => {
    const v = view();
    v.P = planet({ b: { lab: 1, yard: 1, metal: 2 } });
    // The cells as rendered, with Svelte's markers: a space between two
    // blocks of a cell would show here.
    const cells = [
      ...html('building', v).matchAll(/<div class="act">(.*?)<\/div>/g),
    ].map((m) => m[1]!);
    const BUTTON = (key: string) =>
      `<!--[0--><br/><button class="small" data-act="demolish" data-k="${key}">Zurückbauen</button><!--]-->`;
    const NONE = '<!--]--><!--[-1--><!--]-->';
    // A row with a level: its action, then the separator and the button, no space.
    const metal = cells.find((c) => c.includes('data-k="metal"'))!;
    expect(metal).toMatch(/^<!--\[3--><button .*<\/button><!--\]-->/);
    expect(metal.endsWith(`<!--]-->${BUTTON('metal')}`)).toBe(true);
    // A refusal of a row with a level keeps no space before the button either.
    const yard = cells.find((c) => c.includes('data-k="yard"'))!;
    expect(yard).toBe(
      `<!--[2--><span class="req">Das Wissen ist noch verschlossen</span><!--]-->${BUTTON('yard')}`,
    );
    // A row without a level has nothing after its action: no space, no break.
    const locked = cells.filter((c) => !c.includes('data-act="demolish"'));
    expect(locked.length).toBeGreaterThan(3);
    for (const cell of locked) expect(cell.endsWith(NONE)).toBe(true);
    expect(locked).toContain(
      `<!--[2--><span class="req">Das Wissen ist noch verschlossen</span>${NONE}`,
    );
  });
});
