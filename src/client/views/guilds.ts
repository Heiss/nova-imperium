import {
  GUILD_RIGHTS,
  MAX_GUILD_RANKS,
  MAX_RANK_NAME,
  MIN_RANK_NAME,
  type GuildRight,
} from '../../core/guild-ranks.ts';
import { esc, fmt } from '../logic/format.ts';
import type {
  Guild,
  GuildRank,
  GuildRanks,
  GuildState,
} from '../logic/types.ts';
import { box, type V } from './common.ts';

/** The rights as the guild view names them (#163). */
const RIGHT_TEXT: Record<GuildRight, string> = {
  applications: 'Bewerbungen annehmen und ablehnen',
  remove: 'Mitglieder entfernen',
  assign: 'Ränge an Mitglieder vergeben',
  profile: 'Gildenname, Kürzel und Text ändern',
  ranks: 'Ränge verwalten',
};

const heading = (guild: Guild): string =>
  `[${esc(guild.tag)}] ${esc(guild.name)}`;

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
    ? `<table><tr><th>Gilde</th><th class="n">Mitglieder</th><th class="n">Punkte</th><th class="n">Ø Punkte</th></tr>${rows}</table>`
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

/** The place of a member; a member without a rank stands lowest. */
function placeOf(me: Inside, id: string): number {
  if (id === me.ranks.lead) return 0;
  const at = me.ranks.list.findIndex((r) => r.id === me.ranks.members[id]);
  return at < 0 ? Infinity : at;
}

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
  return g.members.length === 1
    ? '<button class="red" data-act="guildLeave" data-confirm="Gilde wirklich auflösen?">Gilde auflösen</button>'
    : '';
}

/** „Rang ändern“: the ranks below the own one, for a member below it. */
function rankChange(me: Inside, id: string, name: string): string {
  const options = me.ranks.list
    .filter((_, i) => i > me.at)
    .map(
      (r) =>
        `<option value="${esc(r.id)}"${r.id === me.ranks.members[id] ? ' selected' : ''}>${esc(r.name)}</option>`,
    )
    .join('');
  return `<select id="rank_of_${esc(id)}" aria-label="Neuer Rang für ${esc(name)}">${options}</select>
      <button class="small" data-act="guildAssign" data-uid="${esc(id)}">Rang ändern</button>`;
}

function memberControls(me: Inside, m: Guild['members'][number]): string {
  if (m.id === me.uid) return '';
  const lower = placeOf(me, m.id) > me.at;
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
    return `<table><tr><th>Spieler</th><th class="n">Punkte</th></tr>${rows}</table>`;
  }
  const rankName = (id: string): string =>
    esc(me.ranks.list.find((r) => r.id === me.ranks.members[id])?.name ?? '–');
  const rows = g.members
    .map(
      (m) =>
        `<tr><td>${esc(m.name)}</td><td class="rank">${m.id === me.ranks.lead ? esc(me.ranks.list[0]!.name) : rankName(m.id)}</td><td class="n">${fmt(m.points)}</td><td>${memberControls(me, m)}</td></tr>`,
    )
    .join('');
  return `<table><tr><th>Spieler</th><th>Rang</th><th class="n">Punkte</th><th></th></tr>${rows}</table>`;
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
  return `<div><label for="rank_name_${id}">Rangname</label> <input id="rank_name_${id}" required minlength="${MIN_RANK_NAME}" maxlength="${MAX_RANK_NAME}" value="${esc(rank.name)}">
      <button class="small" data-act="rankRename" data-rank="${id}">Umbenennen</button></div>
    <div class="rights">${boxes}</div>
    <p><button class="small" data-act="rankRights" data-rank="${id}">Rechte speichern</button>
    ${at - 1 > me.at ? `<button class="small" data-act="rankMove" data-rank="${id}" data-up="1">Nach oben</button>` : ''}
    ${last ? '' : `<button class="small" data-act="rankMove" data-rank="${id}">Nach unten</button>`}
    ${isDefault ? '' : `<button class="small red" data-act="rankDelete" data-rank="${id}">Löschen</button>`}</p>`;
}

function rankEntry(me: Inside, rank: GuildRank, at: number): string {
  const isDefault = rank.id === me.ranks.default;
  const body =
    me.can('ranks') && at > me.at
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
  return `<h2>${heading(g)}</h2>
  <p><button class="small" data-act="nav" data-v="guilds">Zur Gildenübersicht</button></p>
  ${box('Gildenprofil', g.html || '<p>Diese Gilde hat noch keinen Profiltext.</p>')}
  ${box('Punkte', `<p>${fmt(g.score)} gesamt · ${fmt(g.average)} pro Mitglied</p>`)}
  ${box('Mitglieder', roster(g, me))}
  ${guildMembership(state, g, me)}
  ${own && me ? management(g, own, me) : ''}`;
}
