// The one way of the client to send a game action (#118): the answer's state
// is applied only while the player still looks at the same planet, and a
// refresh never applies a state older than an action's answer (review of
// #209).
import { describe, expect, it, vi } from 'vitest';
import type { ActionName } from '../../core/actions.ts';
import {
  type ActDeps,
  createAct,
  placeOf,
  samePlace,
  type Sync,
} from './act.ts';
import { ApiError } from './transport.ts';
import type { GameState } from './types.ts';

const state = (player: string, planet: string | null): GameState =>
  ({
    me: { id: player },
    planet: planet === null ? null : { id: planet },
  }) as unknown as GameState;

/** The transport as the tests use it: any action name, with or without data (the contract is checked where the views call it). */
type Send = (type: ActionName, data?: object) => ReturnType<Sync['send']>;

function setup(answer: () => Promise<Record<string, unknown>>) {
  let current: GameState | null = state('u1', 'p1');
  const api = vi.fn<ActDeps['api']>(() => answer());
  const apply = vi.fn();
  const toast = vi.fn();
  const sync = createAct({ api, state: () => current, apply, toast });
  return {
    act: sync.send as unknown as Send,
    quiet: sync.quiet as unknown as Send,
    own: sync.own as unknown as (
      refused: (message: string) => void,
      type: ActionName,
      data?: object,
    ) => ReturnType<Sync['own']>,
    refresh: sync.refresh,
    api,
    apply,
    toast,
    switchTo: (next: GameState | null) => (current = next),
  };
}

describe('placeOf and samePlace', () => {
  it('names the player and the planet of a state', () => {
    expect(placeOf(state('u1', 'p1'))).toEqual({
      player: 'u1',
      planet: 'p1',
    });
    expect(placeOf(state('u1', null))).toEqual({
      player: 'u1',
      planet: undefined,
    });
    expect(placeOf(null)).toEqual({ player: undefined, planet: undefined });
  });

  it('is the same place only for the same player and planet', () => {
    const here = { player: 'u1', planet: 'p1' };
    expect(samePlace(state('u1', 'p1'), here)).toBe(true);
    expect(samePlace(state('u2', 'p1'), here)).toBe(false);
    expect(samePlace(state('u1', 'p2'), here)).toBe(false);
    expect(samePlace(null, here)).toBe(false);
    expect(samePlace(null, {})).toBe(false);
    expect(samePlace(state('u1', null), { player: 'u1' })).toBe(true);
  });
});

describe('the extra fields of every request (Q32)', () => {
  it("adds what `extra` gives to every action, before the action's own fields, and nothing when there is no `extra`", async () => {
    const api = vi.fn<ActDeps['api']>(async () => ({
      state: state('u1', 'p1'),
    }));
    const open = { pm: 'Bert', pmAfter: 7 };
    const sync = createAct({
      api,
      state: () => state('u1', 'p1'),
      apply: vi.fn(),
      toast: vi.fn(),
      extra: () => open,
    });
    await (sync.send as unknown as Send)('readPrivateMessages', {
      name: 'Bert',
    });
    expect(api).toHaveBeenLastCalledWith('/api/action', {
      type: 'readPrivateMessages',
      planet: 'p1',
      pm: 'Bert',
      pmAfter: 7,
      name: 'Bert',
    });
    // The action's own fields win; the quiet way carries it too.
    await (sync.quiet as unknown as Send)('read', { pm: 'own' });
    expect(api).toHaveBeenLastCalledWith('/api/action', {
      type: 'read',
      planet: 'p1',
      pm: 'own',
      pmAfter: 7,
    });
    const plain = createAct({
      api,
      state: () => state('u1', 'p1'),
      apply: vi.fn(),
      toast: vi.fn(),
    });
    await (plain.send as unknown as Send)('read');
    expect(api).toHaveBeenLastCalledWith('/api/action', {
      type: 'read',
      planet: 'p1',
    });
  });
});

