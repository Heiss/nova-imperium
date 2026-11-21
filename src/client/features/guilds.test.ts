import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { client } from '../logic/state.svelte.ts';
import type { GameState } from '../logic/types.ts';
import { clientFeature } from './guilds.ts';
import { fakeCtx } from './test-ctx.ts';

// The markup of the dialogs is tested with the views; here only what a
// handler shows and sends.
vi.mock('../views/guilds.ts', () => ({
  transferDialog: (_ranks: unknown, uid: string, name: string) =>
    `transfer:${uid}:${name}`,
  dissolveDialog: (g: { tag: string }) => `dissolve:${g.tag}`,
  adminChatDialog: (read: { guild: { tag: string } }) =>
    `chat:${read.guild.tag}`,
}));

type Field = {
  value: string;
  focus?: () => void;
  dataset?: Record<string, string>;
  querySelector?: () => null;
};
let fields: Record<string, Field>;
let boxes: {
  value: string;
  checked: boolean;
  dataset: { rankRight: string };
}[];
let confirm: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fields = {};
  boxes = [];
  confirm = vi.fn(() => true);
  vi.stubGlobal('window', { confirm });
  vi.stubGlobal('document', {
    getElementById: (id: string) => fields[id] ?? null,
    querySelector: (sel: string) => fields[sel] ?? null,
    querySelectorAll: () => boxes,
  });
  client.game = {
    me: { id: 'me' },
    guilds: {
      ranks: { list: [], members: {} },
      directory: [
        { id: 'g1', tag: 'ABC', members: [{ id: 'u1', name: 'Ada' }] },
      ],
      own: { id: 'g1' },
    },
  } as unknown as GameState;
});
afterEach(() => {
  vi.unstubAllGlobals();
  client.game = null;
});

const acts = (ctx = fakeCtx()) => clientFeature.acts(ctx);
const forms = (ctx = fakeCtx()) => clientFeature.forms(ctx);

