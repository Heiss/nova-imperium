// The presets of the round settings (#441): the row „Voreinstellung“ in the dialog
// „Neue Runde“, its question when a preset was clicked, and the marks of the
// settings next to their fields.
import { render } from 'svelte/server';
import { afterEach, describe, expect, it } from 'vitest';
import type { RoundRules, RoundSetting } from '../../core/round.ts';
import { roundDefaults } from '../../test/fixtures.ts';
import { stripComments } from '../../test/markup.ts';
import { roundDialogView } from '../../test/admin-view.ts';
import {
  askPreset,
  closePreset,
  presetAsk,
  presetOf,
  presetQuestion,
} from '../logic/presets.svelte.ts';
import PresetRow from './PresetRow.svelte';

const QUESTION =
  'Sollen die Einstellungen auf die Voreinstellung „Standard“ umgestellt werden? Achtung: Erst „Speichern“ unten übernimmt die Änderung.';

const row = (place: 'round' | 'universe') =>
  stripComments(render(PresetRow, { props: { place } }).body);

afterEach(() => closePreset());

describe('the row „Voreinstellung“ (#441)', () => {
  it('offers „Standard“ in both places, without a question', () => {
    for (const place of ['round', 'universe'] as const) {
      const html = row(place);
      expect(html).toContain('Voreinstellung');
      expect(html).toContain(
        `data-act="askPreset" data-place="${place}" data-id="standard">Standard</button>`,
      );
      expect(html).not.toContain('Umstellen');
    }
  });

  it('asks in the place that was clicked, with the owner’s words', () => {
    askPreset('universe', 'standard');
    expect(presetAsk).toEqual({ place: 'universe', id: 'standard' });
    const html = row('universe');
    expect(html).toContain(QUESTION);
    expect(html).toContain(
      'data-act="applyPreset" data-place="universe" data-id="standard">Umstellen</button>',
    );
    expect(html).toContain('data-act="cancelPreset">Abbrechen</button>');
    // The other place shows no question.
    expect(row('round')).not.toContain('Umstellen');
    closePreset();
    expect(presetAsk).toEqual({ place: null, id: null });
    expect(row('universe')).not.toContain('Umstellen');
  });

  it('words the question with the name of the preset', () => {
    expect(presetQuestion('Standard')).toBe(QUESTION);
    expect(presetOf('standard')).toBe('standard');
    expect(presetOf('nope')).toBeNull();
    expect(presetOf(undefined)).toBeNull();
  });

  it('stands in the dialog „Neue Runde“', () => {
    const html = roundDialogView({
      number: 1,
      ...roundDefaults(),
    } as RoundRules);
    expect(html).toContain('data-presets="round"');
  });
});

describe('the mark of a setting (#441, 235b)', () => {
  const make = (over: object): RoundSetting =>
    ({
      key: 'roundX',
      label: 'X',
      order: 1,
      ...over,
    }) as unknown as RoundSetting;

  it('stands next to a field with a mark, and nowhere without one', () => {
    const settings = [
      make({
        kind: 'number',
        name: 'a',
        key: 'roundA',
        label: 'Alt',
        min: 0,
        max: 9,
        def: 1,
        mark: 'classic',
      }),
      make({
        kind: 'switch',
        name: 'b',
        key: 'roundB',
        label: 'Neu',
        def: true,
        refusal: 'x',
        mark: 'new',
      }),
      make({
        kind: 'number',
        name: 'c',
        key: 'roundC',
        label: 'Ohne',
        min: 0,
        max: 9,
        def: 1,
      }),
    ];
    const html = roundDialogView(
      { number: 1, a: 1, b: true, c: 1 } as unknown as RoundRules,
      settings,
    );
    // A coloured tag by its kind (owner, 2026-11-28).
    expect(html).toContain(
      'Alt</label><span class="mark mark-classic">klassisch</span>',
    );
    expect(html).toContain('<span class="mark mark-new">neu</span>');
    expect(html.match(/class="mark /g)).toHaveLength(2);
  });
});
