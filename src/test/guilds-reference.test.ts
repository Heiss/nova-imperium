// „Gilden“ renders as before #118, bundle 6 („no visible change“ of the
// issue; each migration step changes no behaviour, owner, 2026-11-13). The
// old view is frozen here: guilds() of src/client/views/guilds.ts with its
// helpers, the three dialogs transferDialog(), dissolveDialog() and
// adminChatDialog(), and box() of views/common.ts. On generated states (fixed
// fast-check seed 118) the components render the same markup, up to what a
// browser does not show (normalize() of markup.ts); hand-built cases reach
// what the sample reaches rarely: the longest tag and name (#274), rank names
// of 24 characters and older, longer ones (#277), a rank without rights, the
// Leitung against a member, no guild, guilds switched off for the round, a
// member in vacation, every kind of event of the chat (#169). The hooks the
// handlers read (features/guilds.ts, features/social.ts, main.ts) are pinned
// below.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { chatEventText, MAX_CHAT_TEXT } from '../core/guild-chat.ts';
import {
  assignError,
  deleteError,
  GUILD_RIGHTS,
  isBelow,
  MAX_GUILD_RANKS,
  MAX_RANK_NAME,
  memberPlace,
  MIN_RANK_NAME,
  RIGHT_TEXT,
  type GuildRight,
} from '../core/guild-ranks.ts';
import { arrivalAt, dt, esc, fmt } from '../client/logic/format.ts';
import type {
  Guild,
  GuildChat,
  GuildChatMessage,
  GuildRank,
  GuildRanks,
  GuildState,
} from '../client/logic/types.ts';
import type { V } from '../client/views/common.ts';
import {
  adminChatDialogView,
  dissolveDialogView,
  guildsView,
  transferDialogView,
} from './guilds-view.ts';
import { normalize, textContents } from './markup.ts';

// ----- frozen: the guild views before #118, bundle 6 -----

const box = (title: string, body: string, cls = ''): string =>
  `<div class="box${cls ? ' ' + cls : ''}"><div class="hd">${title}</div><div class="bd">${body}</div></div>`;

const heading = (guild: Pick<Guild, 'tag' | 'name'>): string =>
  `[${esc(guild.tag)}] ${esc(guild.name)}`;

/** The author of a message who left the guild or deleted the account (owner, D7). */
const FORMER = 'ehemaliges Mitglied';

type ChatLine = Pick<
  GuildChatMessage,
  'id' | 'kind' | 'name' | 'time' | 'text' | 'attacker' | 'arrival'
>;

/**
 * A message: the author, the time and the text; an event: the time and its
 * sentence (D3, D4; owner, 2026-11-15). All escaped (#169).
 */
function chatLine(m: ChatLine): string {
  const time = `<span class="dim">${dt(m.time)}</span>`;
  if (m.kind !== 'message') {
    const arrival = m.arrival === undefined ? '' : arrivalAt(m.arrival, m.time);
    return `${time}<br><span class="chat-text chat-event">${esc(chatEventText({ ...m, kind: m.kind }, arrival))}</span>`;
  }
  const who = m.name === null ? `<i>${FORMER}</i>` : `<b>${esc(m.name)}</b>`;
  return `${who} ${time}<br><span class="chat-text">${esc(m.text)}</span>`;
}

/** The messages, oldest first, in a log that keeps its place (#169). */
function chatLog<M extends ChatLine>(
  messages: M[],
  controls: (m: M) => string = () => '',
): string {
  const items = messages
    .map((m) => `<li>${chatLine(m)}${controls(m)}</li>`)
    .join('');
  return `<div class="chat-log" role="log" aria-label="Chat" tabindex="0">${
    items ? `<ol>${items}</ol>` : '<p>Noch keine Nachrichten.</p>'
  }</div>`;
}

/**
 * The chat of the own guild (#169): the messages with „Chat lesen“, the
 * text field with „Chat schreiben“, „Löschen“ where the own rank may.
 */
function chatBox(chat: GuildChat): string {
  const log = chat.read
    ? chatLog(chat.messages, (m) =>
        m.delete
          ? ` <button class="small red" data-act="guildChatDelete" data-id="${Number(m.id)}">Löschen</button>`
          : '',
      )
    : '';
  const form = chat.write
    ? `<form id="guildchatform" class="flex"><label for="chat_text">Nachricht</label> <input id="chat_text" class="wide" maxlength="${MAX_CHAT_TEXT}" required autocomplete="off"> <button type="submit">Senden</button></form>`
    : '';
  // The admin reads every chat (D8); the owner's notice (2026-11-15).
  const notice = '<p class="dim">Die Spielleitung kann diesen Chat lesen.</p>';
  return box('Chat', notice + log + form);
}

/** The chat of a guild as the admin reads it (#169, D8), in the dialog. */
function adminChatDialog(read: {
  guild: Pick<Guild, 'tag' | 'name'>;
  messages: ChatLine[];
}): string {
  return `<h3 id="dialog-title">Chat ${heading(read.guild)}</h3>
  ${chatLog(read.messages)}
  <p><button type="button" data-act="closeModal">Schließen</button></p>`;
}

