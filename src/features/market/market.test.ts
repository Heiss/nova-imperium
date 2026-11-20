// The Handelsposten (#171, owner, 2026-11-19): the decided cost and factor,
// the requirement of the Servitorenschmiede at level 4 and the planets-only
// placement, read through the public catalog functions.
import { describe, expect, it } from 'vitest';
import { BUILD, buildable } from '../../core/catalog.ts';
import { lvlCost } from '../../core/components/leveled.ts';
import { unmetRequirements } from '../../core/requirements.ts';
import type { ResearchState } from '../../core/types.ts';
import { U, planet } from '../../test/fixtures.ts';

const research: ResearchState = { research: {}, rq: null };
const unmet = (robot: number) =>
  unmetRequirements(BUILD.market!.req, {
    here: planet({ b: { robot } }),
    research,
    cfg: U,
  });

describe('the Handelsposten', () => {
  it('costs 5,000 / 10,000 / 5,000 at level 1 and doubles per level', () => {
    expect(BUILD.market!.cost).toEqual([5000, 10000, 5000]);
    expect(BUILD.market!.f).toBe(2);
    expect(lvlCost(BUILD.market!, 1)).toEqual([5000, 10000, 5000]);
    expect(lvlCost(BUILD.market!, 3)).toEqual([20000, 40000, 20000]);
  });
  it('needs the Servitorenschmiede at level 4, and nothing else', () => {
    expect(unmet(3)).toEqual([
      {
        kind: 'b',
        key: 'robot',
        name: 'Servitorenschmiede',
        level: 4,
        have: 3,
      },
    ]);
    expect(unmet(4)).toEqual([]);
  });
  it('stands on planets only, not on moons', () => {
    expect(buildable('market', 'planet')).toBe(true);
    expect(buildable('market', 'moon')).toBe(false);
  });
});
