// The browser side of the attack union („Verbandsangriff“, #225): opening a
// union from an own Sturmangriff, inviting a player by name, and joining:
// „Beitreten“ and the choice „Verband“ of the fleet form fill the form with
// the target and the mission of the union. The fleet form itself sends the
// join (the field `union` of „send“, features/fleet.ts); the markup is in
// views/union.ts, what it shows in logic/union.ts. The position of the
// target and the names to invite are the state of the fleet form
// (logic/fleet-form.svelte.ts, #332).
import { flushSync } from 'svelte';
import { fleetForm } from '../logic/fleet-form.svelte.ts';
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
  const { g, s, p } = choice.to;
  fleetForm.to = { g: String(g), s: String(s), p: String(p) };
  setInput('#t_k', kind);
  setInput('#t_m', 'attack');
  // The position is in the field before the input event reads it.
  flushSync();
  document
    .getElementById('t_g')
    ?.dispatchEvent(new Event('input', { bubbles: true }));
}

/** The data-act handlers of the attack union; the choice in the fleet form is listened to here. */
export const clientFeature = {
  listen: (ctx) => {
    document.addEventListener('change', (e) => {
      const field = e.target as HTMLSelectElement;
      if (field.id === 't_u') pick(ctx, field.value);
    });
  },
  acts: (ctx) => ({
    openUnion: (d) => ctx.act('openUnion', { id: d.id }),
    inviteUnion: async (d) => {
      const id = d.id ?? '';
      const name = (fleetForm.invite[id] ?? '').trim();
      if (name && (await ctx.act('inviteUnion', { id, name })))
        fleetForm.invite[id] = '';
    },
    joinUnion: (d) => pick(ctx, d.id ?? ''),
  }),
} satisfies ClientFeature;