function profileForm(guild?: Guild, description = ''): string {
  return `<form id="guildform" data-edit="${guild ? '1' : '0'}">
    <div><label for="guild_tag">Kürzel</label> <input id="guild_tag" required minlength="2" maxlength="8" value="${esc(guild?.tag ?? '')}"></div>
    <div><label for="guild_name">Name</label> <input id="guild_name" required minlength="3" maxlength="32" value="${esc(guild?.name ?? '')}"></div>
    <div><label for="guild_description">Gildentext (Markdown)</label><br>
    <textarea id="guild_description" class="wide" rows="6" maxlength="6000">${esc(description)}</textarea></div>
    <button type="submit">${guild ? 'Profil speichern' : 'Gilde gründen'}</button>
  </form>`;
}

function directory(state: GuildState): string {
  const rows = state.directory
    .map(
      (g) =>
        `<tr><td><a href="/?view=guilds&amp;guild=${encodeURIComponent(g.id)}" data-act="guildView" data-id="${esc(g.id)}">${heading(g)}</a></td>
    <td class="n">${g.members.length}</td><td class="n">${fmt(g.score)}</td><td class="n">${fmt(g.average)}</td></tr>`,
    )
    .join('');
  const list = rows
    ? `<table class="guild-list"><tr><th>Gilde</th><th class="n">Mitglieder</th><th class="n">Punkte</th><th class="n">Ø Punkte</th></tr>${rows}</table>`
    : '<p>Es gibt noch keine Gilden.</p>';
  return `<h2>Gilden</h2>${box('Gildenübersicht', list)}${state.own ? '' : box('Neue Gilde', profileForm())}`;
}

/** What the own rank may do in the own guild: its rights and its place. */
interface Inside {
  ranks: GuildRanks;
  uid: string;
  lead: boolean;
  /** Place of the own rank; 0 is the Leitung. */
  at: number;
  can: (right: GuildRight) => boolean;
}

function inside(ranks: GuildRanks, uid: string): Inside {
  const at = ranks.list.findIndex((r) => r.id === ranks.rank);
  return {
    ranks,
    uid,
    lead: ranks.lead === uid,
    // The Leitung holds the first rank; no rank stands lowest.
    at: at < 0 ? Infinity : at,
    can: (right) => ranks.rights.includes(right),
  };
}

/** The place of a rank in the list; none for an unknown rank. */
function indexOf(me: Inside, rank: string | null | undefined) {
  const at = me.ranks.list.findIndex((r) => r.id === rank);
  return at < 0 ? undefined : at;
}

/** The place of a member; a member without a rank stands lowest (core rule). */
function placeOf(me: Inside, id: string): number {
  return memberPlace(id === me.ranks.lead, indexOf(me, me.ranks.members[id]));
}

/** The own rank as the core rules see it. */
const asRule = (me: Inside) => ({ position: me.at, rights: me.ranks.rights });

/** A rank as the core rules see it. */
const rankRule = (rank: GuildRank, at: number) => ({
  position: at,
  rights: rank.rights,
});

function guildMembership(
  state: GuildState,
  g: Guild,
  me: Inside | null,
): string {
  if (!state.own)
    return `<button data-act="guildApply" data-id="${esc(g.id)}">Bewerben</button>`;
  if (state.own.id !== g.id) return '';
  if (state.own.status === 'pending')
    return '<p>Deine Bewerbung ist offen.</p><button data-act="guildLeave">Bewerbung zurückziehen</button>';
  if (!me?.lead)
    return '<button data-act="guildLeave" data-confirm="Gilde wirklich verlassen?">Gilde verlassen</button>';
  // Only the Leitung, also while members remain (owner, 2026-11-14).
  return `<button class="red" data-act="guildDissolve" data-id="${esc(g.id)}">Gilde auflösen</button>`;
}

/**
 * The hand-over: the Leitung chooses its own new rank, preselected the
 * highest rank below the Leitung (owner, 2026-11-14).
 */
function transferDialog(ranks: GuildRanks, uid: string, name: string) {
  const options = ranks.list
    .slice(1)
    .map((r) => `<option value="${esc(r.id)}">${esc(r.name)}</option>`)
    .join('');
  return `<h3 id="dialog-title">Leitung übergeben</h3>
  <form id="guildtransferform" data-uid="${esc(uid)}">
    <p>Du übergibst die Gildenleitung an ${esc(name)}.</p>
    <p><label for="transfer_rank">Dein neuer Rang</label> <select id="transfer_rank">${options}</select></p>
    <p><button type="submit">Übergeben</button> <button type="button" data-act="closeModal">Abbrechen</button></p>
  </form>`;
}

