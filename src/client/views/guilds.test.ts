// The guild chat in the guild view (#169): what each rank sees, and every
// name and text escaped. The server checks the rights; the view only hides.
// The tests run on the components (#118, bundle 6), as normalize() shows them.
import { describe, expect, it } from 'vitest';
import type { GuildRight } from '../../core/guild-ranks.ts';
import type { GameState, GuildChat, GuildState } from '../logic/types.ts';
import type { V } from './common.ts';
import { adminChatDialogView, guildsView } from '../../test/guilds-view.ts';
import { normalize } from '../../test/markup.ts';

/** The admin's chat dialog as markup. */
const adminDialog = (read: Parameters<typeof adminChatDialogView>[0]): string =>
  normalize(adminChatDialogView(read));

const XSS = '<img src=x onerror=alert(1)>';

function view(
  chat: GuildChat | null,
  over: { member?: boolean; admin?: boolean; name?: string } = {},
): string {
  const member = over.member ?? true;
  const rights: GuildRight[] = ['chat-read'];
  const state: GuildState = {
    directory: [
      {
        id: 'g1',
        tag: 'OR',
        name: over.name ?? 'Outer Rim',
        html: '',
        members: [
          { id: 'u_Lea', name: 'Lea', points: 10 },
          { id: 'u_Ada', name: 'Ada', points: 5 },
        ],
        score: 15,
        average: 7,
      },
    ],
    own: member ? { id: 'g1', status: 'member' } : null,
    management: member ? { id: 'g1', description: '', pending: [] } : null,
    ranks: member
      ? {
          lead: 'u_Lea',
          rank: 'r1',
          rights,
          default: 'r1',
          list: [
            { id: 'r0', name: 'Leitung', rights: [] },
            { id: 'r1', name: 'Mitglied', rights },
          ],
          members: { u_Lea: 'r0', u_Ada: 'r1' },
        }
      : null,
    chat,
  };
  const s = {
    me: { id: 'u_Ada' },
    guilds: state,
    admin: over.admin ? {} : null,
  } as unknown as GameState;
  return normalize(
    guildsView({ s, ui: { params: { guild: 'g1' } } } as unknown as V),
  );
}

const message = (over: Partial<GuildChat['messages'][number]> = {}) => ({
  id: 7,
  time: Date.UTC(2026, 10, 14, 19, 5),
  kind: 'message' as const,
  name: 'Lea',
  text: 'Hallo',
  delete: false,
  ...over,
});

describe('the chat box (#169)', () => {
  it('shows the messages in a log, the text field and „Senden“', () => {
    const html = view({
      read: true,
      write: true,
      messages: [message()],
      unread: false,
    });
    expect(html).toContain('<div class="hd">Chat</div>');
    expect(html).toContain(
      '<div aria-label="Chat" class="chat-log" role="log" tabindex="0"><ol><li><b>Lea</b>',
    );
    expect(html).toContain('<span class="chat-text">Hallo</span>');
    expect(html).toContain('<form class="flex" id="guildchatform">');
    expect(html).toContain('<label for="chat_text">Nachricht</label>');
    expect(html).toContain('maxlength="1000"');
    expect(html).toContain('<button type="submit">Senden</button>');
    expect(html).not.toContain('data-act="guildChatDelete"');
  });

  it('says when there is no message yet', () => {
    const html = view({
      read: true,
      write: false,
      messages: [],
      unread: false,
    });
    expect(html).toContain('<p>Noch keine Nachrichten.</p>');
    expect(html).not.toContain('guildchatform');
  });

  it('shows only the text field to a rank that writes and does not read', () => {
    const html = view({
      read: false,
      write: true,
      messages: [],
      unread: false,
    });
    expect(html).not.toContain('role="log"');
    expect(html).toContain('guildchatform');
  });

  it('has no chat box without a chat right or outside the guild', () => {
    expect(view(null)).not.toContain('<div class="hd">Chat</div>');
    const outside = view(
      { read: true, write: true, messages: [message()], unread: false },
      { member: false },
    );
    expect(outside).not.toContain('<div class="hd">Chat</div>');
    expect(outside).not.toContain('Hallo');
  });

  it('offers „Löschen“ only for the messages the rank may delete', () => {
    const html = view({
      read: true,
      write: true,
      messages: [message(), message({ id: 8, text: 'weg', delete: true })],
      unread: false,
    });
    expect(html.match(/data-act="guildChatDelete"/g)).toHaveLength(1);
    expect(html).toContain('data-act="guildChatDelete" data-id="8">Löschen');
  });

  it('names a former member or a deleted account „ehemaliges Mitglied“ (D7)', () => {
    const html = view({
      read: true,
      write: false,
      messages: [message({ name: null })],
      unread: false,
    });
    expect(html).toContain('<li><i>ehemaliges Mitglied</i>');
  });

  it('escapes every name and text: no markup from players', () => {
    const html = view(
      {
        read: true,
        write: false,
        messages: [message({ name: XSS, text: `${XSS} & "q" 'a'` })],
        unread: false,
      },
      { name: XSS },
    );
    expect(html).not.toContain('<img');
    // Only < and & need escaping in a text; normalize() shows the rest as it is.
    expect(html).toContain('&lt;img src=x onerror=alert(1)>');
    expect(html).toContain('&amp; "q" \'a\'');
  });
});

