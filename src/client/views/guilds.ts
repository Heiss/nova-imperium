import { chatEventText, MAX_CHAT_TEXT } from '../../core/guild-chat.ts';
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
} from '../../core/guild-ranks.ts';
import { arrivalAt, dt, esc, fmt } from '../logic/format.ts';
import type {
  Guild,
  GuildChat,
  GuildChatMessage,
  GuildRank,
  GuildRanks,
  GuildState,
} from '../logic/types.ts';
import { box, type V } from './common.ts';

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
export function adminChatDialog(read: {
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
export function transferDialog(ranks: GuildRanks, uid: string, name: string) {
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
export function dissolveDialog(g: Guild): string {
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

export function guilds(v: V): string {
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
