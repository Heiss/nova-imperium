// The confirmation of „Account löschen“ renders as before #118, package 8
// („no visible change“ of the issue): the old HTML string of
// src/client/views/misc.ts is frozen here and compared with the component
// views/DeleteAccountDialog.svelte, up to what a browser does not show
// (normalize() of markup.ts).
import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import { deleteAccountDialogText } from '../client/logic/options.ts';
import DeleteAccountDialog from '../client/views/DeleteAccountDialog.svelte';
import { normalize, stripComments, textContents } from './markup.ts';

const guildNote = (guilds: boolean, sentence: string): string =>
  guilds ? ` ${sentence}` : '';

/** The dialog before the component. */
const frozen = (guilds: boolean): string =>
  `<form id="deleteaccountform"><p>Dein Konto und deine Spielstände werden unwiderruflich gelöscht.${guildNote(guilds, 'Eine von dir geleitete Gilde wird aufgelöst.')}</p><p><label for="delete-account-password">Passwort zur Bestätigung</label> <input id="delete-account-password" type="password" autocomplete="current-password" required></p><button class="red" type="submit">Account endgültig löschen</button> <button type="button" data-act="closeModal">Abbrechen</button></form>`;

/** The server side writes `value=""` for the bound, still empty password; no browser shows it. */
const component = (guilds: boolean): string =>
  stripComments(
    render(DeleteAccountDialog, {
      props: {
        text: deleteAccountDialogText({ guilds }),
        confirm: async () => true,
      },
    }).body,
  ).replace(' value=""', '');

describe('the confirmation of „Account löschen“ as a component', () => {
  for (const guilds of [true, false])
    it(`renders the markup of the HTML string (guilds ${guilds})`, () => {
      expect(normalize(component(guilds))).toBe(normalize(frozen(guilds)));
      expect(textContents(component(guilds))).toEqual(
        textContents(frozen(guilds)),
      );
    });

  it('names a led guild only while guilds are on', () => {
    expect(component(true)).toContain('Eine von dir geleitete Gilde');
    expect(component(false)).not.toContain('Gilde');
  });

  it('keeps the ids the E2E suite and the feature read', () => {
    const html = component(true);
    for (const mark of [
      'id="deleteaccountform"',
      'id="delete-account-password"',
      'data-act="closeModal"',
    ])
      expect(html).toContain(mark);
  });
});
