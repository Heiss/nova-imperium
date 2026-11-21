// The private messages as components (#226): the tabs of „Nachrichten“, the
// inbox, the open conversation, the sent messages and the forms; every name
// and text escaped. Rendered on the server side of Svelte (no DOM), as the
// other views are tested; what a click sends is tested in
// features/private-messages.test.ts.
import { readable } from 'svelte/store';
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import { stripComments } from '../../test/markup.ts';
import type { InboxRow, SentRow } from '../logic/private-messages.ts';
import type { GameState } from '../logic/types.ts';
import type { V } from './common.ts';
import { ANEW, MOUNTED } from './mount.ts';
import MessagesTabs from './MessagesTabs.svelte';
import PmCompose from './PmCompose.svelte';

import PmSent from './PmSent.svelte';
import PmSettings from './PmSettings.svelte';
import PmThread from './PmThread.svelte';

const html = (component: unknown, props: object): string =>
  stripComments(render(component as never, { props: props as never }).body);

const row = (over: Partial<InboxRow> = {}): InboxRow => ({
  key: 'Bert',
  name: 'Bert',
  deleted: false,
  unread: 0,
  more: false,
  last: '21.11., 10:00:00',
  lines: [
    {
      id: 1,
      mine: false,
      time: '21.11., 10:00:00',
      text: 'Hallo <b>Anna</b>',
      fresh: true,
    },
    { id: 2, mine: true, time: '21.11., 10:01:00', text: 'Hi', fresh: false },
  ],
  ...over,
});

const state = (privateMessages?: GameState['privateMessages']): V =>
  ({
    s: {
      me: { id: 'u_Anna', readAt: 0 },
      players: {
        u_Anna: { name: 'Anna', points: 1 },
        u_Bert: { name: 'Bert', points: 1 },
      },
      reports: [{ id: 'r1', time: 5, type: 'info', title: 'Bericht' }],
      privateMessages,
    },
    ui: { openRep: {} },
  }) as unknown as V;

describe('the view „Nachrichten“', () => {
  it('is one mounted view that follows the state, not mounted anew, with one menu entry', () => {
    expect(MOUNTED.has('messages')).toBe(true);
    expect(ANEW.has('messages')).toBe(false);
  });

  it('shows the three tabs, the reports first, and keeps the list of reports as it was', () => {
    const out = html(MessagesTabs, { viewState: readable(state()) });
    const labels = [...out.matchAll(/role="tab"[^>]*>([^<]+)</g)].map(
      (m) => m[1],
    );
    expect(labels.map((l) => l!.trim())).toEqual([
      'Berichte',
      'Posteingang',
      'Gesendet',
    ]);
    expect(out).toContain('aria-selected="true"');
    expect(out.match(/<h2>/g)).toHaveLength(1);
    expect(out).toContain('<h2>Nachrichten</h2>');
    expect(out).toContain('Berichte (1)');
    expect(out).toContain('id="rep_r1"');
    // Only the reports show; the other panels are there but hidden.
    expect(out).toMatch(/id="messages-panel-reports"[^>]*role="tabpanel"/);
    expect(out).toMatch(/id="messages-panel-inbox"[^>]*hidden/);
    expect(out).toMatch(/id="messages-panel-sent"[^>]*hidden/);
  });

  it('counts the unread private messages on the tab „Posteingang“', () => {
    const out = html(MessagesTabs, {
      viewState: readable(
        state({
          friendsOnly: false,
          blocked: [],
          conversations: [
            {
              with: 'Bert',
              unread: 3,
              more: false,
              messages: [
                { id: 1, mine: false, time: 1, text: 'x', read: false },
              ],
            },
          ],
        }),
      ),
    });
    expect(out).toMatch(/Posteingang\s*\(3\)/);
  });

  it('shows the empty inbox and the empty sent list', () => {
    const out = html(MessagesTabs, { viewState: readable(state()) });
    expect(out).toContain('Keine Nachrichten.');
    expect(out).toContain('Du hast noch nichts gesendet.');
    expect(out).toContain('Neue Nachricht');
  });

  it('writes a conversation as a button with its unread count', () => {
    const out = html(MessagesTabs, {
      viewState: readable(
        state({
          friendsOnly: false,
          blocked: [],
          conversations: [
            {
              with: '<i>Bert</i>',
              unread: 1,
              more: false,
              messages: [
                { id: 1, mine: false, time: 1, text: 'x', read: false },
              ],
            },
          ],
        }),
      ),
    });
    expect(out).toContain('&lt;i>Bert&lt;/i>');
    expect(out).not.toContain('<i>Bert</i>');
  });
});