describe('the handlers of the guilds', () => {
  it('opens a guild in the view, or the directory without an id', () => {
    const ctx = fakeCtx();
    acts(ctx).guildView!({ id: 'g1' });
    acts(ctx).guildView!({});
    expect(ctx.go).toHaveBeenNthCalledWith(1, 'guilds', true, 'g1');
    expect(ctx.go).toHaveBeenNthCalledWith(2, 'guilds', true, null);
  });

  it('applies, and reviews an application as accepted only for "1"', () => {
    const ctx = fakeCtx();
    acts(ctx).guildApply!({ id: 'g1' });
    acts(ctx).guildReview!({ uid: 'u1', accept: '1' });
    acts(ctx).guildReview!({ uid: 'u2', accept: '0' });
    expect(ctx.act).toHaveBeenNthCalledWith(1, 'applyToGuild', { id: 'g1' });
    expect(ctx.act).toHaveBeenNthCalledWith(2, 'reviewGuildApplication', {
      uid: 'u1',
      accept: true,
    });
    expect(ctx.act).toHaveBeenNthCalledWith(3, 'reviewGuildApplication', {
      uid: 'u2',
      accept: false,
    });
  });

  it('leaves at once without a question, else only after the player confirms', () => {
    const ctx = fakeCtx();
    acts(ctx).guildLeave!({});
    expect(ctx.act).toHaveBeenCalledWith('leaveGuild');
    expect(confirm).not.toHaveBeenCalled();
    vi.mocked(ctx.act).mockClear();
    confirm.mockReturnValueOnce(false);
    acts(ctx).guildLeave!({ confirm: 'Wirklich?' });
    expect(confirm).toHaveBeenCalledWith('Wirklich?');
    expect(ctx.act).not.toHaveBeenCalled();
    acts(ctx).guildLeave!({ confirm: 'Wirklich?' });
    expect(ctx.act).toHaveBeenCalledWith('leaveGuild');
  });

  it('opens the transfer dialog for a member and focuses the rank', () => {
    const ctx = fakeCtx();
    const focus = vi.fn();
    fields['#transfer_rank'] = { value: '', focus };
    acts(ctx).guildMember!({ transfer: '1', uid: 'u1' });
    expect(ctx.modal).toHaveBeenCalledWith('transfer:u1:Ada');
    expect(focus).toHaveBeenCalled();
    expect(ctx.act).not.toHaveBeenCalled();
  });

  it('removes a member only after the player confirms', () => {
    const ctx = fakeCtx();
    confirm.mockReturnValueOnce(false);
    acts(ctx).guildMember!({ uid: 'u1' });
    expect(ctx.act).not.toHaveBeenCalled();
    acts(ctx).guildMember!({ uid: 'u1' });
    expect(confirm).toHaveBeenLastCalledWith('Mitglied entfernen?');
    expect(ctx.act).toHaveBeenCalledWith('manageGuildMember', {
      uid: 'u1',
      transfer: false,
    });
  });

  it('removes a member also when a transfer is asked for but no ranks are known', () => {
    client.game!.guilds!.ranks = undefined as never;
    const ctx = fakeCtx();
    acts(ctx).guildMember!({ transfer: '1', uid: 'u1' });
    expect(ctx.modal).not.toHaveBeenCalled();
    expect(ctx.act).toHaveBeenCalledWith('manageGuildMember', {
      uid: 'u1',
      transfer: false,
    });
  });

  it('opens the dissolve dialog for a known guild only', () => {
    const ctx = fakeCtx();
    const focus = vi.fn();
    fields['#dissolve_tag'] = { value: '', focus };
    acts(ctx).guildDissolve!({ id: 'nope' });
    expect(ctx.modal).not.toHaveBeenCalled();
    acts(ctx).guildDissolve!({ id: 'g1' });
    expect(ctx.modal).toHaveBeenCalledWith('dissolve:ABC');
    expect(focus).toHaveBeenCalled();
  });

  it('sends the rank chosen, renamed and created from the fields', async () => {
    const ctx = fakeCtx();
    fields.rank_of_u1 = { value: 'r2' };
    fields.rank_name_r2 = { value: 'Offizier' };
    fields.rank_new = { value: 'Neu' };
    acts(ctx).guildAssign!({ uid: 'u1' });
    acts(ctx).rankRename!({ rank: 'r2' });
    await acts(ctx).rankCreate!({});
    expect(ctx.act).toHaveBeenNthCalledWith(1, 'assignGuildRank', {
      uid: 'u1',
      rank: 'r2',
    });
    expect(ctx.act).toHaveBeenNthCalledWith(2, 'renameGuildRank', {
      rank: 'r2',
      name: 'Offizier',
    });
    expect(ctx.act).toHaveBeenNthCalledWith(3, 'createGuildRank', {
      name: 'Neu',
    });
    expect(fields.rank_new!.value).toBe('');
  });

  it('keeps the name of a new rank when the server refused it', async () => {
    const ctx = fakeCtx({ act: vi.fn(async () => false) });
    fields.rank_new = { value: 'Neu' };
    await acts(ctx).rankCreate!({});
    expect(fields.rank_new.value).toBe('Neu');
  });

  it('sends the checked rights of the rank, the disabled ones included', () => {
    const ctx = fakeCtx();
    boxes = [
      { value: 'invite', checked: true, dataset: { rankRight: 'r2' } },
      { value: 'kick', checked: false, dataset: { rankRight: 'r2' } },
      { value: 'chat', checked: true, dataset: { rankRight: 'r3' } },
      { value: 'edit', checked: true, dataset: { rankRight: 'r2' } },
    ];
    acts(ctx).rankRights!({ rank: 'r2' });
    expect(ctx.act).toHaveBeenCalledWith('setGuildRankRights', {
      rank: 'r2',
      rights: ['invite', 'edit'],
    });
  });

  it('moves and sets the default rank, and deletes one only after a question', () => {
    const ctx = fakeCtx();
    acts(ctx).rankMove!({ rank: 'r2', up: '1' });
    acts(ctx).rankMove!({ rank: 'r2', up: '0' });
    acts(ctx).rankDefault!({ rank: 'r2' });
    expect(ctx.act).toHaveBeenNthCalledWith(1, 'moveGuildRank', {
      rank: 'r2',
      up: true,
    });
    expect(ctx.act).toHaveBeenNthCalledWith(2, 'moveGuildRank', {
      rank: 'r2',
      up: false,
    });
    expect(ctx.act).toHaveBeenNthCalledWith(3, 'setGuildDefaultRank', {
      rank: 'r2',
    });
    vi.mocked(ctx.act).mockClear();
    confirm.mockReturnValueOnce(false);
    acts(ctx).rankDelete!({ rank: 'r2' });
    expect(ctx.act).not.toHaveBeenCalled();
    acts(ctx).rankDelete!({ rank: 'r2' });
    expect(confirm).toHaveBeenLastCalledWith(
      'Rang löschen? Seine Mitglieder bekommen den Standardrang.',
    );
    expect(ctx.act).toHaveBeenCalledWith('deleteGuildRank', { rank: 'r2' });
  });
});

