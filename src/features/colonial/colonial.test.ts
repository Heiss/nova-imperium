// The Kolonialverwaltung (#237, owner, 2026-11-19): the decided cost, the
// factor and the requirements, identical to the Kreuzzugs-Kartografie
// (Forschungslabor 3, Spionagetechnik 4, Impulsantrieb 3), read through the
// public catalog functions.
import { describe, expect, it } from 'vitest';
import { RES } from '../../core/catalog.ts';
import { lvlCost } from '../../core/components/leveled.ts';
import { unmetRequirements } from '../../core/requirements.ts';
import type { ResearchState } from '../../core/types.ts';
import { U, planet } from '../../test/fixtures.ts';

const unmet = (lab: number, spy: number, impulse: number) => {
  const research: ResearchState = {
    research: { spy, impulse, energy: 5 },
    rq: null,
  };
  return unmetRequirements(RES.colonial!.req, {
    here: planet({ b: { lab } }),
    research,
    cfg: U,
  });
};

describe('the Kolonialverwaltung', () => {
  it('costs 4,000 / 8,000 / 4,000 at level 1 and doubles per level', () => {
    expect(RES.colonial!.cost).toEqual([4000, 8000, 4000]);
    expect(RES.colonial!.f).toBeUndefined();
    expect(lvlCost(RES.colonial!, 1)).toEqual([4000, 8000, 4000]);
    expect(lvlCost(RES.colonial!, 3)).toEqual([16000, 32000, 16000]);
  });
  it('needs the lab at 3, Spionagetechnik at 4 and Impulsantrieb at 3', () => {
    expect(unmet(3, 4, 3)).toEqual([]);
    expect(unmet(2, 4, 3).map((n) => [n.key, n.level, n.have])).toEqual([
      ['lab', 3, 2],
    ]);
    expect(unmet(3, 3, 3).map((n) => [n.key, n.level, n.have])).toEqual([
      ['spy', 4, 3],
    ]);
    expect(unmet(3, 4, 2).map((n) => [n.key, n.level, n.have])).toEqual([
      ['impulse', 3, 2],
    ]);
  });
});
