// The view „Freunde“ (#227): the friends with their contact and status, the
// requests both ways, the form; every name escaped.
import { describe, expect, it } from 'vitest';
import type { GameState } from '../logic/types.ts';
import type { V } from './common.ts';
import { friends } from './friends.ts';

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
  return friends({ s } as V);
}

describe('the view „Freunde“', () => {
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
      '<tr><td>Bert</td><td>[&lt;A&gt;]</td><td><span class="home">&lt;b&gt;Bertheim&lt;/b&gt;</span> <span class="lnk" data-act="gto" data-g="1" data-s="2">[1:2:4]</span></td>',
    );
    expect(html).toContain('<td><span class="good">online</span></td>');
    expect(html).toContain(
      '<tr><td>Cora</td><td>-</td><td>-</td>\n  <td><span class="dim">offline</span></td>',
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
      '<div class="hd">Anfragen</div><div class="bd"><p>&lt;i&gt;Dora&lt;/i&gt; <button class="small" data-act="friend" data-op="accept" data-uid="u_Dora">Annehmen</button> <button class="small" data-act="friend" data-op="refuse" data-uid="u_Dora">Ablehnen</button></p>',
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
      '<form id="friendform" class="flex"><label for="friend_name">Name</label> <input id="friend_name" maxlength="20" required autocomplete="off"> <button type="submit">Freundschaft anfragen</button></form>',
    );
  });
});
