import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { client } from '../logic/state.svelte.ts';
import { fakeCtx } from './test-ctx.ts';

vi.mock('../push.ts', () => ({ disablePush: vi.fn(async () => undefined) }));
import { disablePush } from '../push.ts';
import { logout, selectPlanet } from './frame.ts';

const game = (id: string) => ({ me: { id } }) as never;
const stateOf = (planet: string) => ({ planet: { id: planet } });

beforeEach(() => {
  client.game = game('anna');
});
afterEach(() => {
  client.game = null;
  client.ui.auth = null;
  vi.clearAllMocks();
});

describe('choosing a planet', () => {
  it('loads the state of the planet and applies it as a fresh one', async () => {
    const state = stateOf('p2');
    const ctx = fakeCtx({ api: vi.fn(async () => state) as never });
    await selectPlanet(ctx, 'p2');
    expect(ctx.api).toHaveBeenCalledWith('/api/state?planet=p2');
    expect(ctx.apply).toHaveBeenCalledWith(state, true);
  });

  it('drops the answer of an older choice', async () => {
    const answers: ((v: unknown) => void)[] = [];
    const ctx = fakeCtx({
      api: vi.fn(
        () => new Promise((resolve) => answers.push(resolve)),
      ) as never,
    });
    const first = selectPlanet(ctx, 'p1');
    const second = selectPlanet(ctx, 'p2');
    answers[1]!(stateOf('p2'));
    await second;
    answers[0]!(stateOf('p1'));
    await first;
    expect(ctx.apply).toHaveBeenCalledTimes(1);
    expect(ctx.apply).toHaveBeenCalledWith(stateOf('p2'), true);
  });

  it('drops an answer that comes in for another player or planet', async () => {
    let answer: (v: unknown) => void = () => undefined;
    const ctx = fakeCtx({
      api: vi.fn(() => new Promise((r) => (answer = r))) as never,
    });
    const other = selectPlanet(ctx, 'p1');
    client.game = game('berta');
    answer(stateOf('p1'));
    await other;
    const wrong = fakeCtx({ api: vi.fn(async () => stateOf('p9')) as never });
    await selectPlanet(wrong, 'p1');
    expect(ctx.apply).not.toHaveBeenCalled();
    expect(wrong.apply).not.toHaveBeenCalled();
  });

  it('says why a planet could not be loaded', async () => {
    const ctx = fakeCtx({
      api: vi.fn(async () => {
        throw new Error('Nicht dein Planet.');
      }),
    });
    await selectPlanet(ctx, 'p2');
    expect(ctx.toast).toHaveBeenCalledWith('Nicht dein Planet.', true);
  });
});

describe('the logout', () => {
  it('cancels the push, ends the session and shows the login', async () => {
    const ctx = fakeCtx();
    await logout(ctx);
    expect(disablePush).toHaveBeenCalledWith(ctx.api);
    expect(ctx.api).toHaveBeenCalledWith('/api/logout', {});
    expect(client.game).toBeNull();
    expect(client.ui.auth).toBe('login');
    expect(ctx.render).toHaveBeenCalledWith(true);
  });

  it('shows the login even when the server cannot be reached', async () => {
    vi.mocked(disablePush).mockRejectedValueOnce(new Error('x'));
    const ctx = fakeCtx({
      api: vi.fn(async () => {
        throw new Error('down');
      }),
    });
    await logout(ctx);
    expect(client.game).toBeNull();
    expect(ctx.render).toHaveBeenCalledWith(true);
  });
});