/** Dissolving the guild, confirmed with its tag (owner, 2026-11-14). */
function dissolveDialog(g: Guild): string {
  return `<h3 id="dialog-title">Gilde auflösen</h3>
  <form id="guilddissolveform">
    <p>Alle Mitglieder verlassen die Gilde; ihre Ränge und offenen Bewerbungen werden gelöscht. Das kann nicht rückgängig gemacht werden.</p>
    <p><label for="dissolve_tag">Gib zur Bestätigung das Kürzel ${esc(g.tag)} ein</label><br><input id="dissolve_tag" required autocomplete="off" data-nokeep></p>
    <p><button type="submit" class="red">Gilde endgültig auflösen</button> <button type="button" data-act="closeModal">Abbrechen</button></p>
  </form>`;
}

/** „Rang ändern“: the ranks below the own one, for a member below it. */
function rankChange(me: Inside, id: string, name: string): string {
  // Only ranks the own rank may give (owner, 2026-11-14): below it and
  // without a right it lacks.
  const place = placeOf(me, id);
  const options = me.ranks.list
    .filter((r, i) => assignError(asRule(me), place, rankRule(r, i)) === null)
    .map(
      (r) =>
        `<option value="${esc(r.id)}"${r.id === me.ranks.members[id] ? ' selected' : ''}>${esc(r.name)}</option>`,
    )
    .join('');
  return `<select id="rank_of_${esc(id)}" class="rank-select" aria-label="Neuer Rang für ${esc(name)}">${options}</select>
      <button class="small" data-act="guildAssign" data-uid="${esc(id)}">Rang ändern</button>`;
}

function memberControls(me: Inside, m: Guild['members'][number]): string {
  if (m.id === me.uid) return '';
  const lower = isBelow(me.at, placeOf(me, m.id));
  const uid = esc(m.id);
  return [
    me.lead
      ? `<button class="small" data-act="guildMember" data-uid="${uid}" data-transfer="1">Leitung übergeben</button>`
      : '',
    lower && me.can('assign') ? rankChange(me, m.id, m.name) : '',
    lower && me.can('remove')
      ? `<button class="small red" data-act="guildMember" data-uid="${uid}">Entfernen</button>`
      : '',
  ].join(' ');
}

/** The members; their ranks only for the own guild (owner, #163 D7). */
function roster(g: Guild, me: Inside | null): string {
  if (!me) {
    const rows = g.members
      .map(
        (m) =>
          `<tr><td>${esc(m.name)}</td><td class="n">${fmt(m.points)}</td></tr>`,
      )
      .join('');
    return `<table class="guild-members"><tr><th>Spieler</th><th class="n">Punkte</th></tr>${rows}</table>`;
  }
  const rankName = (id: string): string =>
    esc(me.ranks.list.find((r) => r.id === me.ranks.members[id])?.name ?? '–');
  const rows = g.members
    .map(
      (m) =>
        `<tr><td>${esc(m.name)}</td><td class="rank">${m.id === me.ranks.lead ? esc(me.ranks.list[0]!.name) : rankName(m.id)}</td><td class="n">${fmt(m.points)}</td><td>${memberControls(me, m)}</td></tr>`,
    )
    .join('');
  return `<table class="guild-members"><tr><th>Spieler</th><th>Rang</th><th class="n">Punkte</th><th></th></tr>${rows}</table>`;
}

function rightsList(rank: GuildRank, at: number): string {
  if (at === 0) return '<p>Alle Rechte.</p>';
  if (!rank.rights.length) return '<p>Keine Rechte.</p>';
  return `<ul>${rank.rights.map((r) => `<li>${RIGHT_TEXT[r]}</li>`).join('')}</ul>`;
}

function rankEditor(me: Inside, rank: GuildRank, at: number): string {
  const id = esc(rank.id);
  const boxes = GUILD_RIGHTS.map(
    (r) =>
      `<label class="switch"><input type="checkbox" id="rank_${id}_${r}" data-rank-right="${id}" value="${r}"${rank.rights.includes(r) ? ' checked' : ''}${me.can(r) ? '' : ' disabled'}> ${RIGHT_TEXT[r]}</label>`,
  ).join('');
  const isDefault = rank.id === me.ranks.default;
  const last = at === me.ranks.list.length - 1;
  const fallback = indexOf(me, me.ranks.default);
  const hasMembers = Object.values(me.ranks.members).includes(rank.id);
  const deletable =
    !isDefault &&
    fallback !== undefined &&
    deleteError(
      asRule(me),
      hasMembers,
      rankRule(me.ranks.list[fallback]!, fallback),
    ) === null;
  return `<div><label for="rank_name_${id}">Rangname</label> <input id="rank_name_${id}" required minlength="${MIN_RANK_NAME}" maxlength="${MAX_RANK_NAME}" value="${esc(rank.name)}">
      <button class="small" data-act="rankRename" data-rank="${id}">Umbenennen</button></div>
    <div class="rights">${boxes}</div>
    <p><button class="small" data-act="rankRights" data-rank="${id}">Rechte speichern</button>
    ${isBelow(me.at, at - 1) ? `<button class="small" data-act="rankMove" data-rank="${id}" data-up="1">Nach oben</button>` : ''}
    ${last ? '' : `<button class="small" data-act="rankMove" data-rank="${id}">Nach unten</button>`}
    ${deletable ? `<button class="small red" data-act="rankDelete" data-rank="${id}">Löschen</button>` : ''}</p>`;
}

