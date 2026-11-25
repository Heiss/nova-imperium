// „Optionen“ in sections on a phone (#189): the switch, the section each box
// belongs to, and the ids and hooks that stay in the page whichever section is
// shown (the CSS hides the others up to 760 px only).
import { afterEach, describe, expect, it } from 'vitest';
import { roundDefaults } from '../../test/fixtures.ts';
import { levelView } from '../../test/level-view.ts';
import { optionsView } from '../../test/options-view.ts';
import { normalize } from '../../test/markup.ts';
import { forgetForms } from '../logic/form-state.svelte.ts';
import { optionsForm } from '../logic/options-form.svelte.ts';
import { DEFAULT_SECTION, OPTION_SECTIONS } from '../logic/phone-options.ts';
import { phoneOptions } from '../logic/phone-options.svelte.ts';
import type { GameState } from '../logic/types.ts';
import { ANEW, FRESH, MOUNTED, mountsAnew } from './mount.ts';
import type { V } from './common.ts';

function page(): string {
  const v = levelView({}, {}, [], { probes: 1, pushOff: [] });
  v.s.round = roundDefaults() as unknown as GameState['round'];
  v.s.homePlanet = 'p';
  v.ui = {
    animations: true,
    view: 'help',
    webPush: true,
  } as unknown as V['ui'];
  return normalize(optionsView(v));
}

afterEach(() => {
  phoneOptions.section = DEFAULT_SECTION;
});

/** The title of every box and its section, in the order of the page. */
function boxes(html: string): [string, string][] {
  return [
    ...html.matchAll(
      /<div class="box" data-sec="(\w+)"><div class="hd">([^<]*)<\/div>/g,
    ),
  ].map((m) => [m[2]!, m[1]!]);
}

describe('the sections of „Optionen“', () => {
  it('are five, with distinct keys, and start with the first', () => {
    const keys = OPTION_SECTIONS.map((s) => s.key);
    expect(new Set(keys).size).toBe(5);
    expect(DEFAULT_SECTION).toBe(keys[0]);
    expect(OPTION_SECTIONS.map((s) => s.label)).toEqual([
      'Spiel',
      'Runde',
      'Konto',
      'Gerät',
      'Weiteres',
    ]);
  });

  it('give every box of the page its section', () => {
    const html = page();
    expect(boxes(html)).toEqual([
      ['Optionen', 'game'],
      ['Hauptplanet', 'game'],
      ['Urlaubsmodus', 'round'],
      ['Meine Aktivität &amp; Spielzeit', 'round'],
      ['Rundenarchiv', 'round'],
      ['Darstellung', 'device'],
      ['Passwort ändern', 'account'],
      // The authenticator app (#401).
      ['Authenticator-App', 'account'],
      ['Passkeys', 'account'],
      ['App installieren', 'device'],
      ['Benachrichtigungen', 'device'],
      ['Browser-Benachrichtigungen', 'device'],
      ['Problem melden', 'other'],
      ['Account löschen', 'account'],
    ]);
    // No box without a section: it would show in every section.
    expect(html.match(/<div class="box"/g)).toHaveLength(14);
    expect(html).toContain('<p data-sec="other">Tempo, Größe');
    // Every section has a box, so none of the five buttons shows an empty page.
    const used = new Set(boxes(html).map(([, section]) => section));
    expect([...used].sort()).toEqual(OPTION_SECTIONS.map((s) => s.key).sort());
  });

  it('are a switch above the boxes, a group of five buttons on every width (#356)', () => {
    const html = page();
    expect(html).toContain(
      '<div aria-label="Bereich" class="seg opt-seg" role="group"><button aria-pressed="true" class="on" type="button">Spiel</button><button aria-pressed="false" type="button">Runde</button>',
    );
    expect(html.indexOf('aria-label="Bereich"')).toBeLessThan(
      html.indexOf('<div class="box"'),
    );
    expect(html).toContain('<div class="opt" data-section="game">');
  });

  it('follow the section the player chose, over a render', () => {
    phoneOptions.section = 'account';
    const html = page();
    expect(html).toContain('<div class="opt" data-section="account">');
    expect(html).toContain(
      '<button aria-pressed="true" class="on" type="button">Konto</button>',
    );
    expect(html).toContain(
      '<button aria-pressed="false" type="button">Spiel</button>',
    );
  });

  it('keep every id and hook of the page, whichever section is shown', () => {
    for (const section of OPTION_SECTIONS.map((s) => s.key)) {
      phoneOptions.section = section;
      const html = page();
      for (const mark of [
        'id="o_probes"',
        'id="o_explain"',
        'id="o_levels"',
        'data-act="saveopt"',
        'id="o_main"',
        'data-act="mainPlanet"',
        'data-act="startVacation"',
        'id="own-activity"',
        'data-act="reloadOwnActivity"',
        'id="o_anim"',
        'id="passwordform"',
        'id="passkeyform"',
        'data-act="listPasskeys"',
        'id="passkey-list"',
        'id="pwa-install"',
        'data-act="installApp"',
        'data-chg="push"',
        'data-act="pushEnable"',
        'data-act="pushDisable"',
        'id="reportform"',
        'data-act="deleteAccount"',
        'data-act="lex"',
      ])
        expect(html, `${section}: ${mark}`).toContain(mark);
    }
  });
});

describe('the fields keep what was typed and chosen over a redraw (#332)', () => {
  afterEach(forgetForms);

  /** The options of the select `id`, the selected ones marked by a star. */
  const choices = (html: string, id: string): string[] =>
    [
      ...new RegExp(`<select id="${id}">([^]*?)</select>`)
        .exec(html)![1]!
        .matchAll(/<option([^>]*)>/g),
    ].map(
      ([, attrs]) =>
        /value="([^"]*)"/.exec(attrs!)![1]! +
        (/\bselected\b/.test(attrs!) ? '*' : ''),
    );

  it('show the page while nobody touched them', () => {
    const html = page();
    expect(html).toMatch(/id="o_probes"[^>]*value="1"/);
    expect(/<input[^>]*id="pw_current"[^>]*>/.exec(html)![0]).not.toContain(
      'value',
    );
    expect(html).toMatch(
      /<textarea[^>]*id="reportform-text"[^>]*><\/textarea>/,
    );
  });

  it('show what was typed and chosen, an emptied field empty', () => {
    const before = choices(page(), 'o_levels');
    Object.assign(optionsForm, {
      probes: '',
      levels: 'always',
      pwNext: 'neu & <geheim>',
      report: 'Es ging <nicht>.',
    });
    const html = page();
    expect(html).toMatch(/id="o_probes"[^>]*value=""/);
    expect(before).toEqual(['always', 'icon*', 'hidden']);
    expect(choices(html, 'o_levels')).toEqual(['always*', 'icon', 'hidden']);
    expect(html).toMatch(/id="pw_next"[^>]*value="neu &amp; &lt;geheim>"/);
    expect(html).toContain('>Es ging &lt;nicht>.</textarea>');
  });
});

describe('the mounting of „Optionen“ (#355)', () => {
  it('is mounted once and kept by a render that is not fresh, so the page does not move', () => {
    expect(MOUNTED.has('help')).toBe(true);
    expect(ANEW.has('help')).toBe(false);
    expect(mountsAnew('help', false, false)).toBe(false);
  });

  it('is mounted anew by a fresh render, which drops what was typed', () => {
    expect(FRESH.has('help')).toBe(true);
    expect(mountsAnew('help', true, false)).toBe(true);
  });
});
