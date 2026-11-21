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
