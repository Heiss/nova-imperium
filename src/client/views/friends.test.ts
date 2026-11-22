// The view „Freunde“ (#227), as the component Friends renders it (#118, bundle
// 7): the friends with their contact and status, the requests both ways, the
// form; every name escaped.
import { describe, expect, it } from 'vitest';
import { friendsView } from '../../test/friends-view.ts';
import { normalize } from '../../test/markup.ts';
import type { GameState } from '../logic/types.ts';
import type { V } from './common.ts';
import { ANEW, FRESH, MOUNTED } from './mount.ts';

const at = { g: 1, s: 2, p: 4, temp: 20, kind: 'planet' };

function view(friendState: GameState['friends']): string {
  const s = {
    me: { id: 'u_Anna' },
    players: {
      u_Anna: { name: 'Anna', points: 1 },
      u_Bert: { name: 'Bert', points: 2 },
      u_Cora: { name: 'Cora', points: 3 },
      u_Dora: { name: '<i>Dora</i>', points: 4 },
    },
    galaxy: [{ ...at, id: 'p1_2_4', owner: 'u_Bert', name: '<b>Bertheim</b>' }],
    guilds: {
      directory: [{ id: 'g1', tag: '<A>', members: [{ id: 'u_Bert' }] }],
    },
    friends: friendState,
  } as unknown as GameState;
  return normalize(friendsView({ s } as V));
}

describe('the view „Freunde“', () => {
  it('is a mounted view, kept over a render that is not fresh and mounted anew by a fresh one (#361)', () => {
    expect(MOUNTED.has('friends')).toBe(true);
    expect(ANEW.has('friends')).toBe(false);
    expect(FRESH.has('friends')).toBe(true);
  });

  it('lists each friend with name, guild tag, planet link, status and „Freundschaft beenden“', () => {
    const html = view({
      list: [
        { id: 'u_Bert', online: true },
        { id: 'u_Cora', online: false },
      ],
      incoming: [],
      outgoing: [],
    });
    expect(html).toContain(
      '<table class="friends"><tr><th>Spieler</th><th>Gilde</th><th>Heimatplanet</th><th>Status</th><th></th>',
    );
    expect(html).toContain(
      '<tr><td>Bert</td><td>[&lt;A>]</td><td><span class="home">&lt;b>Bertheim&lt;/b></span> <span class="lnk" data-act="gto" data-g="1" data-s="2">[1:2:4]</span></td>',
    );
    expect(html).toContain('<td><span class="good">online</span></td>');
    expect(html).toContain(
      '<tr><td>Cora</td><td>-</td><td>-</td><td><span class="dim">offline</span></td>',
    );
    expect(html).toContain(
      '<button class="small red" data-act="friend" data-op="remove" data-uid="u_Cora">Freundschaft beenden</button>',
    );
    expect(html).not.toContain('Du hast noch keine Freunde.');
  });

  it('offers „Annehmen“ and „Ablehnen“ for a request to the player, „Anfrage zurückziehen“ for an own one', () => {
    const html = view({
      list: [],
      incoming: ['u_Dora'],
      outgoing: ['u_Cora'],
    });
    expect(html).toContain('<p>Du hast noch keine Freunde.</p>');
    expect(html).toContain(
      '<div class="hd">Anfragen</div><div class="bd"><p>&lt;i>Dora&lt;/i> <button class="small" data-act="friend" data-op="accept" data-uid="u_Dora">Annehmen</button> <button class="small" data-act="friend" data-op="refuse" data-uid="u_Dora">Ablehnen</button></p>',
    );
    expect(html).toContain(
      '<div class="hd">Deine Anfragen</div><div class="bd"><p>Cora <button class="small" data-act="friend" data-op="cancel" data-uid="u_Cora">Anfrage zurückziehen</button></p>',
    );
  });

  it('says when no request is open and hides „Deine Anfragen“ without one', () => {
    const html = view({ list: [], incoming: [], outgoing: [] });
    expect(html).toContain(
      '<div class="hd">Anfragen</div><div class="bd"><p>Keine offenen Anfragen.</p>',
    );
    expect(html).not.toContain('Deine Anfragen');
  });

  it('has the form „Freundschaft anfragen“ with a labelled name field', () => {
    const html = view(undefined);
    expect(html).toContain('<h2>Freunde</h2>');
    expect(html).toContain(
      '<form class="flex" id="friendform"><label for="friend_name">Name</label> <input autocomplete="off" id="friend_name" maxlength="20" required> <button type="submit">Freundschaft anfragen</button></form>',
    );
  });
});