describe('the data of an answer (#53)', () => {
  it('goes to `answer` before the state, on the planet still shown', async () => {
    let current: GameState | null = state('u1', 'p1');
    const order: string[] = [];
    const data = { scan: { flights: [] } };
    const answer = vi.fn(() => order.push('answer'));
    const sync = createAct({
      api: async () => ({ state: state('u1', 'p1'), data }),
      state: () => current,
      apply: () => order.push('apply'),
      toast: vi.fn(),
      answer,
    });
    expect(await sync.send('scan', { target: 'p2' })).toBe('done');
    expect(answer).toHaveBeenCalledWith(data);
    expect(order).toEqual(['answer', 'apply']);
    // Not after the player switched planets, not without data.
    answer.mockClear();
    const late = createAct({
      api: async () => {
        current = state('u1', 'p2');
        return { state: state('u1', 'p1'), data };
      },
      state: () => current,
      apply: vi.fn(),
      toast: vi.fn(),
      answer,
    });
    expect(await late.send('scan', { target: 'p2' })).toBe('stale');
    current = state('u1', 'p1');
    for (const nothing of [null, undefined, 'Text', 3]) {
      const none = createAct({
        api: async () => ({ state: state('u1', 'p1'), data: nothing }),
        state: () => current,
        apply: vi.fn(),
        toast: vi.fn(),
        answer,
      });
      expect(await none.send('scan', { target: 'p2' })).toBe('done');
    }
    expect(answer).not.toHaveBeenCalled();
  });

  it('is dropped when a newer action of the same type overtook it (review of #217)', async () => {
    const pending: Array<(j: Record<string, unknown>) => void> = [];
    const answer = vi.fn();
    const apply = vi.fn();
    const sync = createAct({
      api: () => new Promise((ok) => pending.push(ok)),
      state: () => state('u1', 'p1'),
      apply,
      toast: vi.fn(),
      answer,
    });
    const scan = (target: string) => ({ scan: { target } });
    // The scan of A, then of B; B answers first, A late.
    const a = sync.send('scan', { target: 'A' });
    const b = sync.send('scan', { target: 'B' });
    pending[1]!({ state: state('u1', 'p1'), data: scan('B') });
    expect(await b).toBe('done');
    pending[0]!({ state: state('u1', 'p1'), data: scan('A') });
    // A went through, its state is applied, its data no longer shown.
    expect(await a).toBe('done');
    expect(apply).toHaveBeenCalledTimes(2);
    expect(answer.mock.calls).toEqual([[scan('B')]]);
    // Also while the newer scan is still on its way.
    answer.mockClear();
    const c = sync.send('scan', { target: 'C' });
    const d = sync.send('scan', { target: 'D' });
    pending[2]!({ state: state('u1', 'p1'), data: scan('C') });
    expect(await c).toBe('done');
    expect(answer).not.toHaveBeenCalled();
    pending[3]!({ state: state('u1', 'p1'), data: scan('D') });
    expect(await d).toBe('done');
    expect(answer.mock.calls).toEqual([[scan('D')]]);
    // An action of another type does not overtake a scan.
    answer.mockClear();
    const e = sync.send('scan', { target: 'E' });
    const build = sync.send('build', { key: 'metal' });
    pending[5]!({ state: state('u1', 'p1') });
    expect(await build).toBe('done');
    pending[4]!({ state: state('u1', 'p1'), data: scan('E') });
    expect(await e).toBe('done');
    expect(answer.mock.calls).toEqual([[scan('E')]]);
  });

  it('is fine without an `answer`', async () => {
    const t = setup(async () => ({ state: state('u1', 'p1'), data: { x: 1 } }));
    expect(await t.act('scan')).toBe('done');
    expect(t.apply).toHaveBeenCalled();
  });
});

