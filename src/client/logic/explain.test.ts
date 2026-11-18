import { describe, expect, it } from 'vitest';
import { text } from '../../core/text.ts';
import {
  explainMode,
  explainOptionsHTML,
  explanation,
  PANEL_ID,
  paragraphs,
} from './explain.ts';

const metal = text('metal')!;

/** The attributes of the first element with the given tag. */
function attributes(html: string, tag: string): Record<string, string> {
  const element = new RegExp(`<${tag}\\b([^>]*)>`).exec(html);
  if (!element) throw new Error(`no <${tag}> in ${html}`);
  const pairs = [...element[1]!.matchAll(/([\w-]+)(?:="([^"]*)")?/g)];
  return Object.fromEntries(pairs.map((m) => [m[1]!, m[2] ?? '']));
}

describe('the „?“ of an entry per display mode (#63, #285 B2)', () => {
  it('„Anzeigen“: a „?“ that opens the article in the side panel', () => {
    expect(explanation('metal', metal, 'icon', {})).toEqual({
      key: 'metal',
      button: 'exq_metal',
      panel: PANEL_ID,
      name: 'Adamant-Tiefbohrung',
      open: false,
    });
    expect(PANEL_ID).toBe('lexicanum-panel');
    expect(explanation('metal', metal, 'icon', { metal: true })!.open).toBe(
      true,
    );
    expect(explanation('metal', metal, 'icon', { crystal: true })!.open).toBe(
      false,
    );
  });

  it('„Ausblenden“: no „?“', () => {
    expect(explanation('metal', metal, 'hidden', { metal: true })).toBeNull();
  });

  it('turns a stored „Immer anzeigen“ and a missing or unknown mode into the „?“', () => {
    expect(explainMode(undefined)).toBe('icon');
    expect(explainMode('never')).toBe('icon');
    expect(explainMode('always')).toBe('icon');
    expect(explainMode('hidden')).toBe('hidden');
    expect(explanation('metal', metal, 'always', {})).not.toBeNull();
    expect(explanation('metal', metal, undefined, {})).not.toBeNull();
  });

  it('splits a text into its paragraphs at blank lines only', () => {
    expect(paragraphs('Eins.\n\nZwei.')).toEqual(['Eins.', 'Zwei.']);
    expect(paragraphs('Eins.\nnoch eins.')).toEqual(['Eins.\nnoch eins.']);
    expect(paragraphs(' Eins. \n\n Zwei. ')).toEqual(['Eins.', 'Zwei.']);
    expect(paragraphs(text('lab')!.lt!)).toHaveLength(2);
  });
});

describe('the option in „Hilfe & Optionen“ (#285 B2)', () => {
  it('offers the two values and selects the current one', () => {
    const html = explainOptionsHTML('hidden');
    const options = [...html.matchAll(/<option ([^>]*)>([^<]*)<\/option>/g)];
    expect(options.map((m) => m[2])).toEqual(['Anzeigen', 'Ausblenden']);
    expect(html).toBe(options.map((m) => m[0]).join(''));
    expect(options.map((m) => attributes(m[0], 'option'))).toEqual([
      { value: 'icon' },
      { value: 'hidden', selected: '' },
    ]);
  });

  it('selects „Anzeigen“ for a player without a stored mode or with „Immer anzeigen“', () => {
    for (const mode of [undefined, 'always'])
      expect(explainOptionsHTML(mode)).toContain(
        '<option value="icon" selected>',
      );
  });
});
