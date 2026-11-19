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

const view = (name = 'Heimat', me: object = {}, openLv?: object): V => ({
  s: {
    cfg: U,
    me: { id: 'u1', explain: 'icon', ...me },
    labs: [],
    galaxy: [],
    homePlanet: 'p1_1_5',
  } as unknown as GameState,
  P: planet({ name, b: { lab: 1, yard: 1 } }),
  R: { research: {}, rq: null },
  now: 0,
  ui: { openEx: {}, openLv } as unknown as Ui,
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

  it('puts the ▤ of the level overview beside the „?“ of buildings and research (#187)', () => {
    const out = html('building');
    expect(out).toContain(
      '<button type="button" class="lvq" id="lvq_metal" data-act="levels" data-k="metal" aria-expanded="false" aria-label="Stufenübersicht zu Adamant-Tiefbohrung">▤</button>',
    );
    expect(out.match(/class="lvq"/g)).toHaveLength(ENTRIES.building.length);
    expect(out).not.toContain('class="lvt"');
    expect(html('research')).toContain('id="lvq_energy"');
    // The ▤ comes right after the „?“ of the same entry.
    expect(out.indexOf('id="lvq_metal"')).toBeGreaterThan(
      out.indexOf('id="exq_metal"'),
    );
    // Ships and defense have no levels.
    expect(html('ship')).not.toContain('lvq');
    expect(html('defense')).not.toContain('lvq');
  });

  it('opens the box of an unfolded table and names it by the button (#187)', () => {
    const out = html('building', view('Heimat', {}, { metal: true }));
    expect(out).toContain('aria-expanded="true" aria-controls="lv_metal"');
    expect(out.match(/<div class="lvt" id="lv_metal">/g)).toHaveLength(1);
    expect(out.match(/class="lvt"/g)).toHaveLength(1);
    // The other entries stay folded and control nothing.
    expect(out).toContain(
      'id="lvq_crystal" data-act="levels" data-k="crystal" aria-expanded="false" aria',
    );
    expect(out).not.toContain('aria-controls="lv_crystal"');
  });

  it('shows every table without a button in „Immer anzeigen“ and nothing in „Ausblenden“ (#187)', () => {
    const always = html('research', view('Heimat', { levelTable: 'always' }));
    expect(always).not.toContain('lvq');
    expect(always.match(/class="lvt"/g)).toHaveLength(ENTRIES.research.length);
    const hidden = html(
      'research',
      view('Heimat', { levelTable: 'hidden' }, { energy: true }),
    );
    expect(hidden).not.toContain('lvq');
    expect(hidden).not.toContain('lvt');
  });

  it('gives every order of the shipyard a button „Abbrechen“ with its position and unit (#258)', () => {
    const v = view();
    v.P = planet({
      b: { yard: 1 },
      sq: [
        { key: 'rl', n: 2, unit: 5000 },
        { key: 'rl', n: 1, unit: 5000 },
        { key: 'll', n: 7, unit: 9000 },
      ],
      sqT: 0,
    });
    for (const kind of ['ship', 'defense'] as const) {
      const out = html(kind, v);
      const buttons = [
        ...out.matchAll(
          /<button class="small red" data-act="cancelOrder"[^>]*>/g,
        ),
      ].map((m) => m[0]);
      expect(buttons).toEqual([
        '<button class="small red" data-act="cancelOrder" data-pos="0" data-k="rl" aria-label="Abbrechen: 2× Raketenbatterie">',
        '<button class="small red" data-act="cancelOrder" data-pos="1" data-k="rl" aria-label="Abbrechen: 1× Raketenbatterie">',
        '<button class="small red" data-act="cancelOrder" data-pos="2" data-k="ll" aria-label="Abbrechen: 7× Lichtlanze">',
      ]);
      expect(out.match(/>Abbrechen<\/button>/g)).toHaveLength(3);
    }
    // Without orders there is no list and no button.
    expect(html('defense')).not.toContain('cancelOrder');
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
  describe('on a phone (#189)', () => {
    it('offers the switch between the four lists with the open one marked', () => {
      const out = html('research');
      const nav =
        /<nav class="seg phone-only" aria-label="Bauen">(.*?)<\/nav>/s.exec(
          out,
        )![1]!;
      for (const view of ['buildings', 'research', 'shipyard', 'defense'])
        expect(nav).toContain(
          `href="?view=${view}" data-act="nav" data-v="${view}"`,
        );
      // The state module holds the open view; the default one is the overview.
      expect(nav).not.toContain('aria-current');
      client.ui.view = 'research';
      try {
        expect(html('research')).toContain(
          'aria-current="page" class="on">Forschung</a>',
        );
      } finally {
        client.ui.view = 'overview';
      }
    });

    it('starts with the filter „Baubar“ and marks every row with its phase', () => {
      const out = html('building');
      expect(out).toContain('<div class="box catalog" data-filter="open">');
      expect(out).toMatch(/aria-pressed="true"[^>]*>Baubar</);
      expect(out).toMatch(/aria-pressed="false"[^>]*>Alle</);
      expect(out).toMatch(/aria-pressed="false"[^>]*>Läuft</);
      expect(out.match(/data-phase="(open|locked|running)"/g)).toHaveLength(
        ENTRIES.building.length,
      );
      expect(out).toContain('data-phase="locked"');
    });

    it('gives every row a fold button that names its entry', () => {
      const out = html('building');
      expect(out.match(/class="fold phone-only"/g)).toHaveLength(
        ENTRIES.building.length,
      );
      expect(out).toContain(`aria-label="Details zu ${text('metal')!.n}"`);
      expect(out).toContain('aria-expanded="false"');
    });

    it('shows „▲ 5“ for a level button and keeps its full name for the reader', () => {
      const v = view();
      v.P = planet({ b: { lab: 1, yard: 1, metal: 4 } });
      v.P.res = { m: 1e9, c: 1e9, d: 1e9 };
      const out = html('building', v);
      expect(out).toMatch(
        /<button data-act="build" data-k="metal"[^>]*aria-label="Ausbauen auf Stufe 5"[^>]*><span class="lg">Ausbauen auf Stufe 5<\/span>(?:<!--[^>]*-->)*<span class="sh" aria-hidden="true">▲ 5<\/span>/,
      );
      // A button without a level has no short label and no aria-label.
      expect(out).toMatch(/data-k="solar"[^>]*><span>Bauen<\/span>/);
    });

    it('marks the time line, which stays in the folded row', () => {
      expect(html('building')).toContain('<div class="dim tl">Bauzeit: ');
      expect(html('research')).toContain(
        '<div class="dim tl">Forschungszeit: ',
      );
    });
  });
});