describe('act', () => {
  it('posts the action with the planet and applies the answer', async () => {
    const next = state('u1', 'p1');
    const t = setup(async () => ({ state: next }));
    expect(await t.act('build', { key: 'metal' })).toBe('done');
    expect(t.api).toHaveBeenCalledWith('/api/action', {
      type: 'build',
      planet: 'p1',
      key: 'metal',
    });
    expect(t.apply).toHaveBeenCalledWith(next);
    expect(t.toast).not.toHaveBeenCalled();
  });

  it('sends no data but the type and the planet by default', async () => {
    const t = setup(async () => ({}));
    await t.act('cancelBuild');
    expect(t.api).toHaveBeenCalledWith('/api/action', {
      type: 'cancelBuild',
      planet: 'p1',
    });
  });

  it('shows the message of the server', async () => {
    const t = setup(async () => ({ state: state('u1', 'p1'), msg: 'Gebaut.' }));
    await t.act('build');
    expect(t.toast).toHaveBeenCalledWith('Gebaut.');
  });

  it('answers stale and keeps the state when the player changed the planet meanwhile', async () => {
    const t = setup(async () => {
      t.switchTo(state('u1', 'p2'));
      return { state: state('u1', 'p1'), msg: 'Gebaut.' };
    });
    // The order went through on p1, but the form of p2 must stay (#209).
    expect(await t.act('order')).toBe('stale');
    expect(t.apply).not.toHaveBeenCalled();
    expect(t.toast).toHaveBeenCalledWith('Gebaut.');
  });

  it('answers stale when the player signed out meanwhile', async () => {
    const t = setup(async () => {
      t.switchTo(null);
      return { state: state('u1', 'p1') };
    });
    expect(await t.act('build')).toBe('stale');
    expect(t.apply).not.toHaveBeenCalled();
  });

  it('shows a failure as an error and answers failed', async () => {
    const t = setup(async () => {
      throw new Error('Zu wenig Rohstoffe.');
    });
    expect(await t.act('build')).toBe('failed');
    expect(t.toast).toHaveBeenCalledWith(
      'Zu wenig Rohstoffe.',
      expect.objectContaining({ message: 'Zu wenig Rohstoffe.' }),
    );
    expect(t.apply).not.toHaveBeenCalled();
  });

  it('hands the toast the error of the failed call itself, so „Problem melden“ names that call', async () => {
    const refused = new ApiError('Interner Fehler. Vorgang: a1', 'a1');
    const t = setup(async () => {
      throw refused;
    });
    expect(await t.act('build')).toBe('failed');
    expect(t.toast).toHaveBeenCalledWith(refused.message, refused);
  });

  it('keeps the refusal of a quiet action to itself and still answers failed (#301)', async () => {
    const t = setup(async () => {
      throw new Error('Dazu fehlt deinem Rang das Recht.');
    });
    expect(await t.quiet('seeGuildChat', { id: 1 })).toBe('failed');
    expect(t.toast).not.toHaveBeenCalled();
    expect(t.apply).not.toHaveBeenCalled();
  });

  it('shows the message of a quiet action that went through', async () => {
    const t = setup(async () => ({
      state: state('u1', 'p1'),
      msg: 'Gesehen.',
    }));
    expect(await t.quiet('seeGuildChat', { id: 1 })).toBe('done');
    expect(t.toast).toHaveBeenCalledWith('Gesehen.');
  });

  it('hands the refusal of an own action to its caller with the words of the server, not to a note (#349)', async () => {
    const t = setup(async () => {
      throw new Error('Spieler nicht gefunden.');
    });
    const refused = vi.fn();
    expect(
      await t.own(refused, 'sendPrivateMessage', { name: 'X', text: 'y' }),
    ).toBe('failed');
    expect(refused).toHaveBeenCalledExactlyOnceWith('Spieler nicht gefunden.');
    expect(t.toast).not.toHaveBeenCalled();
    expect(t.apply).not.toHaveBeenCalled();
  });

  it('sends an own action like any other and shows its message when it went through (#349)', async () => {
    const t = setup(async () => ({
      state: state('u1', 'p1'),
      msg: 'Gesendet.',
    }));
    const refused = vi.fn();
    expect(
      await t.own(refused, 'sendPrivateMessage', { name: 'X', text: 'y' }),
    ).toBe('done');
    expect(t.api).toHaveBeenCalledWith('/api/action', {
      type: 'sendPrivateMessage',
      planet: 'p1',
      name: 'X',
      text: 'y',
    });
    expect(t.toast).toHaveBeenCalledWith('Gesendet.');
    expect(refused).not.toHaveBeenCalled();
    await t.own(refused, 'seeGuildChat');
    expect(t.api).toHaveBeenLastCalledWith('/api/action', {
      type: 'seeGuildChat',
      planet: 'p1',
    });
  });

  it('sends a quiet action like any other, with the planet and its data', async () => {
    const t = setup(async () => ({ state: state('u1', 'p1') }));
    await t.quiet('seeGuildChat', { id: 7 });
    expect(t.api).toHaveBeenCalledWith('/api/action', {
      type: 'seeGuildChat',
      planet: 'p1',
      id: 7,
    });
    await t.quiet('seeGuildChat');
    expect(t.api).toHaveBeenLastCalledWith('/api/action', {
      type: 'seeGuildChat',
      planet: 'p1',
    });
  });
});

describe('a refresh', () => {
  /** An answer of the server that the test sends when it likes. */
  function later() {
    let send: (j: Record<string, unknown>) => void = () => undefined;
    let fail: (e: Error) => void = () => undefined;
    const answer = new Promise<Record<string, unknown>>((ok, no) => {
      send = ok;
      fail = no;
    });
    return { answer, send: () => send({}), fail: () => fail(new Error('x')) };
  }

  it('may apply its state when no action ran meanwhile', () => {
    const t = setup(async () => ({}));
    expect(t.refresh()()).toBe(true);
  });

  it('may apply its state after an action that ended before it started', async () => {
    const t = setup(async () => ({}));
    await t.act('build');
    expect(t.refresh()()).toBe(true);
  });

  it('only the newest refresh applies its state', () => {
    const t = setup(async () => ({}));
    const first = t.refresh();
    const second = t.refresh();
    expect(first()).toBe(false);
    expect(second()).toBe(true);
  });

  it('drops its state when an action started meanwhile', async () => {
    const t = setup(async () => ({}));
    const fresh = t.refresh();
    await t.act('build');
    expect(fresh()).toBe(false);
    expect(t.refresh()()).toBe(true);
  });

  it('drops its state when it started while an action was on its way', async () => {
    const pending = later();
    const t = setup(() => pending.answer);
    const action = t.act('build');
    const fresh = t.refresh();
    expect(fresh()).toBe(false);
    pending.send();
    expect(await action).toBe('done');
    expect(fresh()).toBe(false);
    expect(t.refresh()()).toBe(true);
  });

  it('counts a failed action as over', async () => {
    const pending = later();
    const t = setup(() => pending.answer);
    const action = t.act('build');
    expect(t.refresh()()).toBe(false);
    pending.fail();
    expect(await action).toBe('failed');
    expect(t.refresh()()).toBe(true);
  });

  it('waits until every action is over', async () => {
    const one = later();
    const two = later();
    const answers = [one.answer, two.answer];
    const t = setup(() => answers.shift()!);
    const first = t.act('build');
    const second = t.act('research');
    one.send();
    await first;
    expect(t.refresh()()).toBe(false);
    two.send();
    await second;
    expect(t.refresh()()).toBe(true);
  });
});