function rankEntry(me: Inside, rank: GuildRank, at: number): string {
  const isDefault = rank.id === me.ranks.default;
  const body =
    me.can('ranks') && isBelow(me.at, at)
      ? rankEditor(me, rank, at)
      : rightsList(rank, at);
  const choose =
    me.lead && at > 0 && !isDefault
      ? `<p><button class="small" data-act="rankDefault" data-rank="${esc(rank.id)}">Als Standardrang</button></p>`
      : '';
  return `<fieldset class="rank"><legend>${esc(rank.name)}${isDefault ? ' · Standardrang' : ''}</legend>${body}${choose}</fieldset>`;
}

function ranksBox(me: Inside): string {
  const list = me.ranks.list.map((r, at) => rankEntry(me, r, at)).join('');
  const create =
    me.can('ranks') && me.ranks.list.length < MAX_GUILD_RANKS
      ? `<div><label for="rank_new">Name des neuen Rangs</label> <input id="rank_new" minlength="${MIN_RANK_NAME}" maxlength="${MAX_RANK_NAME}">
      <button data-act="rankCreate">Rang anlegen</button></div>`
      : '';
  return box('Ränge', list + create);
}

function management(
  g: Guild,
  own: NonNullable<GuildState['management']>,
  me: Inside,
): string {
  const pending = own.pending
    .map(
      (m) => `<p>${esc(m.name)}
    <button class="small" data-act="guildReview" data-uid="${esc(m.id)}" data-accept="1">Annehmen</button>
    <button class="small" data-act="guildReview" data-uid="${esc(m.id)}">Ablehnen</button></p>`,
    )
    .join('');
  return (
    (me.can('applications')
      ? box('Bewerbungen', pending || '<p>Keine offenen Bewerbungen.</p>')
      : '') +
    ranksBox(me) +
    (me.can('profile')
      ? box('Gildenprofil bearbeiten', profileForm(g, own.description))
      : '')
  );
}

function guilds(v: V): string {
  const state = v.s.guilds ?? { directory: [], own: null, management: null };
  const g = state.directory.find((guild) => guild.id === v.ui.guild);
  if (!g) return directory(state);
  const own = state.management?.id === g.id ? state.management : null;
  const me = own && state.ranks ? inside(state.ranks, v.s.me.id) : null;
  return `<h2 class="guild-title">${heading(g)}</h2>
  <p><button class="small" data-act="nav" data-v="guilds">Zur Gildenübersicht</button></p>
  ${box('Gildenprofil', g.html || '<p>Diese Gilde hat noch keinen Profiltext.</p>')}
  ${box('Punkte', `<p>${fmt(g.score)} gesamt · ${fmt(g.average)} pro Mitglied</p>`)}
  ${box('Mitglieder', roster(g, me))}
  ${ownChat(state, g)}
  ${guildMembership(state, g, me)}
  ${adminChatButton(v, g)}
  ${own && me ? management(g, own, me) : ''}`;
}

/** The chat box of the own guild, for a rank with a chat right (#169). */
const ownChat = (state: GuildState, g: Guild): string =>
  state.management?.id === g.id && state.chat ? chatBox(state.chat) : '';

/** The admin reads the chat of every guild (#169, D8). */
const adminChatButton = (v: V, g: Guild): string =>
  !v.s.admin
    ? ''
    : `<p><button class="small" data-act="guildChatAdmin" data-id="${esc(g.id)}">Chat lesen</button></p>`;

// ----- the comparison -----

const IDS = ['u_a', 'u_b', 'u_c', 'u_d', 'u_e', 'u_f'] as const;
/** What a name may hold that is not plain text; the longest name a player may have (20). */
const NAMES = [
  'Anna',
  'Bert <b>',
  'Cleo & Co',
  'D"ora',
  "Emil's",
  'a > b',
  'W'.repeat(20),
];
/** Guild ids, one with characters that must be escaped in an attribute and encoded in a link. */
const GUILD_IDS = ['g1', 'g2', 'g&"3'] as const;
const TAGS = ['OR', 'W'.repeat(8), '<b>', 'A&B', "x'y"];
const GUILD_NAMES = [
  'Outer Rim',
  'W'.repeat(32),
  'Rim <i>&</i> "Co"',
  'Ä Ö Ü ß',
];
/** Rank names: normal, of 24 characters (#277), an older one up to 67, and markup. */
const RANK_NAMES = [
  'Mitglied',
  'Offizier',
  'R'.repeat(24),
  'Ehrenwerter Großadmiral der Äußeren Randwelten und Kolonien',
  '<u>Rang</u> & "Co"',
];
const TEXTS = [
  'Hallo',
  'zwei\nZeilen',
  '<img src=x onerror=alert(1)> & "q" \'a\'',
  '  Leerzeichen  ',
  'W'.repeat(120),
];
const PROFILES = [
  '',
  '<p>Wir sind <b>stark</b>.</p>',
  '<h2>Titel</h2><ul><li>eins</li></ul>',
];
const KINDS = ['message', 'join', 'leave', 'remove', 'rank', 'attack'] as const;
const BASE = Date.UTC(2026, 10, 15, 19, 40);

