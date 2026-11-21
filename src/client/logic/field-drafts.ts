// What the player typed or chose in the fields of a view (#118, package 8;
// replaces keepInputs of main.ts). Every change of a field is recorded here
// as it happens (field-drafts.ts of the page), so a redraw of the view (the
// poll of the state mounts it anew) shows the draft again and never the
// state of the page at the moment of the redraw. The draft is dropped where
// the typed fields were dropped before: by a fresh render (another view or
// planet) and by a logout.
import { keeps } from './jump-gate.ts';

/**
 * The fields that show what the server says and have no draft: the settings
 * of the universe (their own draft is logic/settings-draft.ts), the link of
 * the invitation, the confirmation of a dissolving (a modal outside the
 * view), the two fields with a draft of their own (logic/drafts.svelte.ts),
 * and the fields of the forms that keep their own state (#332,
 * logic/form-state.svelte.ts): the filter of the achievements, the position
 * of the Sternenkarte, the marketplace, the fleet form but its
 * Warp-Tor, „Optionen“, „Gilden“, and the
 * invitation, the message to all players and the filters of „Admin“.
 */
const UNTRACKED =
  /^(set_.+|inv_link|dissolve_tag|chat_text|friend_name|achievement_(search|category|status)|g_[gs]|market-(give|get|amount)|f_.+|t_([gspvkmuqh]|stay)|c_[mcd]|un_name_.+|o_(probes|explain|levels|main)|pw_(current|next|confirm)|passkey-password|reportform-text|guild_(tag|name|description)|rank_.+|inv_email|announce-text|audit-(player|outcome))$/;

/** Whether the field with this id has a draft. */
export const isTracked = (id: string): boolean => !UNTRACKED.test(id);

/** One field of the page, as far as the drafts need to know it. */
export interface Field {
  id: string;
  value: string;
  options?: ArrayLike<{ value: string; disabled: boolean }> | null;
}

export class FieldDrafts {
  readonly #values = new Map<string, string>();

  /** The player changed the field; a field without a draft is ignored. */
  record(field: Field): void {
    if (isTracked(field.id)) this.#values.set(field.id, field.value);
  }

  /**
   * What to put back into the field after a redraw: nothing or a value. The
   * ticks of the rank boxes of a guild are the state of its form now
   * (logic/guild-form.svelte.ts, #332).
   */
  restore(field: Field): { value?: string } {
    const value = this.#values.get(field.id);
    return value !== undefined && keeps(field, value) ? { value } : {};
  }

  /** Drops every draft. */
  reset(): void {
    this.#values.clear();
  }
}

export const fieldDrafts = new FieldDrafts();
