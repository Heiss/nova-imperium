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
        temp: 20,
        owner: 'u_Anna',
      },
      {
        id: 'p1_2_6',
        name: 'Beta',
        g: 1,
        s: 2,
        p: 6,
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
