// What the player typed into a field of a view and has not sent yet (#118,
// package 8). The field shows the draft from here and writes every key back,
// so a redraw of the page (the poll of the state mounts the view anew) shows
// the same text again; such a field has no field draft (logic/field-drafts.ts). A fresh render (another view or planet, a login)
// drops the drafts, as it dropped the typed fields before.
import { SvelteMap } from 'svelte/reactivity';

/** The fields with a draft: the message of the guild chat (#169) and the name of a new buddy (#227). */
type DraftField = 'guildChat' | 'friendName';

class Drafts {
  readonly #text = new SvelteMap<DraftField, string>();

  /** The draft of the field, or the empty string. */
  get(field: DraftField): string {
    return this.#text.get(field) ?? '';
  }

  /** The player typed `text`; an empty text reads like no draft. */
  set(field: DraftField, text: string): void {
    this.#text.set(field, text);
  }

  /** Drops the draft of one field, e.g. once its message went through. */
  clear(field: DraftField): void {
    this.#text.delete(field);
  }

  /** Drops every draft. */
  reset(): void {
    this.#text.clear();
  }
}

export const drafts = new Drafts();
