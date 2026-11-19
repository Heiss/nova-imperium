// The browser side of the attack union („Verbandsangriff“, #225): opening a
// union from an own Sturmangriff, inviting a player by name, and joining:
// „Beitreten“ and the choice „Verband“ of the fleet form fill the form with
// the target and the mission of the union. The fleet form itself sends the
// join (the field `union` of „send“, features/fleet.ts); the markup is in
// views/union.ts, what it shows in logic/union.ts.
import { byId, setById } from '../dom.ts';
import { joinChoices } from '../logic/union.ts';
import { client } from '../logic/state.svelte.ts';
import type { ClientCtx, ClientFeature } from './contract.ts';

/**
 * Fills the fleet form for the union `id` (or clears the choice): the target
 * and a Sturmangriff, and calculates the preview again.
 */
function pick({ setInput }: ClientCtx, id: string): void {
  const choice = client.view
    ? joinChoices(client.view).find((c) => c.id === id)
    : undefined;
  client.ui.union = choice?.id ?? null;
  if (!choice) return;
  const kind = choice.moon ? 'moon' : 'planet';
  client.ui.ft = { ...choice.to, kind };
  client.ui.fm = 'attack';
  client.ui.fk = kind;
  setInput('#t_u', choice.id);
  setInput('#t_g', choice.to.g);
  setInput('#t_s', choice.to.s);
  setInput('#t_p', choice.to.p);
  setInput('#t_k', kind);
  setInput('#t_m', 'attack');
  document
    .getElementById('t_g')
    ?.dispatchEvent(new Event('input', { bubbles: true }));
}

/** The data-act handlers of the attack union; the choice in the fleet form is listened to here. */
export const clientFeature = {
  acts: (ctx) => {
    document.addEventListener('change', (e) => {
      const field = e.target as HTMLSelectElement;
      if (field.id === 't_u') pick(ctx, field.value);
    });
    return {
      openUnion: (d) => ctx.act('openUnion', { id: d.id }),
      inviteUnion: async (d) => {
        const field = `un_name_${d.id}`;
        const name = byId(field).trim();
        if (name && (await ctx.act('inviteUnion', { id: d.id, name })))
          setById(field, '');
      },
      joinUnion: (d) => pick(ctx, d.id ?? ''),
    };
  },
} satisfies ClientFeature;
