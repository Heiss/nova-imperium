// The markup of the attack union („Verbandsangriff“, #225): the box of the
// fleet view with the unions the player leads, flies in or is invited to, and
// the row „Verband“ of the fleet form. What it shows is worked out in
// logic/union.ts.
import { esc } from '../logic/format.ts';
import { joinChoices, openRows, unionRows } from '../logic/union.ts';
import { box, cd, type V } from './common.ts';

/**
 * The own Sturmangriffe on their way that can open a union, each with its
 * button; the recall of the fleet that opened a union turns back the whole
 * union (owner, 2026-11-16, Q2), a participant's only his own.
 */
function openList(v: V): string {
  const rows = openRows(v);
  if (!rows.length) return '';
  const list = rows
    .map(
      (f) =>
        `<tr><td>Sturmangriff auf ${esc(f.target)}</td><td class="n w110">${cd(f.arr, v.now)}</td><td><button class="small" data-act="openUnion" data-id="${esc(f.id)}">Angriffsverband eröffnen</button></td></tr>`,
    )
    .join('');
  return `<table class="mt">${list}</table>`;
}

/** The box „Verbandsangriff“; nothing while no union concerns the player and no attack can open one. */
export function unionBox(v: V): string {
  const rows = unionRows(v);
  const open = openList(v);
  if (!rows.length && !open) return '';
  const list = rows.map((u) => {
    const id = esc(u.id);
    const invite = u.leads
      ? `<div class="mt"><input type="text" id="un_name_${id}" maxlength="20" placeholder="Spielername" aria-label="Spieler zum Angriffsverband einladen"> <button class="small" data-act="inviteUnion" data-id="${id}">Einladen</button></div>`
      : '';
    const invited = u.invited
      ? `<div class="dim">Eingeladen: ${esc(u.invited)}</div>`
      : '';
    return `<div class="union" id="un_${id}"><b>${esc(u.title)}</b> · Anführer ${esc(u.leader)} · Ankunft in ${cd(u.arr, v.now)}
<div class="dim">${esc(u.counts)}</div><div>Flotten: ${esc(u.fleets)}</div>${invited}${invite}
<div class="mt"><button class="small" data-act="joinUnion" data-id="${id}">Beitreten</button></div></div>`;
  });
  const hint = rows.length
    ? '<div class="dim mt">Ruft der Anführer seine Flotte zurück, kehren alle Flotten des Verbands um; ein Beteiligter ruft nur seine eigene zurück.</div>'
    : '';
  return box('Verbandsangriff', list.join('') + open + hint);
}

/** The row „Verband“ of the fleet form: the unions the fleet can join, none preselected unless chosen. */
export function unionFormRow(v: V): string {
  const choices = joinChoices(v);
  if (!choices.length) return '';
  const options = choices
    .map(
      (c) =>
        `<option value="${esc(c.id)}"${v.ui.union === c.id ? ' selected' : ''}>${esc(c.label)}</option>`,
    )
    .join('');
  return `<tr id="t_union_row"><td><label for="t_u">Verband</label></td><td><select id="t_u"><option value="">Kein Verband</option>${options}</select></td></tr>`;
}
