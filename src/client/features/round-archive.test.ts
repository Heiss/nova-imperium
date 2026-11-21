import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { archive, forgetArchive } from '../logic/round-archive.ts';
import { resetRewind, rewindUi } from '../logic/round-rewind.svelte.ts';
import { client } from '../logic/state.svelte.ts';
import type { GameState } from '../logic/types.ts';
import { clientFeature } from './round-archive.ts';
import { fakeCtx } from './test-ctx.ts';
import type { ClientCtx } from './contract.ts';

const REPORT = { round: { number: 2 }, rows: [] };
const LIST = [{ number: 2, status: 'closed' }];
const HISTORY = [{ number: 2 }];

/** An api that answers the three actions of the archive. */
const api = (over: Record<string, () => unknown> = {}) =>
  vi.fn(async (_url: string, body?: unknown) => {
    const type = (body as { type: string }).type;
    const answers: Record<string, () => unknown> = {
      roundArchive: () => ({ ok: true, data: { rounds: LIST, admin: false } }),
      roundHistory: () => ({ ok: true, data: { history: HISTORY } }),
      roundReport: () => ({ ok: true, data: { report: REPORT } }),
      ...over,
    };
    return answers[type]!() as Record<string, unknown>;
  });

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  forgetArchive();
  client.game = {
    me: { id: 'u1' },
    round: { number: 3 },
  } as unknown as GameState;
  client.ui.view = 'help';
  vi.stubGlobal('document', { getElementById: () => null });
});
afterEach(() => {
  vi.unstubAllGlobals();
  client.game = null;
});

describe('opening a report', () => {
  it('reads it from the server, shows it with the category total and renders', async () => {
    const ctx = fakeCtx({ api: api() });
    archive.category = 'fleet';
    await clientFeature.acts(ctx).roundOpen!({ round: '2' });
    expect(ctx.api).toHaveBeenCalledWith('/api/action', {
      type: 'roundReport',
      round: 2,
    });
    expect(archive.report).toEqual(REPORT);
    expect(archive.category).toBe('total');
    expect(ctx.render).toHaveBeenCalled();
  });

  it('shows the refusal of the server and keeps the list', async () => {
    const ctx = fakeCtx({
      api: vi.fn(async () => {
        throw new Error('Dieser Rundenbericht ist nicht verfügbar.');
      }),
    });
    await clientFeature.acts(ctx).roundOpen!({ round: '9' });
    expect(ctx.toast).toHaveBeenCalledWith(
      'Dieser Rundenbericht ist nicht verfügbar.',
      true,
    );
    expect(archive.report).toBeNull();
    expect(ctx.render).not.toHaveBeenCalled();
  });

  it('goes back to the list and changes the category', () => {
    const ctx = fakeCtx();
    const acts = clientFeature.acts(ctx);
    archive.report = REPORT as never;
    acts.roundCat!({ cat: 'defense' });
    expect(archive.category).toBe('defense');
    acts.roundCat!({ cat: 'nonsense' });
    expect(archive.category).toBe('total');
    acts.roundBack!();
    expect(archive.report).toBeNull();
    expect(ctx.render).toHaveBeenCalledTimes(3);
  });
});

