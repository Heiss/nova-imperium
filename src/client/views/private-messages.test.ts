// The private messages as components (#226): the tabs of „Nachrichten“, the
// inbox, the open conversation, the sent messages and the forms; every name
// and text escaped. Rendered on the server side of Svelte (no DOM), as the
// other views are tested; what a click sends is tested in
// features/private-messages.test.ts.
import { readFileSync } from 'node:fs';
import { readable } from 'svelte/store';
import { render } from 'svelte/server';
import { afterEach, describe, expect, it } from 'vitest';
import { stripComments } from '../../test/markup.ts';
import type {
  InboxRow,
  MessageLine,
  SentList,
  Thread,
} from '../logic/private-messages.ts';
import { forgetDrafts, keepDraft } from '../logic/pm-compose.ts';
import type { GameState } from '../logic/types.ts';
import type { V } from './common.ts';
import { ANEW, MOUNTED } from './mount.ts';
import MessagesTabs from './MessagesTabs.svelte';
import PmCompose from './PmCompose.svelte';
import PmDialog from './PmDialog.svelte';
import PmSent from './PmSent.svelte';
import PmSettings from './PmSettings.svelte';
import PmThread from './PmThread.svelte';

const html = (component: unknown, props: object): string =>
  stripComments(render(component as never, { props: props as never }).body);

const lines: MessageLine[] = [
  {
    id: 1,
    mine: false,
    time: '21.11., 10:00:00',
    text: 'Hallo <b>Anna</b>',
    fresh: true,
  },
  { id: 2, mine: true, time: '21.11., 10:01:00', text: 'Hi', fresh: false },
];

const row = (over: Partial<InboxRow> = {}): InboxRow => ({
  key: 'Bert',
  name: 'Bert',
  deleted: false,
  unread: 0,
  more: false,
  last: '21.11., 10:01:00',
  preview: lines[1]!,
  newer: [],
  ...over,
});

/** The thread an opened conversation starts with (the page of the action). */
const thread = (over: Partial<Thread> = {}): Thread => ({
  lines,
  more: false,
  ...over,
});

const preview = (id: number, text = 'x', read = false) => ({
  id,
  mine: false,
  time: id,
  text,
  read,
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
              last: preview(1),
            },
          ],
        }),
      ),
    });
    expect(out).toMatch(/Posteingang\s*\(3\)/);
  });

  it('shows the empty inbox, and nothing of „Gesendet“ before the tab was opened (it loads then, Q33)', () => {
    const out = html(MessagesTabs, { viewState: readable(state()) });
    expect(out).toContain('Keine Nachrichten.');
    expect(out).not.toContain('Du hast noch nichts gesendet.');
    expect(out).toContain('Neue Nachricht');
  });

  it('shows each conversation as a preview: the newest message, no thread until it is opened (Q32)', () => {
    const out = html(MessagesTabs, {
      viewState: readable(
        state({
          friendsOnly: false,
          blocked: [],
          conversations: [
            {
              with: 'Bert',
              unread: 1,
              more: true,
              last: preview(3, 'Neueste <i>Nachricht</i>'),
            },
          ],
        }),
      ),
    });
    expect(out).toContain('Neueste &lt;i>Nachricht&lt;/i>');
    expect(out).not.toContain('id="pm-thread"');
    expect(out).not.toContain('id="pm-older"');
    expect(out).not.toContain('role="log"');
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
              last: preview(1),
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
              last: preview(1, 'Hallo'),
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
  it('offers „Ältere Nachrichten laden“ only while the thread has more', () => {
    const more = html(PmThread, {
      row: row(),
      initial: thread({ more: true }),
    });
    expect(more).toContain('id="pm-older"');
    expect(more).toContain('>Ältere Nachrichten laden<');
    // The button comes before the messages.
    expect(more.indexOf('pm-older')).toBeLessThan(more.indexOf('role="log"'));
    expect(
      html(PmThread, { row: row(), initial: thread({ more: false }) }),
    ).not.toContain('pm-older');
  });

  it('takes `more` from the thread the action loaded, not from the preview', () => {
    expect(
      html(PmThread, { row: row({ more: true }), initial: thread() }),
    ).not.toContain('pm-older');
  });
});

