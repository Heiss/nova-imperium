// The Sternenkarte shows every player a Trümmerfeld with its symbol, the
// tooltip and the button „Bergung“ (#45, owner, 2026-11-13).
import { describe, expect, it } from 'vitest';
import type { DebrisField } from '../../core/debris.ts';
import type { Planet } from '../../core/types.ts';
import type { GameState } from '../logic/types.ts';
import type { V } from './common.ts';
import { galaxy } from './galaxy.ts';

const home = { id: 'p1_2_5', g: 1, s: 2, p: 5, ships: {} } as unknown as Planet;

function view(debris: DebrisField[], ships: Planet['ships'] = {}): V {
  const s = {
    cfg: { galaxies: 2, systems: 50, positions: 15 },
    me: { id: 'u_Anna', probes: 1 },
    players: {
      u_Anna: { name: 'Anna', points: 100 },
      u_Bert: { name: 'Bert', points: 100 },
    },
    galaxy: [
      {
        id: 'p1_2_5',
        name: 'Heimat',
        g: 1,
        s: 2,
        p: 5,
        kind: 'planet',
        temp: 20,
        owner: 'u_Anna',
      },
      {
        id: 'p1_2_6',
        name: 'Beta',
        g: 1,
        s: 2,
        p: 6,
        kind: 'planet',
        temp: 20,
        owner: 'u_Bert',
      },
    ],
    debris,
  } as unknown as GameState;
  return {
    s,
    P: { ...home, ships },
    R: { research: {}, rq: null },
    now: 0,
    ui: { gal: 1, sys: 2 },
  } as unknown as V;
}

/** The row of a position. */
const row = (html: string, p: number): string =>
  html.split('<tr').find((r) => r.includes(`<td class="n">${p}</td>`))!;

const field = (p: number, m: number, c: number): DebrisField => ({
  id: `d1_2_${p}`,
  g: 1,
  s: 2,
  p,
  m,
  c,
});

describe('Trümmerfelder on the Sternenkarte (#45)', () => {
  it('shows the symbol with its tooltip and the button at a foreign planet', () => {
    const html = galaxy(view([field(6, 1800, 600)]));
    const r = row(html, 6);
    expect(r).toContain('title="Trümmerfeld: 1.800 Adamant, 600 Psikristall"');
    expect(r).toContain('src="/icons/debris.svg"');
    expect(r).toContain('data-m="harvest"');
    expect(r).toContain('>Bergung</button>');
    expect(r).toContain('data-m="attack"');
  });

  it('shows them at the own planet and at a free position too', () => {
    const html = galaxy(view([field(5, 10, 20), field(9, 0, 300)]));
    for (const p of [5, 9]) {
      expect(row(html, p), String(p)).toContain('class="debris"');
      expect(row(html, p), String(p)).toContain('data-m="harvest"');
      expect(row(html, p), String(p)).toContain(`data-p="${p}"`);
    }
    expect(row(html, 9)).toContain(
      'title="Trümmerfeld: 0 Adamant, 300 Psikristall"',
    );
  });

  it('keeps the Landnahme beside the Bergung at a free position', () => {
    const html = galaxy(view([field(9, 0, 300)], { colony: 1 }));
    expect(row(html, 9)).toMatch(/Landnahme<\/button> · <button[^>]*>Bergung/);
    expect(row(html, 10)).toContain('Landnahme');
    expect(row(html, 10)).not.toContain('Bergung');
  });

  it('shows neither symbol nor button without a field', () => {
    const html = galaxy(view([]));
    expect(html).not.toContain('debris');
    expect(html).not.toContain('Bergung');
    expect(galaxy(view([field(6, 1, 1)]))).not.toMatch(
      /data-p="(5|7|9)"[^>]*>Bergung/,
    );
  });
});

describe('moons on the Sternenkarte (#53)', () => {
  const moon = (p: number, owner: string, name = 'Mond') => ({
    id: `m1_2_${p}`,
    kind: 'moon',
    name,
    g: 1,
    s: 2,
    p,
    temp: 20,
    owner,
  });

  /** The Sternenkarte with moons at the planets, one of them opened. */
  function withMoons(open: string | null, active = 'p1_2_5'): string {
    const v = view([]);
    v.s.galaxy.push(
      moon(5, 'u_Anna', 'Luna') as never,
      moon(6, 'u_Bert') as never,
    );
    v.ui.gmoon = open;
    v.P = { ...v.P, id: active };
    return galaxy(v);
  }

  /** The rows of the table, split at each row. */
  const rows = (html: string): string[] => html.split('<tr').slice(1);

  it('shows the symbol at the planet for every player, closed', () => {
    const html = withMoons(null);
    expect(row(html, 5)).toContain('data-act="gmoon" data-id="m1_2_5"');
    expect(row(html, 5)).toContain('alt="Luna (Mond)"');
    expect(row(html, 6)).toContain('data-id="m1_2_6" aria-expanded="false"');
    expect(row(html, 7)).not.toContain('gmoon');
    expect(html).not.toContain('moon-row');
    // A row per position and the header.
    expect(rows(html)).toHaveLength(16);
  });

  it('opens the actions of a foreign moon below its planet', () => {
    const html = withMoons('m1_2_6');
    const all = rows(html);
    const at = all.findIndex((r) => r.includes('<td class="n">6</td>'));
    const moonRow = all[at + 1]!;
    expect(row(html, 6)).toContain('aria-expanded="true"');
    expect(moonRow).toContain('class="moon-row "');
    expect(moonRow).toContain('Mond (Mond)');
    expect(moonRow).toContain('Bert');
    expect(moonRow).toContain(
      'data-act="gspy" data-g="1" data-s="2" data-p="6" data-k="moon">Auspex-Erkundung',
    );
    expect(moonRow).toContain(
      'data-act="gfleet" data-m="attack" data-g="1" data-s="2" data-p="6" data-k="moon">Sturmangriff',
    );
    expect(moonRow).toContain('data-m="transport"');
    expect(moonRow).not.toContain('data-m="deploy"');
    expect(rows(html)).toHaveLength(17);
    // The planet keeps its own actions, without the moon.
    expect(row(html, 6)).not.toContain('data-k="moon"');
  });

  it('opens the actions of an own moon: switch, supply and Verlegung', () => {
    const html = withMoons('m1_2_5');
    const all = rows(html);
    const moonRow =
      all[all.findIndex((r) => r.includes('<td class="n">5</td>')) + 1]!;
    expect(moonRow).toContain('class="moon-row me"');
    expect(moonRow).toContain('Luna (Mond)');
    expect(moonRow).toContain('data-act="selectPlanet" data-id="m1_2_5"');
    expect(moonRow).toContain('data-m="transport"');
    expect(moonRow).toContain('data-m="deploy"');
    expect(moonRow).toContain('data-k="moon"');
    expect(moonRow).not.toContain('Sturmangriff');
  });

  it('names the active moon', () => {
    const html = withMoons('m1_2_5', 'm1_2_5');
    expect(html).toContain('<span class="dim">Aktiver Mond</span>');
    expect(html).not.toContain('Aktiver Planet');
    expect(withMoons(null)).toContain(
      '<span class="dim">Aktiver Planet</span>',
    );
  });
});
