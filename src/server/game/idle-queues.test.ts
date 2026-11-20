// The own places without a running building (#189, D5): what the state sends
// for the line „Bauschleife leer“ of the phone overview.
import { describe, expect, it } from 'vitest';
import type { Queue } from '../../core/types.ts';
import { addPlanet, addUser, testCtx } from '../test-helpers.ts';
import { idleQueues } from './idle-queues.ts';
import { addMoon } from './moons.ts';
import { stateFor } from './state.ts';

const running = (end: number): Queue => ({
  key: 'metal',
  lvl: 1,
  start: 0,
  end,
  cost: [0, 0, 0],
});

describe('idleQueues', () => {
  it('lists the own places but the shown one, as ids only', () => {
    const ctx = testCtx();
    const anna = addUser(ctx, 'Anna');
    const home = addPlanet(ctx, anna.id, { g: 1, s: 1, p: 5 });
    const colony = addPlanet(ctx, anna.id, { g: 1, s: 1, p: 6 });
    expect(idleQueues(ctx, anna.id, home)).toEqual([colony.id]);
    expect(idleQueues(ctx, anna.id, colony)).toEqual([home.id]);
    // Without a shown place every place is listed.
    expect(idleQueues(ctx, anna.id, null).sort()).toEqual(
      [home.id, colony.id].sort(),
    );
  });

  it('leaves out a place with a running building, also one that ends later', () => {
    const ctx = testCtx();
    const anna = addUser(ctx, 'Anna');
    const home = addPlanet(ctx, anna.id, { g: 1, s: 1, p: 5 });
    addPlanet(ctx, anna.id, { g: 1, s: 1, p: 6, bq: running(ctx.now() + 1) });
    const idle = addPlanet(ctx, anna.id, { g: 1, s: 1, p: 7 });
    expect(idleQueues(ctx, anna.id, home)).toEqual([idle.id]);
  });

  it('counts a queue that ended as empty, and one that ends now', () => {
    const ctx = testCtx();
    const anna = addUser(ctx, 'Anna');
    const home = addPlanet(ctx, anna.id, { g: 1, s: 1, p: 5 });
    const ended = addPlanet(ctx, anna.id, {
      g: 1,
      s: 1,
      p: 6,
      bq: running(ctx.now() - 1000),
    });
    const now = addPlanet(ctx, anna.id, {
      g: 1,
      s: 1,
      p: 7,
      bq: running(ctx.now()),
    });
    expect(idleQueues(ctx, anna.id, home).sort()).toEqual(
      [ended.id, now.id].sort(),
    );
  });

  it('lists a moon like a planet', () => {
    const ctx = testCtx();
    const anna = addUser(ctx, 'Anna');
    const home = addPlanet(ctx, anna.id, { g: 1, s: 1, p: 5 });
    const moon = addMoon(ctx, home, 5, 0);
    expect(idleQueues(ctx, anna.id, home)).toEqual([moon.id]);
    // The moon is shown: the planet is the other place.
    expect(idleQueues(ctx, anna.id, moon)).toEqual([home.id]);
  });

  it('lists the places of the player only', () => {
    const ctx = testCtx();
    const anna = addUser(ctx, 'Anna');
    const bert = addUser(ctx, 'Bert');
    const home = addPlanet(ctx, anna.id, { g: 1, s: 1, p: 5 });
    addPlanet(ctx, bert.id, { g: 1, s: 2, p: 5 });
    expect(idleQueues(ctx, anna.id, home)).toEqual([]);
  });

  it('is empty for a player without a planet', () => {
    const ctx = testCtx();
    const cora = addUser(ctx, 'Cora');
    expect(idleQueues(ctx, cora.id, null)).toEqual([]);
  });
});

describe('the state key idle', () => {
  it('is the ids of the other places without a running building', () => {
    const ctx = testCtx();
    const anna = addUser(ctx, 'Anna');
    addPlanet(ctx, anna.id, { g: 1, s: 1, p: 5 });
    const colony = addPlanet(ctx, anna.id, { g: 1, s: 1, p: 6 });
    addPlanet(ctx, anna.id, { g: 1, s: 1, p: 7, bq: running(ctx.now() + 9) });
    expect(stateFor(ctx, anna).idle).toEqual([colony.id]);
    // The shown place follows the selection.
    expect(stateFor(ctx, anna, colony.id).idle).toEqual(['p1_1_5']);
  });

  it('is empty for a player without a planet', () => {
    const ctx = testCtx();
    expect(stateFor(ctx, addUser(ctx, 'Cora')).idle).toEqual([]);
  });
});
