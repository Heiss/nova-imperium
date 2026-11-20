import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { drafts, FRIEND_NAME, GUILD_CHAT } from '../logic/drafts.svelte.ts';
import { clientFeature } from './social.ts';
import { fakeCtx } from './test-ctx.ts';

let submit: (e: unknown) => void;
const focus = vi.fn();

beforeEach(() => {
  vi.stubGlobal('document', {
    addEventListener: (type: string, l: (e: unknown) => void) => {
      if (type === 'submit') submit = l;
    },
    querySelector: (sel: string) => (sel === '#chat_text' ? { focus } : null),
  });
  vi.stubGlobal('window', { confirm: vi.fn(() => true) });
});
afterEach(() => {
  drafts.reset();
  focus.mockClear();
  vi.unstubAllGlobals();
});

const send = (id: string) => {
  const e = { target: { id }, preventDefault: vi.fn() };
  submit(e);
  return e;
};

describe('the guild chat', () => {
  it('sends the draft and clears it once the message is in', async () => {
    const ctx = fakeCtx();
    clientFeature.acts(ctx);
    drafts.set(GUILD_CHAT, 'Hallo Gilde');
    const e = send('guildchatform');
    expect(e.preventDefault).toHaveBeenCalled();
    await vi.waitFor(() => expect(drafts.get(GUILD_CHAT)).toBe(''));
    expect(ctx.act).toHaveBeenCalledWith('sendGuildChat', {
      text: 'Hallo Gilde',
    });
    expect(focus).toHaveBeenCalled();
  });

  it('keeps a draft typed while the message was on its way', async () => {
    let done: (v: boolean) => void = () => undefined;
    const ctx = fakeCtx({
      act: vi.fn(() => new Promise<boolean>((r) => (done = r))),
    });
    clientFeature.acts(ctx);
    drafts.set(GUILD_CHAT, 'eins');
    send('guildchatform');
    drafts.set(GUILD_CHAT, 'eins zwei');
    done(true);
    await vi.waitFor(() => expect(ctx.act).toHaveBeenCalled());
    await Promise.resolve();
    await Promise.resolve();
    expect(drafts.get(GUILD_CHAT)).toBe('eins zwei');
    expect(focus).not.toHaveBeenCalled();
  });

  it('keeps the draft when the server refuses the message', async () => {
    const ctx = fakeCtx({ act: vi.fn(async () => false) });
    clientFeature.acts(ctx);
    drafts.set(GUILD_CHAT, 'Hallo');
    send('guildchatform');
    await vi.waitFor(() => expect(ctx.act).toHaveBeenCalled());
    await Promise.resolve();
    expect(drafts.get(GUILD_CHAT)).toBe('Hallo');
  });
});

describe('the buddy list', () => {
  it('sends the typed name of a request and empties the field', async () => {
    const ctx = fakeCtx();
    clientFeature.acts(ctx);
    drafts.set(FRIEND_NAME, ' Berta ');
    send('friendform');
    await vi.waitFor(() => expect(drafts.get(FRIEND_NAME)).toBe(''));
    expect(ctx.act).toHaveBeenCalledWith('requestFriend', { name: 'Berta' });
  });

  it('keeps the name when the request is refused, and sends nothing without one', async () => {
    const ctx = fakeCtx({ act: vi.fn(async () => false) });
    clientFeature.acts(ctx);
    send('friendform');
    expect(ctx.act).not.toHaveBeenCalled();
    drafts.set(FRIEND_NAME, 'Berta');
    send('friendform');
    await vi.waitFor(() => expect(ctx.act).toHaveBeenCalled());
    await Promise.resolve();
    expect(drafts.get(FRIEND_NAME)).toBe('Berta');
  });

  it('does not empty the name for the other buttons', async () => {
    const ctx = fakeCtx();
    const acts = clientFeature.acts(ctx);
    drafts.set(FRIEND_NAME, 'Berta');
    await acts.friend!({ op: 'accept', uid: 'u1' });
    expect(ctx.act).toHaveBeenCalledWith('answerFriend', {
      uid: 'u1',
      accept: true,
    });
    expect(drafts.get(FRIEND_NAME)).toBe('Berta');
  });
});
