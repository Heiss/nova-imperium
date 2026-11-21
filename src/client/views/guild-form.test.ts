// The fields of „Gilden“ keep what was typed, chosen and ticked over the
// redraw of the poll (#332): each part of the page, rendered on the server
// side of Svelte, shows the state of logic/guild-form.svelte.ts, else the page.
import { afterEach, describe, expect, it } from 'vitest';
import type { Component } from 'svelte';
import { render } from 'svelte/server';
import { normalize, stripComments } from '../../test/markup.ts';
import { forgetForms } from '../logic/form-state.svelte.ts';
import { guildForm, ticked } from '../logic/guild-form.svelte.ts';
import type { GuildPage } from '../logic/guilds.ts';
import GuildMembers from './GuildMembers.svelte';
import GuildProfileForm from './GuildProfileForm.svelte';
import GuildRanks from './GuildRanks.svelte';

afterEach(forgetForms);

const html = <P extends Record<string, unknown>>(
  component: Component<P>,
  props: P,
): string => normalize(stripComments(render(component, { props }).body));

const profile = () =>
  html(GuildProfileForm, {
    form: { edit: true, tag: 'ABC', name: 'Alpha', description: 'Hallo' },
  });

type Ranks = NonNullable<GuildPage['management']>['ranks'];
const ranks = (): string =>
  html(GuildRanks, {
    ranks: {
      entries: [
        {
          id: 'r2',
          legend: 'Offizier',
          editor: {
            name: 'Offizier',
            boxes: [
              { right: 'chat', label: 'Chat', checked: false, disabled: false },
              { right: 'war', label: 'Krieg', checked: true, disabled: true },
            ],
            up: false,
            down: false,
            remove: false,
          },
          rights: 'none',
          makeDefault: false,
        },
      ],
      create: true,
    } as unknown as Ranks,
  });

const members = (): string =>
  html(GuildMembers, {
    roster: {
      ranked: true,
      rows: [
        {
          id: 'u1',
          name: 'Anna',
          points: '1',
          rank: 'Mitglied',
          controls: {
            transfer: false,
            remove: false,
            assign: {
              options: [
                { id: 'r1', name: 'Mitglied', selected: true },
                { id: 'r2', name: 'Offizier', selected: false },
              ],
            },
          },
        },
      ],
    } as GuildPage['roster'],
  });

/** The attributes of the element with the id, as normalize() writes them. */
const tag = (markup: string, id: string): string =>
  new RegExp(`<[a-z]+ [^>]*id="${id}"[^>]*>`).exec(markup)![0];

describe('the profile of the guild', () => {
  it('shows the page while nobody typed, and what was typed after', () => {
    expect(tag(profile(), 'guild_tag')).toContain('value="ABC"');
    Object.assign(guildForm, {
      tag: 'X<Y',
      name: '',
      description: 'Neu & mehr',
    });
    const typed = profile();
    expect(tag(typed, 'guild_tag')).toContain('value="X&lt;Y"');
    expect(tag(typed, 'guild_name')).toContain('value=""');
    expect(typed).toContain('>Neu &amp; mehr</textarea>');
  });
});

describe('the ranks', () => {
  it('show the name of the page, the name typed, and the name of a new rank', () => {
    expect(tag(ranks(), 'rank_name_r2')).toContain('value="Offizier"');
    expect(tag(ranks(), 'rank_new')).not.toContain('value');
    guildForm.rankNames.r2 = 'Hauptmann';
    guildForm.rankNew = 'Rekrut';
    expect(tag(ranks(), 'rank_name_r2')).toContain('value="Hauptmann"');
    expect(tag(ranks(), 'rank_new')).toContain('value="Rekrut"');
  });

  it('tick a right as the player did, but a disabled one as the server says (#163)', () => {
    expect(tag(ranks(), 'rank_r2_chat')).not.toContain('checked');
    guildForm.rights.rank_r2_chat = true;
    guildForm.rights.rank_r2_war = false;
    expect(tag(ranks(), 'rank_r2_chat')).toContain('checked');
    expect(tag(ranks(), 'rank_r2_war')).toContain('checked');
    expect(ticked('rank_r2_war', { checked: true, disabled: true })).toBe(true);
    expect(ticked('rank_r2_war', { checked: true, disabled: false })).toBe(
      false,
    );
    expect(ticked('rank_r9_chat', { checked: true, disabled: false })).toBe(
      true,
    );
  });
});

describe('the rank chosen for a member', () => {
  it('is the member’s own until another is chosen', () => {
    const selected = (markup: string): string[] =>
      [...markup.matchAll(/<option([^>]*)>/g)]
        .filter(([, attrs]) => /\bselected\b/.test(attrs!))
        .map(([, attrs]) => /value="([^"]*)"/.exec(attrs!)![1]!);
    expect(selected(members())).toEqual(['r1']);
    guildForm.rankOf.u1 = 'r2';
    expect(selected(members())).toEqual(['r2']);
  });
});