describe('the provisional report and the drilldown of the admin (#235, view H)', () => {
  const PERSON = { seat: 4, name: 'Anna', round: { number: 3 } };

  it('reads the running round again, keeps the category, renders and says so', async () => {
    const fresh = { round: { number: 3, provisional: true }, rows: [1] };
    const ctx = fakeCtx({
      api: api({ roundReport: () => ({ ok: true, data: { report: fresh } }) }),
    });
    archive.report = REPORT as never;
    archive.category = 'fleet';
    await clientFeature.acts(ctx).roundRefresh!({ round: '3' });
    expect(ctx.api).toHaveBeenCalledWith('/api/action', {
      type: 'roundReport',
      round: 3,
    });
    expect(archive.report).toEqual(fresh);
    expect(archive.category).toBe('fleet');
    expect(ctx.render).toHaveBeenCalled();
    expect(ctx.toast).toHaveBeenCalledWith('Vorschau aktualisiert.');
  });

  it('keeps the old report and shows the refusal when the refresh fails', async () => {
    const ctx = fakeCtx({
      api: vi.fn(async () => {
        throw new Error('Dieser Rundenbericht ist nicht verfügbar.');
      }),
    });
    archive.report = REPORT as never;
    await clientFeature.acts(ctx).roundRefresh!({ round: '3' });
    expect(archive.report).toEqual(REPORT);
    expect(ctx.toast).toHaveBeenCalledWith(
      'Dieser Rundenbericht ist nicht verfügbar.',
      true,
    );
  });

  it('reads one participant by round and seat, and goes back to the report', async () => {
    const ctx = fakeCtx({
      api: api({
        roundParticipant: () => ({ ok: true, data: { participant: PERSON } }),
      }),
    });
    const acts = clientFeature.acts(ctx);
    archive.report = REPORT as never;
    await acts.roundPerson!({ round: '3', seat: '4' });
    expect(ctx.api).toHaveBeenCalledWith('/api/action', {
      type: 'roundParticipant',
      round: 3,
      seat: 4,
    });
    expect(archive.participant).toEqual(PERSON);
    acts.roundPersonBack!();
    expect(archive.participant).toBeNull();
    expect(archive.report).toEqual(REPORT);
  });

  it('shows the refusal of the server for a participant and keeps the report', async () => {
    const ctx = fakeCtx({
      api: vi.fn(async () => {
        throw new Error('Dieser Rundenbericht ist nicht verfügbar.');
      }),
    });
    archive.report = REPORT as never;
    await clientFeature.acts(ctx).roundPerson!({ round: '3', seat: '4' });
    expect(archive.participant).toBeNull();
    expect(ctx.toast).toHaveBeenCalledWith(
      'Dieser Rundenbericht ist nicht verfügbar.',
      true,
    );
  });
});

describe('opening the Rewind', () => {
  const REWIND = { round: 2, cards: [{ kind: 'identity' }] };
  const focus = vi.fn();

  beforeEach(() => {
    focus.mockClear();
    resetRewind();
    vi.stubGlobal('document', {
      getElementById: (id: string) =>
        id === 'round-rewind-card-h' ? { focus } : null,
    });
  });

  it('reads it from the server, starts on the first card standing still, renders and focuses the heading', async () => {
    const ctx = fakeCtx({
      api: api({ roundRewind: () => ({ ok: true, data: { rewind: REWIND } }) }),
    });
    rewindUi.index = 2;
    rewindUi.playing = true;
    await clientFeature.acts(ctx).rewindOpen!({ round: '2' });
    expect(ctx.api).toHaveBeenCalledWith('/api/action', {
      type: 'roundRewind',
      round: 2,
    });
    expect(archive.rewind).toEqual(REWIND);
    expect(rewindUi).toEqual({ index: 0, playing: false });
    expect(ctx.render).toHaveBeenCalled();
    expect(focus).toHaveBeenCalled();
  });

  it('shows the refusal of the server and keeps the list', async () => {
    const ctx = fakeCtx({
      api: vi.fn(async () => {
        throw new Error('Dieser Rundenbericht ist nicht verfügbar.');
      }),
    });
    await clientFeature.acts(ctx).rewindOpen!({ round: '9' });
    expect(ctx.toast).toHaveBeenCalledWith(
      'Dieser Rundenbericht ist nicht verfügbar.',
      true,
    );
    expect(archive.rewind).toBeNull();
    expect(ctx.render).not.toHaveBeenCalled();
  });

  it('goes back to the list', () => {
    const ctx = fakeCtx();
    archive.rewind = REWIND as never;
    clientFeature.acts(ctx).rewindBack!();
    expect(archive.rewind).toBeNull();
    expect(ctx.render).toHaveBeenCalledTimes(1);
  });

  it('leaves the Rewind for the full report of card 8', async () => {
    const ctx = fakeCtx({ api: api() });
    archive.rewind = REWIND as never;
    await clientFeature.acts(ctx).roundOpen!({ round: '2' });
    expect(archive.rewind).toBeNull();
    expect(archive.report).toEqual(REPORT);
  });
});

