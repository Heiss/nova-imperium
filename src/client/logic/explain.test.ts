import { describe, expect, it } from 'vitest';
import { BUILD, DEF, SHIPS } from '../../shared/catalog.ts';
import {
  explainButtonHTML,
  explainMode,
  explainOptionsHTML,
  explainPanelHTML,
  explanation,
  type Explanation,
} from './explain.ts';

const metal = BUILD.metal!;
const withText = { n: 'Erzmine <A&B>', ds: 'Kurz.', lt: 'Lang & "breit".' };

describe('explanation of an entry per display mode (issue #63)', () => {
  it('„Immer anzeigen“: the panel is open, there is no (?)', () => {
    expect(explanation('metal', metal, 'always', {})).toEqual({
      key: 'metal',
      button: 'exq_metal',
      panel: 'ex_metal',
      name: 'Adamant-Tiefbohrung',
      text: metal.lt,
      toggle: false,
      open: true,
    });
    expect(explanation('metal', metal, 'always', { metal: false })!.open).toBe(
      true,
    );
  });

  it('„(?)-Symbol“: a (?) toggles the panel, closed until opened', () => {
    const closed = explanation('metal', metal, 'icon', {})!;
    expect(closed).toMatchObject({ toggle: true, open: false });
    expect(explanation('metal', metal, 'icon', { metal: true })).toEqual({
      ...closed,
      open: true,
    });
    expect(explanation('metal', metal, 'icon', { crystal: true })!.open).toBe(
      false,
    );
  });

  it('„Ausblenden“: neither the panel nor the (?)', () => {
    expect(explanation('metal', metal, 'hidden', { metal: true })).toBeNull();
  });

  it('shows the long text instead of the short one when there is one', () => {
    expect(explanation('x', withText, 'always', {})!.text).toBe(
      'Lang & "breit".',
    );
  });

  it('shows the short ds when an entry has no long text (D4)', () => {
    const short = { n: 'Erzmine', ds: 'Kurz.' };
    expect(explanation('x', short, 'always', {})!.text).toBe('Kurz.');
  });

  it('gives an entry without any text neither panel nor (?)', () => {
    for (const mode of ['always', 'icon', 'hidden'] as const)
      expect(explanation('x', { n: 'Sonde' }, mode, {})).toBeNull();
  });

  it('gives the ships and the defense the (?) with their long text (#94)', () => {
    expect(SHIPS.probe!.ds).toBeUndefined();
    expect(explanation('probe', SHIPS.probe!, 'icon', {})).toMatchObject({
      toggle: true,
      text: SHIPS.probe!.lt,
    });
    expect(explanation('rl', DEF.rl!, 'always', {})!.text).toBe(DEF.rl!.lt);
  });

  it('uses the (?) for a missing or unknown mode (default D2)', () => {
    expect(explainMode(undefined)).toBe('icon');
    expect(explainMode('never')).toBe('icon');
    expect(explainMode('always')).toBe('always');
    expect(explainMode('hidden')).toBe('hidden');
    expect(explanation('metal', metal, undefined, {})!.toggle).toBe(true);
  });
});

/** The attributes of the first element with the given tag. */
function attributes(html: string, tag: string): Record<string, string> {
  const element = new RegExp(`<${tag}\\b([^>]*)>`).exec(html);
  if (!element) throw new Error(`no <${tag}> in ${html}`);
  const pairs = [...element[1]!.matchAll(/([\w-]+)(?:="([^"]*)")?/g)];
  return Object.fromEntries(pairs.map((m) => [m[1]!, m[2] ?? '']));
}

describe('the (?) button and the panel', () => {
  const icon = (open: boolean): Explanation =>
    explanation('x', withText, 'icon', { x: open })!;

  it('is a real button that controls the panel and says whether it is open', () => {
    for (const open of [false, true]) {
      const button = attributes(explainButtonHTML(icon(open)), 'button');
      const panel = attributes(explainPanelHTML(icon(open)), 'div');
      expect(button).toMatchObject({
        type: 'button',
        id: 'exq_x',
        'data-act': 'explain',
        'data-k': 'x',
        'aria-controls': panel.id,
        'aria-expanded': String(open),
        'aria-label': 'Erklärung zu Erzmine &lt;A&amp;B&gt;',
      });
      expect(panel).toEqual({
        class: 'ex',
        id: 'ex_x',
        ...(open ? {} : { hidden: '' }),
      });
    }
  });

  it('shows the text escaped in the panel', () => {
    expect(explainPanelHTML(icon(true))).toContain(
      'Lang &amp; &quot;breit&quot;.',
    );
  });

  it('has no button when the panel is always open, and nothing when hidden', () => {
    const always = explanation('x', withText, 'always', {});
    expect(explainButtonHTML(always)).toBe('');
    expect('hidden' in attributes(explainPanelHTML(always), 'div')).toBe(false);
    expect(explainButtonHTML(null)).toBe('');
    expect(explainPanelHTML(null)).toBe('');
  });
});

describe('the option in „Hilfe & Optionen“', () => {
  it('offers the three modes and selects the current one', () => {
    const html = explainOptionsHTML('hidden');
    const options = [...html.matchAll(/<option ([^>]*)>([^<]*)<\/option>/g)];
    expect(options.map((m) => m[2])).toEqual([
      'Immer anzeigen',
      'Als (?)-Symbol',
      'Ausblenden',
    ]);
    expect(html).toBe(options.map((m) => m[0]).join(''));
    expect(options.map((m) => attributes(m[0], 'option'))).toEqual([
      { value: 'always' },
      { value: 'icon' },
      { value: 'hidden', selected: '' },
    ]);
  });

  it('selects the (?) for a player without a stored mode', () => {
    expect(explainOptionsHTML(undefined)).toContain(
      '<option value="icon" selected>',
    );
  });
});