describe('the tabs on the lock screen of the vacation mode (owner, 2026-11-21, Q28)', () => {
  const lockState = (): V =>
    ({
      s: {
        me: { id: 'u_Anna', vacation: 1 },
        players: {},
        reports: [],
        privateMessages: {
          friendsOnly: false,
          blocked: ['Cora'],
          conversations: [
            {
              with: 'Bert',
              unread: 2,
              more: false,
              messages: [
                { id: 1, mine: false, time: 1, text: 'Hallo', read: false },
              ],
            },
          ],
        },
      },
    }) as unknown as V;

  it('has „Posteingang“ and „Gesendet“ only, the inbox first, and no reports', () => {
    const out = html(MessagesTabs, {
      viewState: readable(lockState()),
      lock: true,
    });
    const labels = [...out.matchAll(/role="tab"[^>]*>([^<]+)</g)].map((m) =>
      m[1]!.replace(/\s+/g, ''),
    );
    expect(labels).toEqual(['Posteingang(2)', 'Gesendet']);
    // The title of the lock screen stays the only h2.
    expect(out).toContain('<h3>Nachrichten</h3>');
    expect(out).not.toContain('<h2>');
    expect(out).toMatch(/id="messages-panel-inbox"[^>]*role="tabpanel"/);
    expect(out).not.toMatch(/id="messages-panel-inbox"[^>]*hidden/);
    for (const part of [
      'Berichte',
      'messages-tab-reports',
      'messages-panel-reports',
      'delall',
      'Alle löschen',
    ])
      expect(out, part).not.toContain(part);
  });

  it('lists the conversations and offers no new message and no settings', () => {
    const out = html(MessagesTabs, {
      viewState: readable(lockState()),
      lock: true,
    });
    expect(out).toMatch(/Bert\s*\(2\)/);
    for (const part of [
      'Neue Nachricht',
      'id="pm-compose"',
      'Blockierte Spieler',
      'Nur Freunde dürfen mir schreiben',
      'Cora',
    ])
      expect(out, part).not.toContain(part);
  });

  it('is the same tabs with the reports outside of the lock screen', () => {
    const out = html(MessagesTabs, { viewState: readable(state()) });
    expect(out).toContain('messages-tab-reports');
    expect(out).toContain('Neue Nachricht');
    expect(out).toContain('Blockierte Spieler');
  });
});

describe('older messages', () => {
  it('offers „Ältere Nachrichten laden“ only while the conversation has more', () => {
    const more = html(PmThread, { row: row({ more: true }) });
    expect(more).toContain('id="pm-older"');
    expect(more).toContain('>Ältere Nachrichten laden<');
    // The button comes before the messages.
    expect(more.indexOf('pm-older')).toBeLessThan(more.indexOf('role="log"'));
    expect(html(PmThread, { row: row({ more: false }) })).not.toContain(
      'pm-older',
    );
  });
});

describe('an open conversation', () => {
  it('shows each message with its writer, new ones marked, text escaped', () => {
    const out = html(PmThread, { row: row() });
    expect(out).toContain('<h3>Bert</h3>');
    expect(out).toContain('role="log"');
    expect(out).toContain('Hallo &lt;b>Anna&lt;/b>');
    expect(out).not.toContain('<b>Anna</b>');
    expect(out).toContain('<b>Ich</b>');
    expect(out).toContain('<b>Bert</b>');
    expect(out.match(/neu/g)).toHaveLength(1);
  });

  it('offers „Melden“ on a received message only, „Löschen“ on every one', () => {
    const out = html(PmThread, { row: row() });
    expect(out.match(/>Melden</g)).toHaveLength(1);
    expect(out.match(/>Löschen</g)).toHaveLength(2);
  });

  it('offers „Antworten“, „Unterhaltung löschen“ and „Blockieren“', () => {
    const out = html(PmThread, { row: row() });
    expect(out).toContain('id="pm-reply"');
    expect(out).toContain('>Antworten<');
    expect(out).toContain('>Unterhaltung löschen<');
    expect(out).toContain('>Blockieren<');
  });

  it('shows a deleted account in italics, with no reply and no blocking', () => {
    const out = html(PmThread, {
      row: row({ key: '', name: 'Gelöschter Spieler', deleted: true }),
    });
    expect(out).toContain('<i>Gelöschter Spieler</i>');
    expect(out).not.toContain('id="pm-reply"');
    expect(out).not.toContain('>Blockieren<');
    expect(out).toContain('>Unterhaltung löschen<');
  });
});

describe('the sent messages', () => {
  it('lists each with its recipient, time and text, escaped, and „Löschen“', () => {
    const rows: SentRow[] = [
      {
        id: 3,
        to: '<u>Bert</u>',
        time: '21.11., 10:01:00',
        text: '<script>x</script>',
      },
    ];
    const out = html(PmSent, { rows });
    expect(out).toContain('&lt;u>Bert&lt;/u>');
    expect(out).toContain('&lt;script>x&lt;/script>');
    expect(out).not.toContain('<script>');
    expect(out).toContain('>Löschen<');
  });

  it('says so while nothing was sent', () => {
    expect(html(PmSent, { rows: [] })).toContain(
      'Du hast noch nichts gesendet.',
    );
  });
});

describe('the forms', () => {
  it('„Neue Nachricht“ has the recipient with the names, the text up to 1,000 characters and „Senden“', () => {
    const out = html(PmCompose, {
      names: ['Bert', '<b>Cora</b>'],
      sent: () => {},
    });
    expect(out).toContain('for="pm-to"');
    expect(out).toContain('>Empfänger<');
    expect(out).toContain('maxlength="20"');
    expect(out).toContain('maxlength="1000"');
    expect(out).toContain('>Senden<');
    expect(out).toContain('<option value="Bert">');
    expect(out).toContain('&lt;b>Cora&lt;/b>');
  });

  it('„Antworten“ has its own text field', () => {
    const out = html(PmCompose, { to: 'Bert' });
    expect(out).toContain('id="pm-reply-text"');
    expect(out).toContain('maxlength="1000"');
    expect(out).toContain('>Antworten<');
  });

  it('the settings show the switch, the blocked players with „Freigeben“ and a form to block', () => {
    const out = html(PmSettings, {
      friendsOnly: true,
      blocked: ['Cora', '<i>Dirk</i>'],
    });
    expect(out).toMatch(/id="pm-friends-only"[^>]*checked/);
    expect(out).toContain('Nur Freunde dürfen mir schreiben');
    expect(out.match(/>Freigeben</g)).toHaveLength(2);
    expect(out).toContain('&lt;i>Dirk&lt;/i>');
    expect(out).toContain('id="pm-block"');
    const off = html(PmSettings, { friendsOnly: false, blocked: [] });
    expect(off).not.toMatch(/id="pm-friends-only"[^>]*checked/);
    expect(off).toContain('Du hast niemanden blockiert.');
  });
});
