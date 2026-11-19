// The view „Freunde“ (#227, okf/features/buddy-list.md): the friends with
// their contact (name, guild tag, a planet on the Sternenkarte) and online
// or offline, the open requests to the player and their own, and the form
// „Freundschaft anfragen“. Every name goes through esc().
import { buddyList, type Contact, type Named } from '../logic/friends.ts';
import { esc } from '../logic/format.ts';
import { box, homeCell, type V } from './common.ts';

/** A button of the list: `op` for the player `uid`. */
const button = (op: string, p: Named, label: string, cls = 'small'): string =>
  `<button class="${cls}" data-act="friend" data-op="${op}" data-uid="${esc(p.id)}">${label}</button>`;

const friendRow = (f: Contact): string =>
  `<tr><td>${esc(f.name)}</td><td>${f.tag === null ? '-' : `[${esc(f.tag)}]`}</td><td>${homeCell(f.home)}</td>
  <td>${f.online ? '<span class="good">online</span>' : '<span class="dim">offline</span>'}</td>
  <td>${button('remove', f, 'Freundschaft beenden', 'small red')}</td></tr>`;

function friendTable(list: Contact[]): string {
  if (!list.length) return '<p>Du hast noch keine Freunde.</p>';
  return `<table class="friends"><tr><th>Spieler</th><th>Gilde</th><th>Heimatplanet</th><th>Status</th><th></th></tr>${list.map(friendRow).join('')}</table>`;
}

export function friends(v: V): string {
  const { list, incoming, outgoing } = buddyList(v.s);
  const requests = incoming
    .map(
      (p) =>
        `<p>${esc(p.name)} ${button('accept', p, 'Annehmen')} ${button('refuse', p, 'Ablehnen')}</p>`,
    )
    .join('');
  const own = outgoing
    .map(
      (p) =>
        `<p>${esc(p.name)} ${button('cancel', p, 'Anfrage zurückziehen')}</p>`,
    )
    .join('');
  return `<h2>Freunde</h2><div class="box">${friendTable(list)}</div>
  ${box('Anfragen', requests || '<p>Keine offenen Anfragen.</p>')}
  ${own ? box('Deine Anfragen', own) : ''}
  ${box(
    'Freundschaft anfragen',
    `<form id="friendform" class="flex"><label for="friend_name">Name</label> <input id="friend_name" maxlength="20" required autocomplete="off"> <button type="submit">Freundschaft anfragen</button></form>`,
  )}`;
}