const message = fc.record({
  kind: fc.constantFrom(...KINDS),
  name: fc.option(fc.constantFrom(...NAMES), { nil: null }),
  text: fc.constantFrom(...TEXTS),
  attacker: fc.option(fc.constantFrom(...NAMES, null), { nil: undefined }),
  time: fc.integer({ min: 0, max: 3 * 86_400_000 }),
  arrival: fc.option(fc.integer({ min: 0, max: 3 * 86_400_000 }), {
    nil: undefined,
  }),
  delete: fc.boolean(),
});

const chat = fc.record({
  read: fc.boolean(),
  write: fc.boolean(),
  messages: fc.array(message, { maxLength: 6 }),
  unread: fc.boolean(),
});

const rank = fc.record({
  name: fc.constantFrom(...RANK_NAMES),
  rights: fc.subarray([...GUILD_RIGHTS]),
});

const guild = fc.record({
  id: fc.constantFrom(...GUILD_IDS),
  tag: fc.constantFrom(...TAGS),
  name: fc.constantFrom(...GUILD_NAMES),
  html: fc.constantFrom(...PROFILES),
  members: fc.uniqueArray(
    fc.record({
      id: fc.constantFrom(...IDS),
      name: fc.constantFrom(...NAMES),
      points: fc.integer({ min: 0, max: 5_000_000 }),
    }),
    { maxLength: 5, selector: (m) => m.id },
  ),
  score: fc.integer({ min: 0, max: 9_000_000 }),
  average: fc.integer({ min: 0, max: 2_000_000 }),
});

const state = fc
  .record({
    directory: fc.uniqueArray(guild, { maxLength: 3, selector: (g) => g.id }),
    shown: fc.option(fc.constantFrom(...GUILD_IDS, 'g_unknown'), {
      nil: undefined,
    }),
    me: fc.constantFrom(...IDS, 'u_nobody'),
    admin: fc.boolean(),
    // The player's own guild: none, one of the directory, or one not listed.
    own: fc.option(
      fc.record({
        id: fc.constantFrom(...GUILD_IDS),
        status: fc.constantFrom('member' as const, 'pending' as const),
      }),
      { nil: null },
    ),
    managed: fc.boolean(),
    description: fc.constantFrom('', 'Text <b>&</b>', 'a\n"b"'),
    pending: fc.uniqueArray(
      fc.record({
        id: fc.constantFrom(...IDS),
        name: fc.constantFrom(...NAMES),
      }),
      { maxLength: 3, selector: (p) => p.id },
    ),
    ranks: fc.option(
      fc.record({
        list: fc.array(rank, { minLength: 1, maxLength: 5 }),
        /** Indexes into the list, or out of it (an unknown rank). */
        lead: fc.constantFrom(...IDS),
        rank: fc.option(fc.integer({ min: 0, max: 5 }), { nil: null }),
        rights: fc.subarray([...GUILD_RIGHTS]),
        default: fc.option(fc.integer({ min: 0, max: 5 }), { nil: null }),
        members: fc.array(
          fc.option(fc.integer({ min: 0, max: 5 }), { nil: null }),
          { minLength: 6, maxLength: 6 },
        ),
      }),
      { nil: null },
    ),
    chat: fc.option(chat, { nil: null }),
  })
  .map((x) => viewOf(x));

interface Spec {
  directory: Record<string, unknown>[];
  shown?: string;
  me: string;
  admin: boolean;
  own: { id: string; status: 'member' | 'pending' } | null;
  managed: boolean;
  description: string;
  pending: { id: string; name: string }[];
  ranks: {
    list: { name: string; rights: string[] }[];
    lead: string;
    rank: number | null;
    rights: string[];
    default: number | null;
    members: (number | null)[];
  } | null;
  chat: {
    read: boolean;
    write: boolean;
    messages: Record<string, unknown>[];
    unread: boolean;
  } | null;
}

