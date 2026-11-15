// The guild chat in the guild view (#169): what each rank sees, and every
// name and text escaped. The server checks the rights; the view only hides.
import { describe, expect, it } from 'vitest';
import type { GuildRight } from '../../core/guild-ranks.ts';
import type { GameState, GuildChat, GuildState } from '../logic/types.ts';
import type { V } from './common.ts';
import { adminChatDialog, guilds } from './guilds.ts';

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
  return guilds({ s, ui: { guild: 'g1' } } as unknown as V);
}

const message = (over: Partial<GuildChat['messages'][number]> = {}) => ({
  id: 7,
  time: Date.UTC(2026, 10, 14, 19, 5),
  name: 'Lea',
  text: 'Hallo',
  delete: false,
  ...over,
});

describe('the chat box (#169)', () => {
  it('shows the messages in a log, the text field and „Senden“', () => {
    const html = view({ read: true, write: true, messages: [message()] });
    expect(html).toContain('<div class="hd">Chat</div>');
    expect(html).toContain(
      '<div class="chat-log" role="log" aria-label="Chat" tabindex="0"><ol><li><b>Lea</b>',
    );
    expect(html).toContain('<span class="chat-text">Hallo</span>');
    expect(html).toContain('<form id="guildchatform"');
    expect(html).toContain('<label for="chat_text">Nachricht</label>');
    expect(html).toContain('maxlength="1000"');
    expect(html).toContain('<button type="submit">Senden</button>');
    expect(html).not.toContain('data-act="guildChatDelete"');
  });

  it('says when there is no message yet', () => {
    const html = view({ read: true, write: false, messages: [] });
    expect(html).toContain('<p>Noch keine Nachrichten.</p>');
    expect(html).not.toContain('guildchatform');
  });

  it('shows only the text field to a rank that writes and does not read', () => {
    const html = view({ read: false, write: true, messages: [] });
    expect(html).not.toContain('role="log"');
    expect(html).toContain('guildchatform');
  });

  it('has no chat box without a chat right or outside the guild', () => {
    expect(view(null)).not.toContain('<div class="hd">Chat</div>');
    const outside = view(
      { read: true, write: true, messages: [message()] },
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
    });
    expect(html.match(/data-act="guildChatDelete"/g)).toHaveLength(1);
    expect(html).toContain('data-act="guildChatDelete" data-id="8">Löschen');
  });

  it('names a former member or a deleted account „ehemaliges Mitglied“ (D7)', () => {
    const html = view({
      read: true,
      write: false,
      messages: [message({ name: null })],
    });
    expect(html).toContain('<li><i>ehemaliges Mitglied</i>');
  });

  it('escapes every name and text: no markup from players', () => {
    const html = view(
      {
        read: true,
        write: false,
        messages: [message({ name: XSS, text: `${XSS} & "q" 'a'` })],
      },
      { name: XSS },
    );
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('&amp; &quot;q&quot; &#39;a&#39;');
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
    const html = adminChatDialog({
      guild: { tag: 'OR', name: XSS },
      messages: [
        { id: 1, time: 0, name: XSS, text: XSS },
        { id: 2, time: 0, name: null, text: 'alt' },
      ],
    });
    expect(html).toContain('<h3 id="dialog-title">Chat [OR] &lt;img');
    expect(html).not.toContain('<img');
    expect(html).toContain('<i>ehemaliges Mitglied</i>');
    expect(html).not.toContain('guildChatDelete');
    expect(html).toContain('data-act="closeModal">Schließen</button>');
    expect(
      adminChatDialog({ guild: { tag: 'OR', name: 'X' }, messages: [] }),
    ).toContain('Noch keine Nachrichten.');
  });
});