describe('events and the notice in the chat box (#169; owner, 2026-11-15)', () => {
  const chat = (messages: GuildChat['messages']): string =>
    view({ read: true, write: true, messages, unread: false });
  const event = (over: Partial<GuildChat['messages'][number]>) =>
    message({ kind: 'join', name: 'Anna', text: '', ...over });

  it('says that the game master can read the chat, for every rank with the box', () => {
    const line = '<p class="dim">Die Spielleitung kann diesen Chat lesen.</p>';
    expect(chat([])).toContain(line);
    expect(
      view({ read: false, write: true, messages: [], unread: false }),
    ).toContain(line);
    expect(view(null)).not.toContain('Spielleitung');
  });

  it('shows each event as the sentence of the owner, with its time', () => {
    const html = chat([
      event({}),
      event({ id: 2, kind: 'leave' }),
      event({ id: 3, kind: 'remove' }),
      event({ id: 4, kind: 'rank', text: 'Offizier' }),
      event({ id: 5, kind: 'join', name: null }),
    ]);
    for (const sentence of [
      'Anna ist der Gilde beigetreten.',
      'Anna hat die Gilde verlassen.',
      'Anna wurde aus der Gilde entfernt.',
      'Anna ist jetzt Offizier.',
      'Ehemaliges Mitglied ist der Gilde beigetreten.',
    ])
      expect(html).toContain(
        `<br><span class="chat-text chat-event">${sentence}</span>`,
      );
    expect(html).toContain('<li><span class="dim">');
    // An event has no author in bold and is never deletable.
    expect(html).not.toContain('<b>Anna</b>');
    expect(html).not.toContain('guildChatDelete');
  });

  it('shows an attack with the target, the attacker, the member and the arrival', () => {
    const time = new Date(2026, 10, 15, 19, 40).getTime();
    const arrival = new Date(2026, 10, 15, 20, 15).getTime();
    const html = chat([
      event({
        kind: 'attack',
        name: 'Lea',
        text: '[1:27:11]',
        attacker: 'Vex',
        time,
        arrival,
      }),
      event({
        id: 9,
        kind: 'attack',
        name: 'Lea',
        text: '[1:27:11]',
        attacker: null,
        time,
        arrival: new Date(2026, 10, 16, 1, 2).getTime(),
      }),
    ]);
    expect(html).toContain(
      '⚔ Angriff auf [1:27:11] (Vex → Lea), Ankunft 20:15</span>',
    );
    expect(html).toContain(
      '⚔ Angriff auf [1:27:11] (Unbekannt → Lea), Ankunft 16.11., 01:02</span>',
    );
  });

  it('escapes the names and the rank in an event', () => {
    const html = chat([
      event({ kind: 'rank', name: XSS, text: XSS }),
      event({
        id: 2,
        kind: 'attack',
        name: XSS,
        text: '[1:2:3]',
        attacker: XSS,
        arrival: 0,
      }),
    ]);
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img src=x onerror=alert(1)> ist jetzt &lt;img');
  });

  it('shows the events in the admin dialog too, without „Löschen“', () => {
    const html = adminDialog({
      guild: { tag: 'OR', name: 'X' },
      messages: [{ id: 1, time: 0, kind: 'leave', name: 'Anna', text: '' }],
    });
    expect(html).toContain('Anna hat die Gilde verlassen.');
    expect(html).not.toContain('Spielleitung');
  });
});

