// „Endzeit“ (#161) and the moon buildings (#53, „Geklärt, Nachtrag 2“,
// owner 2026-11-14): the gift raises only the buildings that may stand at
// its target, checked with the component `placement`; research is raised
// as before. The levels of the gift are replaced here by a table that names
// the moon-only Mondzitadelle, as a requirement on a moon building would.
import { describe, expect, it, vi } from 'vitest';
import * as endzeitCore from '../../core/endzeit.ts';
import { addPlanet, addUser, testCtx } from '../test-helpers.ts';
import { runAction } from './dispatch.ts';
import { giftArrive } from './endzeit.ts';

vi.mock('../../core/endzeit.ts', async (original) => {
  const real = await original<typeof import('../../core/endzeit.ts')>();
  return { ...real, giftLevels: vi.fn(real.giftLevels) };
});

describe('the gift and the moon-only buildings', () => {
  it('skips the Mondzitadelle on the home planet and raises the rest', () => {
    vi.mocked(endzeitCore.giftLevels).mockReturnValue({
      b: { moonbase: 1, robot: 20, yard: 12 },
      r: { ifn: 1, hyper: 7 },
    });
    const ctx = testCtx();
    addUser(ctx, 'Anna', { admin: true });
    addPlanet(ctx, 'u_Anna', { name: 'Heim', b: { yard: 15 } });
    runAction(ctx, 'u_Anna', { type: 'endzeit', minutes: 60 });
    const gift = ctx.fleets.all().find((f) => f.gift)!;
    const home = ctx.planets.home('u_Anna')!;
    giftArrive(ctx, gift, home);
    const saved = ctx.planets.get(home.id)!;
    expect(saved.b).toEqual({ robot: 20, yard: 15 });
    expect(saved.b).not.toHaveProperty('moonbase');
    expect(ctx.players.get('u_Anna')!.research).toEqual({ ifn: 1, hyper: 7 });
    vi.mocked(endzeitCore.giftLevels).mockRestore();
  });
});
