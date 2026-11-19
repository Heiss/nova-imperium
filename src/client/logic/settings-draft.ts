// What the admin typed into the settings of the universe and has not saved.
// The fields of the form show the settings of the server and are not kept by
// a redraw (`data-nokeep`: the kept value could not tell a draft from a value
// the server has since changed), but a redraw comes at any time: the list of
// the archive of rounds (#235) draws the admin page again when it has been
// read, and so does every new state. A draft that a redraw wiped was saved as
// the old value, without a message (E2E: the admin specs on a loaded server).
// So the client remembers the edits itself and puts them back after a redraw.

/** The drafts of one account in one round, by the key of the setting. */
export interface SettingsDraft {
  /** The account and the round the drafts belong to; another one drops them. */
  owner: string;
  values: Map<string, string>;
}

export const newDraft = (): SettingsDraft => ({ owner: '', values: new Map() });

/** The drafts of `owner`; those of another account or round are dropped first. */
export function draftsOf(
  draft: SettingsDraft,
  owner: string,
): ReadonlyMap<string, string> {
  if (draft.owner !== owner) {
    draft.owner = owner;
    draft.values.clear();
  }
  return draft.values;
}

/**
 * The admin typed `value` into the field of `key`; `saved` is the value the
 * server has. A field set back to the saved value is no draft, so a later
 * change of the server shows.
 */
export function typed(
  draft: SettingsDraft,
  owner: string,
  key: string,
  value: string,
  saved: string,
): void {
  draftsOf(draft, owner);
  if (value === saved) draft.values.delete(key);
  else draft.values.set(key, value);
}

/** The settings were saved: the form shows the server's values again. */
export const forgetDrafts = (draft: SettingsDraft): void =>
  draft.values.clear();