describe('an open conversation', () => {
  it('shows each message with its writer, new ones marked, text escaped', () => {
    const out = html(PmThread, { row: row(), initial: thread() });
    expect(out).toContain('<h3>Bert</h3>');
    expect(out).toContain('role="log"');
    expect(out).toContain('Hallo &lt;b>Anna&lt;/b>');
    expect(out).not.toContain('<b>Anna</b>');
    expect(out).toContain('<b>Ich</b>');
    expect(out).toContain('<b>Bert</b>');
    expect(out.match(/neu/g)).toHaveLength(1);
  });

  it('offers „Melden“ on a received message only, „Löschen“ on every one', () => {
    const out = html(PmThread, { row: row(), initial: thread() });
    expect(out.match(/>Melden</g)).toHaveLength(1);
    expect(out.match(/>Löschen</g)).toHaveLength(2);
  });

  it('offers „Antworten“, „Unterhaltung löschen“ and „Blockieren“', () => {
    const out = html(PmThread, { row: row(), initial: thread() });
    expect(out).toContain('id="pm-reply"');
    expect(out).toContain('>Antworten<');
    expect(out).toContain('>Unterhaltung löschen<');
    expect(out).toContain('>Blockieren<');
  });

  it('shows a deleted account in italics, with no reply and no blocking', () => {
    const out = html(PmThread, {
      row: row({ key: '', name: 'Gelöschter Spieler', deleted: true }),
      initial: thread(),
    });
    expect(out).toContain('<i>Gelöschter Spieler</i>');
    expect(out).not.toContain('id="pm-reply"');
    expect(out).not.toContain('>Blockieren<');
    expect(out).toContain('>Unterhaltung löschen<');
  });
});

