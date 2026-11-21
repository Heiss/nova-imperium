// The state of the forms of „Gilden“ (#332): the profile of the guild as
// typed, the names of the ranks, the name of a new rank, the rank chosen for
// a member and the ticks of the rights of a rank. The components show them,
// so the redraw of the poll, which mounts the view anew, keeps them; a field
// nobody touched (absent) shows the page, and a disabled box always shows the
// server (#163). A fresh render and a logout drop them (form-state.svelte.ts).
// features/guilds.ts reads the fields by their ids, which show this state.
import { formState } from './form-state.svelte.ts';

export interface GuildDraft {
  tag?: string;
  name?: string;
  description?: string;
  /** The name typed for a rank, by the id of the rank. */
  rankNames: Record<string, string>;
  /** The name of a new rank. */
  rankNew?: string;
  /** The rank chosen for a member, by the id of the member. */
  rankOf: Record<string, string>;
  /** The tick of a right of a rank, by the id of its box. */
  rights: Record<string, boolean>;
}

export const guildForm = formState((): GuildDraft => ({
  rankNames: {},
  rankOf: {},
  rights: {},
}));

/** What a box of a right shows: the tick of the player, but the server's while it is disabled. */
export const ticked = (
  id: string,
  box: { checked: boolean; disabled: boolean },
): boolean =>
  box.disabled ? box.checked : (guildForm.rights[id] ?? box.checked);
