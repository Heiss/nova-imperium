// The list „Auftrag“ of the fleet form (#253, owner, 2026-11-16): the
// component Fleet shows every mission as it is mounted, the missions of a
// choice once the form is aimed at its target, and „Ziel wird geprüft …“
// with „Flotte losschicken“ blocked while the target is not known; without
// a mission that fits, the list is empty and nothing is sent (owner,
// 2026-11-17). And the „Schnellwahl“ of the other own planets and moons.
// Rendered on the server side of Svelte, as text without Svelte's comments.
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import { MISSION } from '../../core/missions.ts';
import { planet, U } from '../../test/fixtures.ts';
import { stripComments } from '../../test/markup.ts';
import {
  fleetPage,
  missionChoice,
  type MissionChoice,
} from '../logic/fleet.ts';
import type { GameState } from '../logic/types.ts';
import type { Ui, V } from './common.ts';
import Fleet from './Fleet.svelte';

const own = (id: string, kind: 'planet' | 'moon', p: number, name: string) => ({
  id,
  kind,
  name,
  g: 1,
  s: 2,
  p,
  temp: 20,
  owner: 'u1',
});

const state = (galaxy: object[]): GameState =>
  ({
    cfg: U,
    me: { id: 'u1' },
    players: { u1: { name: 'Anna' } },
    fleets: [],
    galaxy,
    debris: [],
  }) as unknown as GameState;

const v: V = {
  s: state([]),
  P: planet({ id: 'p1_2_5', g: 1, s: 2, p: 5, ships: { lc: 1 } }),
  R: { research: {}, rq: null },
  now: 1000,
  ui: { ft: null, fm: 'attack' } as unknown as Ui,
};

/** The list „Auftrag“ and the button below the form. */
function form(
  choice?: MissionChoice,
  view = v,
): { html: string; list: string; send: string } {
  const html = stripComments(
    render(Fleet, { props: { page: fleetPage(view), choice } }).body,
  );
  return {
    html,
    list: /<select id="t_m"[^>]*>(.*?)<\/select>/s.exec(html)![1]!,
    send: /<button data-act="send"[^>]*>/.exec(html)![0],
  };
}

const values = (list: string): string[] =>
  [...list.matchAll(/value="([^"]*)"/g)].map((m) => m[1]!);

describe('the list „Auftrag“ of the fleet form (#253)', () => {
  it('is mounted with every mission', () => {
    const { list, send } = form();
    expect(values(list)).toEqual(Object.keys(MISSION));
    expect(send).not.toContain('disabled');
  });

  it('shows only the missions of the choice, the first that fits selected', () => {
    const { list, send } = form(
      missionChoice('u1', { planet: { owner: 'u2' }, debris: false }, 'deploy'),
    );
    expect(values(list)).toEqual(['attack', 'transport', 'spy']);
    expect(list).toContain(`value="attack" selected="">${MISSION.attack}<`);
    expect(list.match(/selected/g)).toHaveLength(1);
    expect(send).not.toContain('disabled');
  });

  it('shows „Ziel wird geprüft …“ and blocks the sending while the target is checked', () => {
    const { list, send } = form(missionChoice('u1', undefined, 'attack'));
    expect(list).toBe('<option value="">Ziel wird geprüft …</option>');
    expect(send).toContain('disabled');
  });

  it('shows an empty list and blocks the sending where no mission fits (owner, 2026-11-17)', () => {
    const { list, send } = form(
      missionChoice(
        'u1',
        { planet: { owner: 'u1' }, debris: false, start: true },
        'deploy',
      ),
    );
    expect(list).toBe('');
    expect(send).toContain('disabled');
  });
});

describe('the „Schnellwahl“ of the fleet form (#253, owner, 2026-11-17)', () => {
  const galaxy = [
    own('p1_2_5', 'planet', 5, 'Heimat'),
    own('m1_2_5', 'moon', 5, 'Luna'),
    own('p1_2_9', 'planet', 9, 'Kolonie & <Co>'),
  ];

  it('lists the other own planets and moons after „– wählen –“, with its label', () => {
    const { html } = form(undefined, { ...v, s: state(galaxy) });
    expect(html).toContain(
      '<tr><td>Schnellwahl</td><td><select id="t_q" aria-label="Schnellwahl">' +
        '<option value="">– wählen –</option>' +
        '<option value="m1_2_5">Luna (Mond) [1:2:5]</option>' +
        '<option value="p1_2_9">Kolonie &amp; &lt;Co> [1:2:9]</option>' +
        '</select></td></tr>',
    );
    // Between the target and the list „Auftrag“.
    expect(html.indexOf('id="t_k"')).toBeLessThan(html.indexOf('id="t_q"'));
    expect(html.indexOf('id="t_q"')).toBeLessThan(html.indexOf('id="t_m"'));
  });

  it('is left out without another own planet or moon', () => {
    expect(form().html).not.toContain('Schnellwahl');
    expect(
      form(undefined, { ...v, s: state([galaxy[0]!]) }).html,
    ).not.toContain('Schnellwahl');
  });
});
