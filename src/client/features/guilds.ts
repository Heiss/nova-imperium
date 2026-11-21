// The handlers of the guilds (#163, #169): the directory, applying, leaving,
// the members and their ranks, dissolving, and the admin's look into the chat
// of a guild; the forms of a guild, of a transfer and of a dissolution. The
// chat and the buddy list of the members are in features/social.ts, the
// markup in views/guilds.ts.
import { $, byId, keepChatScroll, val } from '../dom.ts';
import { sameSignIn } from '../logic/guild-chat.ts';
import { guildForm } from '../logic/guild-form.svelte.ts';
import { client } from '../logic/state.svelte.ts';
import {
  adminChatDialog,
  dissolveDialog,
  transferDialog,
} from '../views/guilds.ts';
import type { ClientCtx, ClientFeature, Handler } from './contract.ts';

/** The checked rights of a guild rank (#163), the disabled ones included. */
const rankRights = (rank?: string): string[] =>
  [...document.querySelectorAll<HTMLInputElement>('input[data-rank-right]')]
    .filter((box) => box.dataset.rankRight === rank && box.checked)
    .map((box) => box.value);

/**
 * The admin opens the chat of a guild; the server records it (#169, D8). An
 * answer that comes in after a logout, or with another account signed in,
 * opens nothing (CodeRabbit on #216).
 */
async function openAdminChat(
  { api, modal, toast }: ClientCtx,
  guild: string,
): Promise<void> {
  const admin = client.game?.me.id;
  try {
    const read = await api('/api/admin/guild-chat', { guild });
    if (!sameSignIn(client.game, admin)) return;
    modal(
      adminChatDialog(read as unknown as Parameters<typeof adminChatDialog>[0]),
    );
    keepChatScroll($('#modalIn')!, true)();
  } catch (error) {
    toast((error as Error).message, error as Error);
  }
}

/** The handlers of the guild itself: the directory, applications and members. */
const guildActs = ({ act, go, modal }: ClientCtx): Record<string, Handler> => ({
  guildView: (d) => go('guilds', true, d.id ?? null),
  guildApply: (d) => act('applyToGuild', { id: d.id }),
  guildLeave: (d) => {
    if (!d.confirm || window.confirm(d.confirm)) return act('leaveGuild');
  },
  guildReview: (d) =>
    act('reviewGuildApplication', { uid: d.uid, accept: d.accept === '1' }),
  guildMember: (d) => {
    const ranks = client.game?.guilds?.ranks;
    if (d.transfer === '1' && ranks) {
      const name = client
        .game!.guilds!.directory.flatMap((g) => g.members)
        .find((m) => m.id === d.uid)?.name;
      modal(transferDialog(ranks, d.uid ?? '', name ?? ''));
      return $('#transfer_rank')?.focus();
    }
    if (window.confirm('Mitglied entfernen?'))
      return act('manageGuildMember', { uid: d.uid, transfer: false });
  },
  guildDissolve: (d) => {
    const guild = client.game?.guilds?.directory.find((g) => g.id === d.id);
    if (!guild) return;
    modal(dissolveDialog(guild));
    $('#dissolve_tag')?.focus();
  },
});

/** The handlers of the ranks of a guild and the admin's look into its chat. */
const rankActs = (ctx: ClientCtx): Record<string, Handler> => {
  const { act } = ctx;
  return {
    guildAssign: (d) =>
      act('assignGuildRank', { uid: d.uid, rank: byId(`rank_of_${d.uid}`) }),
    rankCreate: async () => {
      if (await act('createGuildRank', { name: byId('rank_new') }))
        guildForm.rankNew = '';
    },
    rankRename: (d) =>
      act('renameGuildRank', {
        rank: d.rank,
        name: byId(`rank_name_${d.rank}`),
      }),
    rankRights: (d) =>
      act('setGuildRankRights', { rank: d.rank, rights: rankRights(d.rank) }),
    rankMove: (d) => act('moveGuildRank', { rank: d.rank, up: d.up === '1' }),
    rankDelete: (d) => {
      if (
        window.confirm(
          'Rang löschen? Seine Mitglieder bekommen den Standardrang.',
        )
      )
        return act('deleteGuildRank', { rank: d.rank });
    },
    rankDefault: (d) => act('setGuildDefaultRank', { rank: d.rank }),
    guildChatAdmin: (d) => openAdminChat(ctx, d.id ?? ''),
  };
};

/** The data-act handlers and the forms of the guilds. */
export const clientFeature = {
  acts: (ctx) => ({ ...guildActs(ctx), ...rankActs(ctx) }),
  forms: ({ act, go, modal }) => ({
    guildform: async () => {
      const edit = $('#guildform')?.dataset.edit === '1';
      const ok = await act(edit ? 'updateGuild' : 'createGuild', {
        tag: val('#guild_tag'),
        name: val('#guild_name'),
        description: val('#guild_description'),
      });
      if (ok && !edit) go('guilds', true, client.game?.guilds?.own?.id ?? null);
    },
    guildtransferform: async () => {
      const ok = await act('manageGuildMember', {
        uid: $('#guildtransferform')?.dataset.uid,
        transfer: true,
        rank: val('#transfer_rank'),
      });
      if (ok) modal('');
    },
    guilddissolveform: async () => {
      if (await act('dissolveGuild', { tag: val('#dissolve_tag') })) {
        modal('');
        go('guilds');
      }
    },
  }),
} satisfies ClientFeature;
