// The frame around the view (#118, bundle 1): the header line, the menu,
// the tab bar, the list of „Mehr“ and the resource bar render what their
// logic computes. Rendered on the server side of Svelte, as text.
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import type { HeaderLine } from '../logic/header.ts';
import type { NavLink, Navigation } from '../logic/navigation.ts';
import type { ResourceBar as Bar } from '../logic/resource-bar.ts';
import { planet } from '../../test/fixtures.ts';
import Header from './Header.svelte';
import Menu from './Menu.svelte';
import MoreList from './MoreList.svelte';
import ResourceBar from './ResourceBar.svelte';
import TabBar from './TabBar.svelte';

const line = (places: HeaderLine['places'] = []): HeaderLine => ({
  name: '<img src=x onerror=alert(1)>',
  position: '[1:2:3]',
  commander: '<script>x</script>',
  places,
});

const link = (view: string, over: Partial<NavLink> = {}): NavLink => ({
  view,
  label: view,
  href: `/?view=${view}`,
  on: false,
  hint: undefined,
  ...over,
});

const nav = (over: Partial<Navigation> = {}): Navigation => ({
  menu: [link('overview', { on: true }), '-', link('fleet')],
  tabs: [link('overview', { on: true })],
  more: [link('galaxy', { hint: 'Neu <b>"x"</b>' })],
  moreOn: false,
  moreHint: false,
  ...over,
});

describe('Header', () => {
  it('escapes what players write and has no list with one place', () => {
    const out = render(Header, { props: { line: line() } }).body;
    expect(out).not.toContain('<img src=x');
    expect(out).not.toContain('<script>');
    expect(out).toContain('<b>&lt;img src=x onerror=alert(1)></b>');
    expect(out).toContain('Kommandant <b>&lt;script>x&lt;/script></b>');
    expect(out).toContain('<span class="lnk" data-act="logout">Logout</span>');
    expect(out).not.toContain('<select');
  });

  it('lists the own places with the shown one selected', () => {
    const out = render(Header, {
      props: {
        line: line([
          { id: 'p1', label: 'Heimat [1:1:1]', selected: false },
          { id: 'p"2', label: 'K <i> [1:1:2]', selected: true },
        ]),
      },
    }).body;
    expect(out).toContain(
      '<select id="planet_select" aria-label="Aktiver Planet">',
    );
    expect(out).toMatch(/<option value="p1">Heimat \[1:1:1\]<\/option>/);
    expect(out).toMatch(
      /<option value="p&quot;2" selected="">K &lt;i> \[1:1:2\]<\/option>/,
    );
  });
});

describe('the navigation', () => {
  it('renders the menu with its separator and the open view', () => {
    const out = render(Menu, { props: { nav: nav() } }).body;
    expect(out).toContain(
      '<a href="/?view=overview" data-act="nav" data-v="overview" class="on" aria-current="page">',
    );
    expect(out).toContain('<div class="sep"></div>');
    expect(out).toContain('data-v="fleet"');
  });

  it('marks what is new with an escaped name', () => {
    const out = render(MoreList, { props: { nav: nav() } }).body;
    expect(out).toContain(
      '<span class="badge" role="img" aria-label="Neu &lt;b>&quot;x&quot;&lt;/b>" title="Neu &lt;b>&quot;x&quot;&lt;/b>">!</span>',
    );
    expect(out).toMatch(/<span>galaxy<\/span>(?:<!--[^>]*-->)*<svg /);
  });

  it('shows „Mehr“ in the tab bar, open and marked when it is', () => {
    const closed = render(TabBar, { props: { nav: nav() } }).body;
    expect(closed).toContain('data-act="moreOpen" aria-haspopup="dialog"');
    expect(closed).not.toContain('class="on" data-act="moreOpen"');
    expect(closed).not.toContain('class="dot"');
    const open = render(TabBar, {
      props: { nav: nav({ moreOn: true, moreHint: true }) },
    }).body;
    expect(open).toContain('class="on" data-act="moreOpen"');
    expect(open).toContain(
      '<span class="dot" role="img" aria-label="Neues unter Mehr"></span>',
    );
  });
});

describe('ResourceBar', () => {
  it('renders each resource with its icon, storage and the energy', () => {
    const bar: Bar = {
      planet: planet(),
      cells: [
        {
          label: 'Adamant',
          icon: 'metal',
          value: '1.234',
          full: true,
          title: '+100/h · Lager 100.000',
        },
      ],
      energy: { value: '-5/10', short: true },
    };
    const out = render(ResourceBar, { props: { bar } }).body;
    expect(out).toContain('<div class="res" title="+100/h · Lager 100.000">');
    expect(out).toContain('<div class="v full">1.234</div>');
    expect(out).toContain('<div class="v bad">-5/10</div>');
    expect(out).toMatch(/<img class="ri" src="[^"]+" alt="" width="28"/);
  });
});