describe('the chat of a guild for the admin', () => {
  const read = { guild: { tag: 'ABC' }, messages: [] };
  const open = (ctx = fakeCtx()) => acts(ctx).guildChatAdmin!({ id: 'g1' });

  it('asks the server for the chat and shows it in the dialog', async () => {
    const ctx = fakeCtx({ api: vi.fn(async () => read) });
    // The log scrolls to its end: this page has no log, so nothing moves.
    fields['#modalIn'] = { value: '', querySelector: () => null };
    await open(ctx);
    expect(ctx.api).toHaveBeenCalledWith('/api/admin/guild-chat', {
      guild: 'g1',
    });
    expect(ctx.modal).toHaveBeenCalledWith('chat:ABC');
  });

  it('shows nothing when another account is signed in by the answer', async () => {
    const ctx = fakeCtx({
      api: vi.fn(async () => {
        client.game = { me: { id: 'other' } } as unknown as GameState;
        return read;
      }),
    });
    await open(ctx);
    expect(ctx.modal).not.toHaveBeenCalled();
    expect(ctx.toast).not.toHaveBeenCalled();
  });

  it('shows nothing after a logout while the answer was on its way', async () => {
    const ctx = fakeCtx({
      api: vi.fn(async () => {
        client.game = null;
        return read;
      }),
    });
    await open(ctx);
    expect(ctx.modal).not.toHaveBeenCalled();
  });

  it('shows the refusal of the server as an error', async () => {
    const ctx = fakeCtx({
      api: vi.fn(async () => {
        throw new Error('Kein Zugriff.');
      }),
    });
    await open(ctx);
    expect(ctx.toast).toHaveBeenCalledWith('Kein Zugriff.', true);
    expect(ctx.modal).not.toHaveBeenCalled();
  });
});

describe('the forms of the guilds', () => {
  const profile = () => {
    fields['#guild_tag'] = { value: 'ABC' };
    fields['#guild_name'] = { value: 'Die Abc' };
    fields['#guild_description'] = { value: 'Text' };
  };

  it('founds a guild and opens its page', async () => {
    const ctx = fakeCtx();
    profile();
    fields['#guildform'] = { value: '', dataset: { edit: '0' } };
    await forms(ctx).guildform!();
    expect(ctx.act).toHaveBeenCalledWith('createGuild', {
      tag: 'ABC',
      name: 'Die Abc',
      description: 'Text',
    });
    expect(ctx.go).toHaveBeenCalledWith('guilds', true, 'g1');
  });

  it('does not open the page when the founding is refused', async () => {
    const ctx = fakeCtx({ act: vi.fn(async () => false) });
    profile();
    await forms(ctx).guildform!();
    expect(ctx.go).not.toHaveBeenCalled();
  });

  it('saves the profile of an own guild and stays', async () => {
    const ctx = fakeCtx();
    profile();
    fields['#guildform'] = { value: '', dataset: { edit: '1' } };
    await forms(ctx).guildform!();
    expect(ctx.act).toHaveBeenCalledWith('updateGuild', expect.any(Object));
    expect(ctx.go).not.toHaveBeenCalled();
  });

  it('transfers the leadership and closes the dialog once it went through', async () => {
    const ctx = fakeCtx();
    fields['#guildtransferform'] = { value: '', dataset: { uid: 'u1' } };
    fields['#transfer_rank'] = { value: 'r2' };
    await forms(ctx).guildtransferform!();
    expect(ctx.act).toHaveBeenCalledWith('manageGuildMember', {
      uid: 'u1',
      transfer: true,
      rank: 'r2',
    });
    expect(ctx.modal).toHaveBeenCalledWith('');
  });

  it('keeps the transfer dialog open when it was refused', async () => {
    const ctx = fakeCtx({ act: vi.fn(async () => false) });
    await forms(ctx).guildtransferform!();
    expect(ctx.modal).not.toHaveBeenCalled();
  });

  it('dissolves with the tag typed, closes the dialog and shows the directory', async () => {
    const ctx = fakeCtx();
    fields['#dissolve_tag'] = { value: 'ABC' };
    await forms(ctx).guilddissolveform!();
    expect(ctx.act).toHaveBeenCalledWith('dissolveGuild', { tag: 'ABC' });
    expect(ctx.modal).toHaveBeenCalledWith('');
    expect(ctx.go).toHaveBeenCalledWith('guilds');
  });

  it('keeps the dialog when the dissolution was refused', async () => {
    const ctx = fakeCtx({ act: vi.fn(async () => false) });
    await forms(ctx).guilddissolveform!();
    expect(ctx.modal).not.toHaveBeenCalled();
    expect(ctx.go).not.toHaveBeenCalled();
  });
});
