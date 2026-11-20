// What the player typed into a field of a view and has not sent yet (#118,
// package 8). The field shows the draft from here and writes every key back,
// so a redraw of the page (the poll of the state mounts the view anew) shows
// the same text again and needs no help of keepInputs (keep-inputs.ts): such
// a field is `data-nokeep`. A fresh render (another view or planet, a login)
// drops the drafts, as it dropped the typed fields before.
import { SvelteMap } from 'svelte/reactivity';

/** The field for the message of the guild chat (#169). */
export const GUILD_CHAT = 'guildChat';
/** The field for the name of a new buddy (#227). */
export const FRIEND_NAME = 'friendName';

class Drafts {
  readonly #text = new SvelteMap<string, string>();

  /** The draft of the field, or the empty string. */
  get(field: string): string {
    return this.#text.get(field) ?? '';
  }

  /** The player typed `text`; an empty text is no draft. */
  set(field: string, text: string): void {
    if (text === '') this.#text.delete(field);
    else this.#text.set(field, text);
  }

  /** Drops the draft of one field, e.g. once its message went through. */
  clear(field: string): void {
    this.#text.delete(field);
  }

  /** Drops every draft. */
  reset(): void {
    this.#text.clear();
  }
}

export const drafts = new Drafts();
