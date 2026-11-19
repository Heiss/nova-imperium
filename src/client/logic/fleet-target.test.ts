// What the fleet form says beside its target (#93): the expedition position
// is „Expeditionsposition“ for an expedition and refused for the rest, and
// the form takes the position after the last planet position.
import { describe, expect, it } from 'vitest';
import { U } from '../../test/fixtures.ts';
import { maxPosition, targetInfo } from './fleet-target.ts';
import type { FleetForm } from './game.ts';
import type { GameState } from './types.ts';

const state = (over: Record<string, unknown> = {}): GameState =>
  ({
    cfg: U,
    players: { u2: { name: 'Bert', points: 1 } },
    galaxy: [
      {
        id: 'p1_2_6',
        kind: 'planet',
        name: 'Beta <b>',
        g: 1,
        s: 2,
        p: 6,
        temp: 1,
        owner: 'u2',
      },
    ],
    debris: [],
    ...over,
  }) as unknown as GameState;

const form = (mission: string, p: number, kind?: 'moon'): FleetForm => ({
  ships: { lc: 1 },
  to: { g: 1, s: 2, p, ...(kind ? { kind } : {}) },
  mission,
  pct: 10,
  cargo: { m: 0, c: 0, d: 0 },
});

describe('the position field of the fleet form', () => {
  it('takes the position after the last planet position', () => {
    expect(maxPosition(state())).toBe(16);
    expect(maxPosition(state({ cfg: { ...U, positions: 20 } }))).toBe(21);
  });
});

describe('beside the target', () => {
  it('names the planet and its owner, escaped', () => {
    expect(targetInfo(state(), form('attack', 6))).toBe(
      'Beta &lt;b&gt; (Bert)',
    );
  });

  it('calls the expedition position by its name for an expedition', () => {
    expect(targetInfo(state(), form('expedition', 16))).toBe(
      'Expeditionsposition',
    );
    expect(
      targetInfo(
        state({ cfg: { ...U, positions: 20 } }),
        form('expedition', 21),
      ),
    ).toBe('Expeditionsposition');
  });

  it('says for every other mission that only expeditions go there', () => {
    for (const mission of ['attack', 'colonize', 'survey', 'transport'])
      expect(targetInfo(state(), form(mission, 16)), mission).toBe(
        '<span class="bad">nur für Expeditionen</span>',
      );
  });

  it('keeps the words of a free position and of none', () => {
    expect(targetInfo(state(), form('colonize', 9))).toBe('Freie Position');
    expect(targetInfo(state(), form('survey', 9))).toBe('Freie Position');
    expect(targetInfo(state(), form('attack', 9))).toBe(
      '<span class="bad">kein Planet</span>',
    );
    expect(targetInfo(state(), form('expedition', 9))).toBe(
      '<span class="bad">kein Planet</span>',
    );
  });

  it('shows the Trümmerfeld of a Bergung, also at the expedition position, or none', () => {
    expect(targetInfo(state(), form('harvest', 16))).toBe(
      '<span class="bad">kein Trümmerfeld</span>',
    );
    const withField = state({
      debris: [{ id: 'd1_2_16', g: 1, s: 2, p: 16, m: 500, c: 200 }],
    });
    expect(targetInfo(withField, form('harvest', 16))).not.toContain('kein');
    expect(targetInfo(withField, form('harvest', 16))).toContain('500');
  });

  it('shows a moon only for a moon target', () => {
    expect(targetInfo(state(), form('attack', 6, 'moon'))).toMatch(/Mond/);
  });
});
