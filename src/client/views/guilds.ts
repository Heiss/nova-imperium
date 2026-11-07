import { esc, fmt } from '../logic/format.ts';
import type { Guild, GuildState } from '../logic/types.ts';
import { box, type V } from './common.ts';

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

function guildMembership(state: GuildState, g: Guild, uid: string): string {
  if (!state.own)
    return `<button data-act="guildApply" data-id="${esc(g.id)}">Bewerben</button>`;
  if (state.own.id !== g.id) return '';
  if (state.own.status === 'pending')
    return '<p>Deine Bewerbung ist offen.</p><button data-act="guildLeave">Bewerbung zurückziehen</button>';
  if (g.founder !== uid)
    return '<button data-act="guildLeave" data-confirm="Gilde wirklich verlassen?">Gilde verlassen</button>';
  return g.members.length === 1
    ? '<button class="red" data-act="guildLeave" data-confirm="Gilde wirklich auflösen?">Gilde auflösen</button>'
    : '';
}

function roster(g: Guild, isLead: boolean): string {
  const rows = g.members
    .map((m) => {
      const controls =
        isLead && m.id !== g.founder
          ? `<button class="small" data-act="guildMember" data-uid="${esc(m.id)}" data-transfer="1">Leitung übergeben</button>
      <button class="small red" data-act="guildMember" data-uid="${esc(m.id)}">Entfernen</button>`
          : '';
      return `<tr><td>${esc(m.name)}</td><td>${m.id === g.founder ? 'Leitung' : 'Mitglied'}</td><td class="n">${fmt(m.points)}</td><td>${controls}</td></tr>`;
    })
    .join('');
  return `<table><tr><th>Spieler</th><th>Rang</th><th class="n">Punkte</th><th></th></tr>${rows}</table>`;
}

function management(
  g: Guild,
  own: NonNullable<GuildState['management']>,
): string {
  const pending = own.pending
    .map(
      (m) => `<p>${esc(m.name)}
    <button class="small" data-act="guildReview" data-uid="${esc(m.id)}" data-accept="1">Annehmen</button>
    <button class="small" data-act="guildReview" data-uid="${esc(m.id)}">Ablehnen</button></p>`,
    )
    .join('');
  return (
    box('Bewerbungen', pending || '<p>Keine offenen Bewerbungen.</p>') +
    box('Gildenprofil bearbeiten', profileForm(g, own.description))
  );
}

export function guilds(v: V): string {
  const state = v.s.guilds ?? { directory: [], own: null, management: null };
  const g = state.directory.find((guild) => guild.id === v.ui.guild);
  if (!g) return directory(state);
  const own = state.management?.id === g.id ? state.management : null;
  return `<h2>${heading(g)}</h2>
  <p><button class="small" data-act="nav" data-v="guilds">Zur Gildenübersicht</button></p>
  ${box('Gildenprofil', g.html || '<p>Diese Gilde hat noch keinen Profiltext.</p>')}
  ${box('Punkte', `<p>${fmt(g.score)} gesamt · ${fmt(g.average)} pro Mitglied</p>`)}
  ${box('Mitglieder', roster(g, !!own))}
  ${guildMembership(state, g, v.s.me.id)}
  ${own ? management(g, own) : ''}`;
}
