// The handlers of the private messages (#226): which action each request of a
// component sends, when the question is asked, and what it answers.
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  PM_EVENT,
  type PmCall,
  type PmRequest,
} from '../logic/private-messages.ts';
import { answer, clientFeature } from './private-messages.ts';
import { fakeCtx } from './test-ctx.ts';

afterEach(() => vi.unstubAllGlobals());

const request = (call: PmCall, quiet = false) => {
  const done = vi.fn();
  return { request: { call, quiet, done } satisfies PmRequest, done };
};

describe('answer', () => {
  it('sends every action with its data and says it went through', async () => {
    const calls: PmCall[] = [
      ['sendPrivateMessage', { name: 'Bert', text: 'Hallo' }],
      ['readPrivateMessages', { name: 'Bert' }],
      ['deletePrivateMessage', { id: 4 }],
      ['deletePrivateConversation', { name: '' }],
      ['reportPrivateMessage', { id: 5 }],
      ['blockPlayer', { name: 'Bert' }],
      ['unblockPlayer', { name: 'Bert' }],
      ['privateMessageOptions', { friendsOnly: true }],
    ];
    for (const call of calls) {
      const ctx = fakeCtx();
      const { request: r, done } = request(call);
      await answer(ctx, r, () => true);
      expect(ctx.act).toHaveBeenCalledWith(call[0], call[1]);
      expect(ctx.quiet).not.toHaveBeenCalled();
      expect(done).toHaveBeenCalledExactlyOnceWith(true);
    }
  });

  it('reads older messages through the api, gives their data back and changes nothing (Q27)', async () => {
    const api = vi.fn(async () => ({
      data: { older: [{ id: 1 }], more: false },
    }));
    const ctx = fakeCtx({ api: api as never });
    const { request: r, done } = request([
      'olderPrivateMessages',
      { before: 4 },
    ]);
    await answer(ctx, r, () => false);
    expect(api).toHaveBeenCalledExactlyOnceWith('/api/action', {
      type: 'olderPrivateMessages',
      before: 4,
    });
    expect(done).toHaveBeenCalledExactlyOnceWith(true, {
      older: [{ id: 1 }],
      more: false,
    });
    expect(ctx.act).not.toHaveBeenCalled();
    expect(ctx.quiet).not.toHaveBeenCalled();
  });

  it('loads a conversation and the sent messages through the api too, with their data, and changes nothing (Q32, Q33)', async () => {
    for (const [call, data] of [
      [
        ['openPrivateConversation', { name: 'Bert' }],
        { messages: [], more: false },
      ],
      [['openPrivateConversation', { name: '' }], { messages: [], more: true }],
      [['sentPrivateMessages', {}], { sent: [], more: false }],
      [
        ['sentPrivateMessages', { before: 9 }],
        { sent: [{ id: 1 }], more: true },
      ],
    ] as [PmCall, Record<string, unknown>][]) {
      const api = vi.fn(async () => ({ data }));
      const ctx = fakeCtx({ api: api as never });
      const { request: r, done } = request(call);
      const confirm = vi.fn(() => false);
      await answer(ctx, r, confirm);
      expect(api).toHaveBeenCalledExactlyOnceWith('/api/action', {
        type: call[0],
        ...call[1],
      });
      expect(done).toHaveBeenCalledExactlyOnceWith(true, data);
      // No question, no state, no message: a load only reads.
      expect(confirm).not.toHaveBeenCalled();
      expect(ctx.act).not.toHaveBeenCalled();
      expect(ctx.quiet).not.toHaveBeenCalled();
      expect(ctx.toast).not.toHaveBeenCalled();
    }
  });

  it('shows the words of a refusal of a load and says it did not go through (Q32, Q33)', async () => {
    for (const call of [
      ['openPrivateConversation', { name: 'Nobody' }],
      ['sentPrivateMessages', { before: 4 }],
    ] as PmCall[]) {
      const ctx = fakeCtx({
        api: vi.fn(async () => {
          throw new Error('Diese Nachricht gibt es nicht.');
        }),
      });
      const { request: r, done } = request(call);
      await answer(ctx, r, () => true);
      expect(ctx.toast).toHaveBeenCalledWith(
        'Diese Nachricht gibt es nicht.',
        expect.objectContaining({ message: 'Diese Nachricht gibt es nicht.' }),
      );
      expect(done).toHaveBeenCalledExactlyOnceWith(false);
    }
  });

  it('shows the words of a refusal of the older messages and says it did not go through', async () => {
    const ctx = fakeCtx({
      api: vi.fn(async () => {
        throw new Error('Diese Nachricht gibt es nicht.');
      }),
    });
    const { request: r, done } = request([
      'olderPrivateMessages',
      { before: 4 },
    ]);
    await answer(ctx, r, () => true);
    expect(ctx.toast).toHaveBeenCalledWith(
      'Diese Nachricht gibt es nicht.',
      expect.objectContaining({ message: 'Diese Nachricht gibt es nicht.' }),
    );
    expect(done).toHaveBeenCalledExactlyOnceWith(false);
  });

  it('reports a refusal of the server as not gone through, so the form keeps its text', async () => {
    const ctx = fakeCtx({ act: vi.fn(async () => false) });
    const { request: r, done } = request([
      'sendPrivateMessage',
      { name: 'Bert', text: 'Hallo' },
    ]);
    await answer(ctx, r, () => true);
    expect(done).toHaveBeenCalledExactlyOnceWith(false);
  });

  it('marks as read without a message for a refusal (quiet)', async () => {
    const ctx = fakeCtx();
    const { request: r, done } = request(
      ['readPrivateMessages', { name: 'Bert' }],
      true,
    );
    await answer(ctx, r, () => true);
    expect(ctx.quiet).toHaveBeenCalledWith('readPrivateMessages', {
      name: 'Bert',
    });
    expect(ctx.act).not.toHaveBeenCalled();
    expect(done).toHaveBeenCalledExactlyOnceWith(true);
  });

  it('asks before a deletion and a report, and sends nothing when the player says no', async () => {
    const asked: string[] = [];
    for (const call of [
      ['deletePrivateMessage', { id: 1 }],
      ['deletePrivateConversation', { name: 'Bert' }],
      ['reportPrivateMessage', { id: 1 }],
    ] as PmCall[]) {
      const ctx = fakeCtx();
      const { request: r, done } = request(call);
      await answer(ctx, r, (q) => {
        asked.push(q);
        return false;
      });
      expect(ctx.act).not.toHaveBeenCalled();
      expect(done).toHaveBeenCalledExactlyOnceWith(false);
    }
    expect(asked).toEqual([
      'Nachricht löschen?',
      'Unterhaltung löschen?',
      'Nachricht der Spielleitung melden?',
    ]);
  });

  it('asks nothing before sending, blocking or the switch', async () => {
    const confirm = vi.fn(() => false);
    for (const call of [
      ['sendPrivateMessage', { name: 'Bert', text: 'x' }],
      ['blockPlayer', { name: 'Bert' }],
      ['privateMessageOptions', { friendsOnly: false }],
    ] as PmCall[]) {
      const ctx = fakeCtx();
      await answer(ctx, request(call).request, confirm);
      expect(ctx.act).toHaveBeenCalledOnce();
    }
    expect(confirm).not.toHaveBeenCalled();
  });
});

describe('the feature', () => {
  it('listens to the event of the components and has no handler of its own', async () => {
    let listener: (e: Event) => void = () => undefined;
    vi.stubGlobal('document', {
      addEventListener: (type: string, fn: typeof listener) => {
        if (type === PM_EVENT) listener = fn;
      },
    });
    vi.stubGlobal('window', { confirm: vi.fn(() => true) });
    const ctx = fakeCtx();
    clientFeature.listen!(ctx);
    expect(clientFeature.acts()).toEqual({});
    const { request: r, done } = request(['blockPlayer', { name: 'Bert' }]);
    listener(new CustomEvent(PM_EVENT, { detail: r }));
    await vi.waitFor(() => expect(done).toHaveBeenCalledWith(true));
    expect(ctx.act).toHaveBeenCalledWith('blockPlayer', { name: 'Bert' });
  });
});