/** A view state of a spec: ranks by index, messages with ids and times. */
function viewOf(x: Spec): V {
  const id = (i: number | null): string | null =>
    i === null ? null : x.ranks!.list[i] ? `r${i}` : `r_unknown${i}`;
  const ranks = x.ranks && {
    lead: x.ranks.lead,
    rank: id(x.ranks.rank),
    rights: x.ranks.rights,
    default: id(x.ranks.default),
    list: x.ranks.list.map((r, i) => ({ id: `r${i}`, ...r })),
    members: Object.fromEntries(
      IDS.map((m, i) => [m, id(x.ranks!.members[i]!)]).filter(
        ([m, r]) => !(m === 'u_f' && r === null),
      ),
    ),
  };
  const messages = x.chat?.messages.map((m, i) => ({
    ...m,
    id: i + 1,
    time: BASE + (m.time as number),
    arrival: m.arrival === undefined ? undefined : BASE + (m.arrival as number),
  }));
  return {
    s: {
      me: { id: x.me },
      admin: x.admin ? {} : null,
      guilds: {
        directory: x.directory,
        own: x.own,
        management: x.managed
          ? {
              id: x.shown ?? 'g1',
              description: x.description,
              pending: x.pending,
            }
          : null,
        ranks,
        chat: x.chat && { ...x.chat, messages },
      },
    },
    ui: { guild: x.shown },
  } as unknown as V;
}

// ----- hand-built cases, for what the sample reaches rarely -----

const RIGHTS_NONE: string[] = [];
const THE_WIDEST = {
  id: 'g1',
  tag: 'W'.repeat(8),
  name: 'W'.repeat(32),
  html: '<p>Profil</p>',
  members: [
    { id: 'u_a', name: 'W'.repeat(20), points: 1_234_567 },
    { id: 'u_b', name: 'M'.repeat(20), points: 5 },
    { id: 'u_c', name: 'Cleo', points: 0 },
    { id: 'u_d', name: 'Dora <b>', points: 77 },
  ],
  score: 1_234_572,
  average: 411_524,
};

/** A guild page of the own guild: the own rank, its rights and the ranks. */
function ownGuild(
  me: string,
  rankOf: string,
  rights: string[],
  over: Partial<Spec> = {},
  list: { name: string; rights: string[] }[] = [
    { name: 'Leitung', rights: [...GUILD_RIGHTS] },
    { name: 'R'.repeat(24), rights: ['applications', 'chat-read'] },
    {
      name: 'Ehrenwerter Großadmiral der Äußeren Randwelten und Kolonien',
      rights: RIGHTS_NONE,
    },
    { name: 'Mitglied', rights: ['chat-read', 'chat-write'] },
  ],
): V {
  return viewOf({
    directory: [THE_WIDEST],
    shown: 'g1',
    me,
    admin: false,
    own: { id: 'g1', status: 'member' },
    managed: true,
    description: 'Gildentext <b>&</b>\n"zwei"',
    pending: [{ id: 'u_d', name: 'Dora <b>' }],
    ranks: {
      list,
      lead: 'u_a',
      rank: Number(rankOf.slice(1)),
      rights,
      default: 3,
      members: [0, 1, 2, 3, null, null],
    },
    chat: {
      read: true,
      write: true,
      messages: [
        {
          kind: 'message',
          name: 'W'.repeat(20),
          text: 'Hallo',
          time: 0,
          delete: true,
        },
        {
          kind: 'message',
          name: null,
          text: 'zwei\nZeilen',
          time: 1000,
          delete: false,
        },
        { kind: 'join', name: 'Bert <b>', text: '', time: 2000, delete: false },
        {
          kind: 'rank',
          name: 'Cleo',
          text: 'Offizier',
          time: 3000,
          delete: false,
        },
        {
          kind: 'attack',
          name: 'Anna',
          text: '[1:2:3]',
          attacker: null,
          time: 4000,
          arrival: 90_000_000,
          delete: false,
        },
        {
          kind: 'attack',
          name: null,
          text: '[1:2:3]',
          attacker: 'Vex',
          time: 5000,
          arrival: 6000,
          delete: false,
        },
      ],
      unread: false,
    },
    ...over,
  });
}

const ALL = [...GUILD_RIGHTS];
const BASE_SPEC = {
  directory: [THE_WIDEST],
  shown: 'g1',
  me: 'u_a',
  admin: false,
  own: null,
  managed: false,
  description: '',
  pending: [],
  ranks: null,
  chat: null,
};

