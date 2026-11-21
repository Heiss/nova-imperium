// The handlers of the admin page: the tabs, the invitations (inviting,
// copying the link, revoking), the servermessage, the Endzeit (F15, #214) and
// the settings of the universe. The panels that fill themselves from the
// server are components with their state in logic/admin-panels.svelte.ts; the
// page is views/admin.ts (#118, bundle 7).
import { $, setById, val } from '../dom.ts';
import { ADMIN_TABS, type AdminTab } from '../logic/admin.ts';
import { adminForm } from '../logic/admin-form.svelte.ts';
import {
  adminTabKey,
  bindAdminPanel,
  forgetAdminPanel,
  openAdminTab,
  refreshInvitations,
} from '../logic/admin-panels.svelte.ts';
import { endzeitNote } from '../logic/endzeit.ts';
import { settingsFrom } from '../logic/game.ts';
import {
  draftsOf,
  forgetDrafts,
  newDraft,
  typed,
} from '../logic/settings-draft.ts';
import { client } from '../logic/state.svelte.ts';
import type { GameState } from '../logic/types.ts';
import { downloadErrors } from '../download.ts';
import { endzeitDialog } from '../views/admin.ts';
import type { ClientCtx, ClientFeature } from './contract.ts';

const draft = newDraft();

/** The account and round of the shown state: a draft belongs to both. */
const ownerOf = (): string =>
  `${client.game!.me.id}/${client.game!.round.number}`;

/** The setting a field of the form is for, and the value the server has. */
function settingOf(
  target: EventTarget | null,
): { key: string; saved: string } | null {
  const key = (target as HTMLElement | null)?.dataset?.setting;
  if (!key || !client.game?.admin) return null;
  const saved = (client.game.cfg as unknown as Record<string, unknown>)[key];
  return { key, saved: String(saved) };
}

/**
 * An admin call of the page: the state it answers with is taken over, its
 * message shown (an error when the mail did not go out). Null after a refusal,
 * which is shown as a note.
 */
async function adminCall(
  { api, apply, toast }: ClientCtx,
  url: string,
  body: object,
): Promise<Record<string, unknown> | null> {
  try {
    const j = await api(url, body);
    apply(j.state as GameState);
    if (j.msg) toast(String(j.msg), j.mailed === false);
    return j;
  } catch (e) {
    toast((e as Error).message, true);
    return null;
  }
}

let announcementPending = false;

/** The forms of the page: inviting someone and the message to all players. */
const adminForms = (ctx: ClientCtx): Record<string, () => unknown> => ({
  inviteform: async () => {
    const j = await adminCall(ctx, '/api/admin/invite', {
      email: val('#inv_email').trim(),
    });
    if (!j) return;
    client.ui.lastLink = String(j.link);
    ctx.render(true);
    refreshInvitations();
  },
  announceform: async () => {
    if (
      announcementPending ||
      !window.confirm('Servernachricht an alle Spieler senden?')
    )
      return;
    announcementPending = true;
    try {
      const result = await ctx.api('/api/admin/announce', {
        message: val('#announce-text'),
      });
      adminForm.announce = '';
      ctx.toast(
        `Servernachricht für ${Number(result.recipients)} Spieler veröffentlicht.`,
      );
    } catch (error) {
      ctx.toast((error as Error).message, true);
    } finally {
      announcementPending = false;
    }
  },
});

/** What the admin types into the settings is remembered over a redraw. */
function watchDrafts(): void {
  const edited = (e: Event): void => {
    const field = settingOf(e.target);
    if (field)
      typed(
        draft,
        ownerOf(),
        field.key,
        (e.target as HTMLInputElement).value,
        field.saved,
      );
  };
  document.addEventListener('input', edited);
  document.addEventListener('change', edited);
}

export const clientFeature = {
  forms: adminForms,
  listen: (ctx) => {
    bindAdminPanel({
      api: ctx.api,
      signedOut: ctx.signedOut,
      download: (body) => downloadErrors(body, ctx.signedOut),
    });
    document.addEventListener('keydown', adminTabKey);
    watchDrafts();
  },
  acts: (ctx) => {
    const { act, modal, toast } = ctx;
    return {
      adminTab: (d) => {
        if (d.tab && Object.hasOwn(ADMIN_TABS, d.tab))
          openAdminTab(d.tab as AdminTab);
      },
      revoke: async (d) => {
        if (await adminCall(ctx, '/api/admin/revoke', { id: d.id }))
          refreshInvitations();
      },
      endzeit: () => modal(endzeitDialog(client.game!.admin!.endzeit.minutes)),
      doEndzeit: () => {
        const minutes = val('#endzeit-minutes');
        // The check of the server (F15, #214): a refusal without a request.
        const note = endzeitNote(client.game!.admin!.endzeit.done, minutes);
        modal('');
        return note ? toast(note, true) : act('endzeit', { minutes });
      },
      // A refusal keeps what was typed; a saved form shows the server again.
      saveSettings: async () => {
        const keys = client.game!.admin!.specs.map((x) => x.key);
        const saved = await act('settings', {
          settings: settingsFrom(keys, (k) => val(`#set_${k}`)),
        });
        if (saved) forgetDrafts(draft);
        return saved;
      },
      copyLink: async () => {
        const input = $<HTMLInputElement>('#inv_link');
        if (!input) return;
        input.select();
        try {
          await navigator.clipboard.writeText(input.value);
          toast('Link kopiert.');
        } catch {
          toast('Bitte den markierten Link selbst kopieren.', true);
        }
      },
    };
  },
  // The fields do not keep their value over a redraw; what the admin typed
  // and has not saved goes back into them (logic/settings-draft.ts).
  afterRender: () => {
    // The panels are kept only while the admin stays on the page.
    if (client.ui.view !== 'admin' || !client.game?.me.admin)
      forgetAdminPanel();
    if (!client.game?.admin) return;
    for (const [key, value] of draftsOf(draft, ownerOf())) {
      setById(`set_${key}`, value);
    }
  },
} satisfies ClientFeature;
