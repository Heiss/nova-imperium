// The handlers of the guild chat (#169) and the buddy list (#227): which
// action each sends, when the draft goes and when the question is asked. The
// fields show the drafts of logic/drafts.svelte.ts (#118, package 8).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { drafts, FRIEND_NAME, GUILD_CHAT } from '../logic/drafts.svelte.ts';
import { clientFeature } from './social.ts';
import { fakeCtx } from './test-ctx.ts';

type Field = { value: string; focus: ReturnType<typeof vi.fn> };
let fields: Record<string, Field>;
let submit: (e: { target: { id: string }; preventDefault: () => void }) => void;
let confirm: ReturnType<typeof vi.fn>;

const field = (value = ''): Field => ({ value, focus: vi.fn() });

beforeEach(() => {
  fields = {};
  confirm = vi.fn(() => true);
  vi.stubGlobal('window', { confirm });
  vi.stubGlobal('document', {
    querySelector: (sel: string) => fields[sel] ?? null,
    addEventListener: (type: string, fn: typeof submit) => {
      if (type === 'submit') submit = fn;
    },
  });
});
afterEach(() => {
  drafts.reset();
  vi.unstubAllGlobals();
});

const acts = (ctx = fakeCtx()) => clientFeature.acts(ctx);
/** Submits the form with `id`; true when the browser's own submit was stopped. */
const send = (id: string): boolean => {
  const preventDefault = vi.fn();
  submit({ target: { id }, preventDefault });
  return preventDefault.mock.calls.length === 1;
};
const settle = () => new Promise((r) => setTimeout(r, 0));

describe('the guild chat form', () => {
  it('sends the draft, empties it and focuses the field', async () => {
    const ctx = fakeCtx();
    acts(ctx);
    fields['#chat_text'] = field();
    drafts.set(GUILD_CHAT, 'Hallo');
    expect(send('guildchatform')).toBe(true);
    await settle();
    expect(ctx.act).toHaveBeenCalledWith('sendGuildChat', { text: 'Hallo' });
    expect(drafts.get(GUILD_CHAT)).toBe('');
    expect(fields['#chat_text']!.focus).toHaveBeenCalledOnce();
  });
  it('keeps the field when the message did not go through', async () => {
    const ctx = fakeCtx({ act: vi.fn(async () => false) });
    acts(ctx);
    fields['#chat_text'] = field();
    drafts.set(GUILD_CHAT, 'Hallo');
    send('guildchatform');
    await settle();
    expect(drafts.get(GUILD_CHAT)).toBe('Hallo');
    expect(fields['#chat_text']!.focus).not.toHaveBeenCalled();
  });
  it('keeps a new draft typed while the message was on its way', async () => {
    const input = field();
    fields['#chat_text'] = input;
    drafts.set(GUILD_CHAT, 'Hallo');
    const ctx = fakeCtx({
      act: vi.fn(async () => {
        drafts.set(GUILD_CHAT, 'Neuer Entwurf');
        return true;
      }),
    });
    acts(ctx);
    send('guildchatform');
    await settle();
    expect(drafts.get(GUILD_CHAT)).toBe('Neuer Entwurf');
    expect(input.focus).not.toHaveBeenCalled();
  });
  it('ignores the submit of any other form', async () => {
    const ctx = fakeCtx();
    acts(ctx);
    expect(send('other')).toBe(false);
    await settle();
    expect(ctx.act).not.toHaveBeenCalled();
  });
});

describe('deleting a chat message', () => {
  it('asks first and sends the id as a number', () => {
    const ctx = fakeCtx();
    acts(ctx).guildChatDelete!({ id: '42' });
    expect(confirm).toHaveBeenCalledWith('Nachricht löschen?');
    expect(ctx.act).toHaveBeenCalledWith('deleteGuildChat', { id: 42 });
  });
  it('sends nothing when the question is refused', () => {
    confirm.mockReturnValue(false);
    const ctx = fakeCtx();
    acts(ctx).guildChatDelete!({ id: '42' });
    expect(ctx.act).not.toHaveBeenCalled();
  });
});

describe('the buddy list', () => {
  it('sends a request with the trimmed name from the form and empties the field', async () => {
    const ctx = fakeCtx();
    acts(ctx);
    drafts.set(FRIEND_NAME, '  Ada ');
    expect(send('friendform')).toBe(true);
    await settle();
    expect(ctx.act).toHaveBeenCalledWith('requestFriend', { name: 'Ada' });
    expect(drafts.get(FRIEND_NAME)).toBe('');
  });
  it('sends nothing without a typed name and keeps the field', async () => {
    const ctx = fakeCtx();
    const a = acts(ctx);
    drafts.set(FRIEND_NAME, '   ');
    await a.friend!({ op: 'request' });
    expect(ctx.act).not.toHaveBeenCalled();
    expect(drafts.get(FRIEND_NAME)).toBe('   ');
  });
  it('keeps the name when the request was refused', async () => {
    const ctx = fakeCtx({ act: vi.fn(async () => false) });
    drafts.set(FRIEND_NAME, 'Ada');
    await acts(ctx).friend!({ op: 'request' });
    expect(drafts.get(FRIEND_NAME)).toBe('Ada');
  });
  it('answers, refuses and cancels without a question and without touching the name field', async () => {
    const ctx = fakeCtx();
    drafts.set(FRIEND_NAME, 'Ada');
    const a = acts(ctx);
    await a.friend!({ op: 'accept', uid: 'u1' });
    await a.friend!({ op: 'refuse', uid: 'u2' });
    await a.friend!({ op: 'cancel', uid: 'u3' });
    expect(ctx.act).toHaveBeenNthCalledWith(1, 'answerFriend', {
      uid: 'u1',
      accept: true,
    });
    expect(ctx.act).toHaveBeenNthCalledWith(2, 'answerFriend', {
      uid: 'u2',
      accept: false,
    });
    expect(ctx.act).toHaveBeenNthCalledWith(3, 'cancelFriend', { uid: 'u3' });
    expect(confirm).not.toHaveBeenCalled();
    expect(drafts.get(FRIEND_NAME)).toBe('Ada');
  });
  it('removes a friend only after the question is confirmed', async () => {
    const ctx = fakeCtx();
    const a = acts(ctx);
    confirm.mockReturnValueOnce(false);
    await a.friend!({ op: 'remove', uid: 'u1' });
    expect(ctx.act).not.toHaveBeenCalled();
    await a.friend!({ op: 'remove', uid: 'u1' });
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(ctx.act).toHaveBeenCalledWith('removeFriend', { uid: 'u1' });
  });
  it('sends nothing for an unknown button', async () => {
    const ctx = fakeCtx();
    await acts(ctx).friend!({ op: 'nope' });
    expect(ctx.act).not.toHaveBeenCalled();
  });
});