const HAND_BUILT: [string, V][] = [
  // A guild with the longest tag and name, the longest names (#274, e2e/phone-overflow.spec.ts).
  [
    'the Leitung of a guild with the longest tag and name',
    ownGuild('u_a', 'r0', ALL),
  ],
  [
    'the same guild for a player without a guild',
    viewOf({ ...BASE_SPEC, me: 'u_x' }),
  ],
  [
    'the directory with the longest tag and name',
    viewOf({ ...BASE_SPEC, shown: undefined }),
  ],
  [
    'the directory of a player who has a guild has no form',
    viewOf({
      ...BASE_SPEC,
      shown: undefined,
      own: { id: 'g1', status: 'member' },
    }),
  ],
  [
    'the empty directory',
    viewOf({ ...BASE_SPEC, directory: [], shown: undefined }),
  ],
  // Rank names of 24 characters and older, longer ones (#277).
  [
    'a rank without rights below the Leitung',
    ownGuild('u_d', 'r3', ['chat-read', 'chat-write']),
  ],
  [
    'a member of the rank „Mitglied“ without any right',
    ownGuild('u_d', 'r3', []),
  ],
  [
    'an officer with rights for ranks and members',
    ownGuild('u_b', 'r1', [
      'applications',
      'remove',
      'assign',
      'ranks',
      'profile',
    ]),
  ],
  [
    'a rank with a right it lacks is disabled in the editor',
    ownGuild('u_b', 'r1', ['ranks']),
  ],
  [
    'the own rank is unknown',
    ownGuild('u_b', 'r9', ['ranks', 'assign', 'remove']),
  ],
  [
    'a guild without a profile text and without members',
    viewOf({
      ...BASE_SPEC,
      directory: [{ ...THE_WIDEST, html: '', members: [] }],
      me: 'u_x',
    }),
  ],
  [
    'no open applications',
    ownGuild('u_b', 'r1', ['applications'], { pending: [] }),
  ],
  // The applicant, the other guild, the withdrawn application.
  [
    'an applicant waits',
    viewOf({ ...BASE_SPEC, me: 'u_x', own: { id: 'g1', status: 'pending' } }),
  ],
  [
    'a member of another guild sees no button',
    viewOf({ ...BASE_SPEC, me: 'u_x', own: { id: 'g2', status: 'member' } }),
  ],
  [
    'the admin reads every chat',
    viewOf({ ...BASE_SPEC, me: 'u_x', admin: true }),
  ],
  [
    'the admin who leads the guild',
    ownGuild('u_a', 'r0', ALL, { admin: true }),
  ],
  // No guild at all: a round without guilds sends none (#191), a player in vacation gets no game.
  [
    'guilds switched off for the round: no state of guilds',
    {
      s: { me: { id: 'u_a' }, guilds: null },
      ui: { guild: 'g1' },
    } as unknown as V,
  ],
  [
    'no state of guilds, no guild opened',
    { s: { me: { id: 'u_a' } }, ui: {} } as unknown as V,
  ],
  [
    'a member in vacation reads the page as any other',
    (() => {
      const v = ownGuild('u_d', 'r3', ['chat-read']);
      (v.s.me as unknown as Record<string, unknown>).vacation = Date.now();
      return v;
    })(),
  ],
  // The chat by right, and without an author or any message.
  [
    'the chat reads and writes, with every kind of event',
    ownGuild('u_d', 'r3', ['chat-read', 'chat-write', 'chat-delete']),
  ],
  [
    'the chat only writes',
    ownGuild('u_d', 'r3', [], {
      chat: { read: false, write: true, messages: [], unread: false },
    }),
  ],
  [
    'the chat only reads',
    ownGuild('u_d', 'r3', [], {
      chat: { read: true, write: false, messages: [], unread: true },
    }),
  ],
  ['no chat right: no chat box', ownGuild('u_d', 'r3', [], { chat: null })],
  // A member who holds no rank, one without a rank entry, and the Leitung's own rank missing.
  [
    'a rank list of the Leitung only',
    ownGuild('u_a', 'r0', ALL, {}, [{ name: 'Leitung', rights: ALL }]),
  ],
  [
    'the longest list of ranks',
    ownGuild(
      'u_a',
      'r0',
      ALL,
      {},
      Array.from({ length: 5 }, (_, i) => ({
        name: `Rang ${i}`,
        rights: i ? ['chat-read'] : ALL,
      })),
    ),
  ],
];

