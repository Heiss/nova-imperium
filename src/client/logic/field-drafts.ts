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
 * view), and the two fields with a draft of their own (logic/drafts.svelte.ts).
 */
const UNTRACKED =
  /^(set_.+|inv_link|dissolve_tag|chat_text|friend_name|achievement_(search|category|status)|g_[gs])$/;

/** Whether the field with this id has a draft. */
export const isTracked = (id: string): boolean => !UNTRACKED.test(id);

/** One field of the page, as far as the drafts need to know it. */
export interface Field {
  id: string;
  value: string;
  checked?: boolean;
  disabled?: boolean;
  /** A guild rank box: its draft is the tick, not the value. */
  rankRight?: boolean;
  options?: ArrayLike<{ value: string; disabled: boolean }> | null;
}

export class FieldDrafts {
  readonly #values = new Map<string, string>();
  readonly #ticks = new Map<string, boolean>();

  /** The player changed the field; a field without a draft is ignored. */
  record(field: Field): void {
    if (!isTracked(field.id)) return;
    if (field.rankRight) this.#ticks.set(field.id, field.checked === true);
    else this.#values.set(field.id, field.value);
  }

  /** What to put back into the field after a redraw: nothing, a value or a tick. */
  restore(field: Field): { value?: string; checked?: boolean } {
    if (field.rankRight) {
      const on = this.#ticks.get(field.id);
      // A disabled box shows the state of the server, it is no draft (#163).
      return on === undefined || field.disabled ? {} : { checked: on };
    }
    const value = this.#values.get(field.id);
    return value !== undefined && keeps(field, value) ? { value } : {};
  }

  /** Drops every draft. */
  reset(): void {
    this.#values.clear();
    this.#ticks.clear();
  }
}

export const fieldDrafts = new FieldDrafts();