describe('the admin buttons', () => {
  it('close the round after the question and read the archive again', async () => {
    vi.stubGlobal('window', { confirm: vi.fn(() => true) });
    const ctx = fakeCtx({ api: api() });
    await clientFeature.acts(ctx).roundClose!();
    expect(window.confirm).toHaveBeenCalledWith(
      expect.stringContaining('Runde 3 jetzt abschließen?'),
    );
    expect(ctx.act).toHaveBeenCalledWith('closeRound');
    expect(archive.entries).toEqual(LIST);
    expect(archive.history).toEqual(HISTORY);
  });

  it('send nothing when the question is declined or the action failed', async () => {
    vi.stubGlobal('window', { confirm: vi.fn(() => false) });
    const ctx = fakeCtx({ api: api() });
    const acts = clientFeature.acts(ctx);
    await acts.roundClose!();
    await acts.roundDelete!({ round: '2' });
    expect(ctx.act).not.toHaveBeenCalled();
    vi.stubGlobal('window', { confirm: vi.fn(() => true) });
    const failing = fakeCtx({ act: vi.fn(async () => false), api: api() });
    await clientFeature.acts(failing).roundClose!();
    expect(failing.api).not.toHaveBeenCalled();
  });

  it('delete a round after the question and read the archive again', async () => {
    vi.stubGlobal('window', { confirm: vi.fn(() => true) });
    const ctx = fakeCtx({ api: api() });
    await clientFeature.acts(ctx).roundDelete!({ round: '2' });
    expect(window.confirm).toHaveBeenCalledWith(
      expect.stringContaining('Runde 2 mit allen Berichten'),
    );
    expect(ctx.act).toHaveBeenCalledWith('deleteRound', { round: 2 });
    expect(archive.entries).toEqual(LIST);
  });
});

describe('reading the archive after a render', () => {
  const start = (ctx: ClientCtx) => {
    clientFeature.acts(ctx);
    clientFeature.afterRender();
    return flush();
  };

  it('reads the list and the history once on the options page and renders', async () => {
    const ctx = fakeCtx({ api: api() });
    await start(ctx);
    expect(ctx.api).toHaveBeenCalledTimes(2);
    expect(archive).toMatchObject({
      user: 'u1',
      round: 3,
      entries: LIST,
      history: HISTORY,
      loading: false,
      error: null,
    });
    expect(ctx.render).toHaveBeenCalledTimes(1);
    // The render that followed reads nothing again.
    clientFeature.afterRender();
    await flush();
    expect(ctx.api).toHaveBeenCalledTimes(2);
  });

  it('reads on the admin page too, and on no other', async () => {
    client.ui.view = 'overview';
    const ctx = fakeCtx({ api: api() });
    await start(ctx);
    expect(ctx.api).not.toHaveBeenCalled();
    client.ui.view = 'admin';
    await start(ctx);
    expect(ctx.api).toHaveBeenCalledTimes(2);
  });

  it('reads again for a new round and for another account', async () => {
    const ctx = fakeCtx({ api: api() });
    await start(ctx);
    client.game = {
      me: { id: 'u1' },
      round: { number: 4 },
    } as unknown as GameState;
    await start(ctx);
    expect(ctx.api).toHaveBeenCalledTimes(4);
    client.game = {
      me: { id: 'u2' },
      round: { number: 4 },
    } as unknown as GameState;
    await start(ctx);
    expect(ctx.api).toHaveBeenCalledTimes(6);
    expect(archive.user).toBe('u2');
  });

  it('shows a refusal and stops instead of asking again and again', async () => {
    const ctx = fakeCtx({
      api: vi.fn(async () => {
        throw new Error('Keine Antwort vom Server.');
      }),
    });
    await start(ctx);
    expect(archive).toMatchObject({
      entries: [],
      error: 'Keine Antwort vom Server.',
      loading: false,
    });
    const calls = vi.mocked(ctx.api).mock.calls.length;
    clientFeature.afterRender();
    await flush();
    expect(vi.mocked(ctx.api).mock.calls).toHaveLength(calls);
  });

  it('does nothing while signed out', async () => {
    client.game = null;
    const ctx = fakeCtx({ api: api() });
    await start(ctx);
    expect(ctx.api).not.toHaveBeenCalled();
  });
});