describe('the guild pages against the view before #118, bundle 6', () => {
  it('renders the pages as before', () => {
    fc.assert(
      fc.property(state, (v) => {
        expect(normalize(guildsView(v))).toBe(normalize(guilds(v)));
      }),
      { seed: 118, numRuns: 300 },
    );
  });

  it('renders the hand-built cases as before', () => {
    for (const [name, v] of HAND_BUILT)
      expect(normalize(guildsView(v)), name).toBe(normalize(guilds(v)));
  });

  // normalize() drops the white space next to a block tag; a chat line that
  // gained a space at its end passed it (the E2E suite of #169 reads the text
  // of an <li> with a pattern that ends in $). The old „Aktionen“ cell joined
  // its three buttons with spaces even where two were missing, so it is read
  // trimmed.
  const texts = (html: string): string[] =>
    textContents(html).map((t) => (t.startsWith('td:') ? t.trim() : t));

  it('keeps the text of every line, cell and button as before', () => {
    fc.assert(
      fc.property(state, (v) => {
        expect(texts(guildsView(v))).toEqual(texts(guilds(v)));
      }),
      { seed: 118, numRuns: 300 },
    );
    for (const [name, v] of HAND_BUILT)
      expect(texts(guildsView(v)), name).toEqual(texts(guilds(v)));
  });

  it('reaches the pages the sample is meant to compare', () => {
    // Every branch of the page shows in at least one hand-built case.
    const all = HAND_BUILT.map(([, v]) => normalize(guildsView(v))).join('\n');
    for (const mark of [
      'class="guild-list"',
      'class="guild-title"',
      'data-act="guildApply"',
      'data-act="guildLeave" data-confirm',
      'data-act="guildDissolve"',
      'data-act="guildMember" data-transfer="1"',
      'data-act="guildAssign"',
      'data-act="guildReview"',
      'data-act="rankRename"',
      'data-act="rankRights"',
      'data-up="1"',
      'data-act="rankDelete"',
      'data-act="rankDefault"',
      'data-act="rankCreate"',
      'data-act="guildChatDelete"',
      'data-act="guildChatAdmin"',
      'id="guildchatform"',
      'data-edit="1" id="guildform"',
      'data-edit="0" id="guildform"',
      'class="rank-select"',
      'data-rank-right=',
      'disabled',
      'chat-event',
      '<i>ehemaliges Mitglied</i>',
      'Noch keine Nachrichten.',
      'Es gibt noch keine Gilden.',
      'Diese Gilde hat noch keinen Profiltext.',
      'Keine offenen Bewerbungen.',
      'Alle Rechte.',
      'Keine Rechte.',
    ])
      expect(all, mark).toContain(mark);
  });

  it('keeps every hook the handlers and the layout read', () => {
    const html = guildsView(ownGuild('u_a', 'r0', ALL));
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    for (const id of [
      'guildchatform',
      'chat_text',
      'guildform',
      'guild_tag',
      'guild_name',
      'guild_description',
      'rank_new',
      'rank_of_u_b',
      'rank_name_r1',
      'rank_r1_chat-read',
    ])
      expect(ids, id).toContain(id);
    expect(html).toContain(
      '<div class="chat-log" role="log" aria-label="Chat" tabindex="0">',
    );
  });
});

// ----- the dialogs -----

const RANKS = {
  lead: 'u_a',
  rank: 'r0',
  rights: [] as string[],
  default: 'r1',
  list: [
    { id: 'r0', name: 'Leitung', rights: [] },
    { id: 'r1', name: 'Mitglied', rights: [] },
    {
      id: 'r2',
      name: 'Ehrenwerter Großadmiral der Äußeren Randwelten',
      rights: [],
    },
    { id: 'r3', name: '<u>Rang</u> & "Co"', rights: [] },
  ],
  members: {},
} as unknown as GuildRanks;

describe('the dialogs against the HTML before #118, bundle 6', () => {
  it('renders the hand-over as before', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('u_a', 'u<b>_"x"'),
        fc.constantFrom(...NAMES, ''),
        fc.integer({ min: 0, max: 4 }),
        (uid, name, ranks) => {
          const list = { ...RANKS, list: RANKS.list.slice(0, ranks) };
          expect(normalize(transferDialogView(list, uid, name))).toBe(
            normalize(transferDialog(list, uid, name)),
          );
        },
      ),
      { seed: 118, numRuns: 300 },
    );
  });

  it('renders the dissolution as before', () => {
    fc.assert(
      fc.property(fc.constantFrom(...TAGS, ''), (tag) => {
        const g = { ...THE_WIDEST, tag } as unknown as Guild;
        expect(normalize(dissolveDialogView(g))).toBe(
          normalize(dissolveDialog(g)),
        );
      }),
      { seed: 118, numRuns: 300 },
    );
  });

  it('renders the admin’s chat as before', () => {
    fc.assert(
      fc.property(
        fc.record({
          tag: fc.constantFrom(...TAGS),
          name: fc.constantFrom(...GUILD_NAMES),
        }),
        fc.array(message, { maxLength: 6 }),
        (g, list) => {
          const read = {
            guild: g,
            messages: list.map((m, i) => ({
              ...m,
              id: i + 1,
              time: BASE + m.time,
              arrival: m.arrival === undefined ? undefined : BASE + m.arrival,
            })),
          } as unknown as Parameters<typeof adminChatDialog>[0];
          expect(normalize(adminChatDialogView(read))).toBe(
            normalize(adminChatDialog(read)),
          );
        },
      ),
      { seed: 118, numRuns: 300 },
    );
  });

  it('renders the hand-built dialogs as before', () => {
    const empty = { guild: { tag: 'OR', name: 'X' }, messages: [] };
    expect(normalize(adminChatDialogView(empty))).toBe(
      normalize(adminChatDialog(empty)),
    );
    const one = { ...RANKS, list: RANKS.list.slice(0, 1) };
    expect(normalize(transferDialogView(one, 'u_b', 'Bert'))).toBe(
      normalize(transferDialog(one, 'u_b', 'Bert')),
    );
    const html = dissolveDialogView(THE_WIDEST as unknown as Guild);
    // The field the dissolving is confirmed in is kept out of the drafts (main.ts reads data-nokeep).
    expect(html).toMatch(/<input[^>]*id="dissolve_tag"[^>]*data-nokeep/);
    expect(html).toContain('id="guilddissolveform"');
    expect(transferDialogView(RANKS, 'u_b', 'Bert')).toContain(
      'id="guildtransferform" data-uid="u_b"',
    );
  });
});