describe('the admin reads a guild chat (#169, D8)', () => {
  it('has „Chat lesen“ on every guild page, only for the admin', () => {
    const button =
      '<button class="small" data-act="guildChatAdmin" data-id="g1">Chat lesen</button>';
    expect(view(null, { admin: true, member: false })).toContain(button);
    expect(view(null, { admin: false })).not.toContain('guildChatAdmin');
  });

  it('shows the chat in a dialog, escaped, with „Schließen“', () => {
    const html = adminDialog({
      guild: { tag: 'OR', name: XSS },
      messages: [
        { id: 1, time: 0, kind: 'message', name: XSS, text: XSS },
        { id: 2, time: 0, kind: 'message', name: null, text: 'alt' },
      ],
    });
    expect(html).toContain('<h3 id="dialog-title">Chat [OR] &lt;img');
    expect(html).not.toContain('<img');
    expect(html).toContain('<i>ehemaliges Mitglied</i>');
    expect(html).not.toContain('guildChatDelete');
    expect(html).toContain(
      'data-act="closeModal" type="button">Schließen</button>',
    );
    expect(
      adminDialog({ guild: { tag: 'OR', name: 'X' }, messages: [] }),
    ).toContain('Noch keine Nachrichten.');
  });
});

describe('rank names in the guild view (#277)', () => {
  /** The Leitung's page; Ada holds a rank whose name is older than the limit. */
  function leader(oldName: string): string {
    const rights: GuildRight[] = ['ranks', 'assign', 'remove'];
    const state = {
      directory: [
        {
          id: 'g1',
          tag: 'OR',
          name: 'Outer Rim',
          html: '',
          members: [
            { id: 'u_Lea', name: 'Lea', points: 10 },
            { id: 'u_Ada', name: 'Ada', points: 5 },
          ],
          score: 15,
          average: 7,
        },
      ],
      own: { id: 'g1', status: 'member' },
      management: { id: 'g1', description: '', pending: [] },
      ranks: {
        lead: 'u_Lea',
        rank: 'r0',
        rights,
        default: 'r1',
        list: [
          { id: 'r0', name: 'Leitung', rights },
          { id: 'r1', name: oldName, rights: [] },
        ],
        members: { u_Lea: 'r0', u_Ada: 'r1' },
      },
      chat: null,
    } as unknown as GuildState;
    const s = {
      me: { id: 'u_Lea' },
      guilds: state,
      admin: null,
    } as unknown as GameState;
    return normalize(
      guildsView({ s, ui: { params: { guild: 'g1' } } } as unknown as V),
    );
  }

  it('limits the inputs to 24 characters and still shows an older, longer name in full', () => {
    const old = 'Ehrenwerter Großadmiral der Äußeren Randwelten und Kolonien';
    expect(old.length).toBeGreaterThan(24);
    const html = leader(old);
    expect(html).toContain('id="rank_new" maxlength="24" minlength="2"');
    expect(html).toContain(
      'maxlength="24" minlength="2" required value="Ehrenwerter',
    );
    expect(html).toContain(`value="${old}"`);
    expect(html).toContain(`<legend>${old} · Standardrang</legend>`);
    expect(html).toContain(`<td class="rank">${old}</td>`);
    expect(html).toContain(`>${old}</option>`);
  });

  it('marks the „Rang ändern“ list so that a long name does not widen the page', () => {
    expect(leader('Mitglied')).toContain(
      '<select aria-label="Neuer Rang für Ada" class="rank-select" id="rank_of_u_Ada"',
    );
  });
});
