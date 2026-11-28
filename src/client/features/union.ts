// The browser side of the attack union („Verbandsangriff“, #225, #466):
// planning a union with an own Sturmangriff (the choice „Neuen Verband
// planen“ of the row „Verband“ and its arrival), inviting a player by name,
// and joining: „Beitreten“ and the choice „Verband“ of the fleet form fill
// the form with the target and the mission of the union. The fleet form
// itself sends the plan and the join (the fields `plan` and `union` of
// „send“, features/fleet.ts); the markup is in
// views/union.ts, what it shows in logic/union.ts. The position of the
// target, the kind, the mission, the union chosen and the names to invite are
// the state of the fleet form (logic/fleet-form.svelte.ts, #332).
import { flushSync } from 'svelte';
import { fleetForm } from '../logic/fleet-form.svelte.ts';
import { joinChoices, PLAN } from '../logic/union.ts';
import { client } from '../logic/state.svelte.ts';
import type { ClientFeature } from './contract.ts';

/**
 * Fills the fleet form for the union `id` (or clears the choice): the target
 * and a Sturmangriff, and calculates the preview again.
 */
function pick(id: string): void {
  // Planning keeps the target typed and makes the mission a Sturmangriff.
  if (id === PLAN) {
    client.ui.union = null;
    fleetForm.union = PLAN;
    fleetForm.mission = 'attack';
    return;
  }
  const choice = client.view
    ? joinChoices(client.view).find((c) => c.id === id)
    : undefined;
  client.ui.union = choice?.id ?? null;
  fleetForm.union = choice?.id ?? '';
  if (!choice) return;
  const kind = choice.moon ? 'moon' : 'planet';
  client.ui.ft = { ...choice.to, kind };
  client.ui.fm = 'attack';
  client.ui.fk = kind;
  const { g, s, p } = choice.to;
  fleetForm.to = { g: String(g), s: String(s), p: String(p) };
  fleetForm.kind = kind;
  fleetForm.mission = 'attack';
  // The position is in the field before the input event reads it.
  flushSync();
  document
    .getElementById('t_g')
    ?.dispatchEvent(new Event('input', { bubbles: true }));
}

/** The data-act handlers of the attack union; the choice in the fleet form is listened to here. */
export const clientFeature = {
  listen: () => {
    document.addEventListener('change', (e) => {
      const field = e.target as HTMLSelectElement;
      if (field.id === 't_u') pick(field.value);
    });
  },
  acts: (ctx) => ({
    inviteUnion: async (d) => {
      const id = d.id ?? '';
      const name = (fleetForm.invite[id] ?? '').trim();
      if (name && (await ctx.act('inviteUnion', { id, name })))
        fleetForm.invite[id] = '';
    },
    joinUnion: (d) => pick(d.id ?? ''),
  }),
} satisfies ClientFeature;