describe('the sent messages (Q33)', () => {
  const list = (over: Partial<SentList> = {}): SentList => ({
    rows: [
      {
        id: 3,
        to: '<u>Bert</u>',
        time: '21.11., 10:01:00',
        text: '<script>x</script>',
      },
    ],
    more: false,
    ...over,
  });

  it('lists each with its recipient, time and text, escaped, and „Löschen“', () => {
    const out = html(PmSent, { initial: list() });
    expect(out).toContain('&lt;u>Bert&lt;/u>');
    expect(out).toContain('&lt;script>x&lt;/script>');
    expect(out).not.toContain('<script>');
    expect(out).toContain('>Löschen<');
  });

  it('says so when the loaded list is empty, and shows nothing before it loaded', () => {
    expect(html(PmSent, { initial: list({ rows: [] }) })).toContain(
      'Du hast noch nichts gesendet.',
    );
    const before = html(PmSent, {});
    expect(before).not.toContain('Du hast noch nichts gesendet.');
    expect(before).not.toContain('Löschen');
  });

  it('offers „Ältere Nachrichten laden“ only while more exist', () => {
    const more = html(PmSent, { initial: list({ more: true }) });
    expect(more).toContain('id="pm-sent-older"');
    expect(more).toContain('>Ältere Nachrichten laden<');
    expect(html(PmSent, { initial: list() })).not.toContain('pm-sent-older');
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

describe('no load without a click (Q32, Q33, #335)', () => {
  // The three loads are sent only from a handler of a click or a key. A
  // redraw by the poll runs `$effect`s and the start of a component, never a
  // handler, so none of them may send a load or call a function that does.
  const dir = new URL('.', import.meta.url);
  const sources = Object.fromEntries(
    [
      'PmInbox.svelte',
      'PmThread.svelte',
      'PmSent.svelte',
      'MessagesTabs.svelte',
    ].map((name) => [name, readFileSync(new URL(name, dir), 'utf8')]),
  );

  /** The text of every `$effect(` block of a source, by matching parentheses. */
  const effects = (source: string): string[] =>
    [...source.matchAll(/\$effect(?:\.pre)?\(/g)].map((m) => {
      let depth = 0;
      let i = m.index;
      for (; i < source.length; i++) {
        if (source[i] === '(') depth++;
        if (source[i] === ')' && --depth === 0) break;
      }
      return source.slice(m.index, i + 1);
    });

  const LOADERS = [
    'openPrivateConversation',
    'sentPrivateMessages',
    'olderPrivateMessages',
    'openConversation',
    'loadOlder',
    'reload',
    'pmAsk',
  ];

  it('has effects, and none of them loads', () => {
    let seen = 0;
    for (const [name, source] of Object.entries(sources))
      for (const block of effects(source)) {
        seen++;
        for (const loader of LOADERS)
          expect(block, `${name}: ${loader}`).not.toContain(loader);
      }
    expect(seen).toBeGreaterThanOrEqual(4);
  });

  it('starts no load when a component starts (no onMount)', () => {
    for (const [name, source] of Object.entries(sources))
      expect(source, name).not.toContain('onMount');
  });

  it('sends a load from a click handler or a function the click calls', () => {
    expect(sources['PmInbox.svelte']).toMatch(
      /onclick=\{\(\) => void openConversation\(row\.key\)\}/,
    );
    expect(sources['PmThread.svelte']).toMatch(/onclick=\{loadOlder\}/);
    expect(sources['PmSent.svelte']).toMatch(/onclick=\{loadOlder\}/);
    expect(sources['MessagesTabs.svelte']).toMatch(
      /onclick=\{\(\) => select\(key\)\}/,
    );
    expect(sources['MessagesTabs.svelte']).toMatch(
      /function select[\s\S]*?sent\?\.reload\(\)/,
    );
  });
});

describe('the dialog of a message (#349, variant C)', () => {
  afterEach(forgetDrafts);

  it('„Neue Nachricht“ opens a modal dialog titled by its button; the form is there only while it is open', () => {
    const out = html(PmDialog, { names: ['Bert'] });
    expect(out).toMatch(
      /<button[^>]*aria-haspopup="dialog"[^>]*>Neue Nachricht</,
    );
    expect(out).toMatch(
      /<dialog[^>]*id="pm-compose"[^>]*aria-labelledby="pm-compose-title"/,
    );
    expect(out).not.toContain('id="pm-to"');
    expect(out).not.toContain('id="pm-text"');
  });

  it('„Antworten“ opens the dialog „Antworten“', () => {
    const out = html(PmDialog, { to: 'Bert' });
    expect(out).toMatch(/<button[^>]*aria-haspopup="dialog"[^>]*>Antworten</);
    expect(out).toMatch(
      /<dialog[^>]*id="pm-reply"[^>]*aria-labelledby="pm-reply-title"/,
    );
  });

  it('has a text of eight lines with the count „n / 1000“, „Abbrechen“ and „Senden“', () => {
    const out = html(PmCompose, { names: [] });
    expect(out).toMatch(/<textarea[^>]*id="pm-text"[^>]*rows="8"/);
    expect(out).toMatch(/<textarea[^>]*aria-describedby="pm-text-count"/);
    expect(out).toMatch(/id="pm-text-count"[^>]*>0 \/ 1000</);
    expect(out).toMatch(
      />Abbrechen<\/button>\s*<button type="submit"[^>]*>Senden</,
    );
  });

  it('offers the quick choice: „Zuletzt geschrieben:“ and „Freunde:“, each button described by its label and pressed when chosen', () => {
    keepDraft(undefined, { to: 'Dirk', text: '' });
    const out = html(PmCompose, {
      quick: { recent: ['Bert', '<i>Cora</i>'], friends: ['Dirk'] },
    });
    expect(out).toContain('id="pm-quick-recent">Zuletzt geschrieben:<');
    expect(out).toContain('id="pm-quick-friends">Freunde:<');
    expect(
      out.match(/aria-describedby="pm-quick-recent" aria-pressed="false"/g),
    ).toHaveLength(2);
    expect(out).toMatch(
      /aria-describedby="pm-quick-friends" aria-pressed="true"[^>]*>Dirk</,
    );
    expect(out).toContain('&lt;i>Cora&lt;/i>');
    expect(out.indexOf('Zuletzt geschrieben:')).toBeLessThan(
      out.indexOf('Freunde:'),
    );
    const none = html(PmCompose, {});
    // A refusal shows only after a send (#349): none when the dialog opens.
    expect(none).not.toContain('role="alert"');
    expect(none).not.toContain('Zuletzt geschrieben:');
    expect(none).not.toContain('Freunde:');
  });

  it('starts from the draft: what was typed before is there again (decision 3)', () => {
    keepDraft(undefined, { to: 'Bert', text: 'Hallo <b>Bert</b>' });
    keepDraft('Cora', { to: '', text: 'Antwort' });
    const fresh = html(PmCompose, {});
    expect(fresh).toMatch(/id="pm-to"[^>]*value="Bert"/);
    expect(fresh).toContain('Hallo &lt;b>Bert&lt;/b></textarea>');
    expect(fresh).toContain('>17 / 1000<');
    expect(html(PmCompose, { to: 'Cora' })).toContain('>Antwort</textarea>');
    expect(html(PmCompose, { to: 'Dora' })).toContain('></textarea>');
  });

  it('shows the reply as „An {Name}“ with „Letzte Nachricht von {Name}“ quoted, escaped (decision 5)', () => {
    const out = html(PmCompose, { to: '<i>Bert</i>', quote: '<b>Hallo</b>' });
    expect(out).toContain('An <b>&lt;i>Bert&lt;/i></b>');
    expect(out).toContain('Letzte Nachricht von &lt;i>Bert&lt;/i>');
    expect(out).toContain('&lt;b>Hallo&lt;/b>');
    expect(out).not.toContain('id="pm-to"');
    const unquoted = html(PmCompose, { to: 'Bert' });
    expect(unquoted).not.toContain('Letzte Nachricht von');
  });

  it('quotes the last message received in an open conversation', () => {
    expect(html(PmThread, { row: row(), initial: thread() })).not.toContain(
      'Letzte Nachricht von',
    );
    const source = readFileSync(
      new URL('PmThread.svelte', import.meta.url),
      'utf8',
    );
    expect(source).toContain('quote={lastReceived(lines)?.text}');
  });
});
