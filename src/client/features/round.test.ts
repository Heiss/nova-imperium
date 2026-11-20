// The browser side of the dialog „Neue Runde“ (#283, #237): the fields that
// show only with another one and the preview line follow the fields.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { roundFieldId, ROUND_SETTINGS } from '../../core/round.ts';
import { syncRoundDialog } from './round.ts';

interface Node {
  value?: string;
  checked?: boolean;
  hidden?: boolean;
  textContent?: string;
}

const nodes: Record<string, Node> = {};
const fieldOf = (name: string): string =>
  roundFieldId(ROUND_SETTINGS.find((s) => s.name === name)!);

/** A dialog with every field at its default, except what the test sets. */
function dialog(over: Record<string, string> = {}): void {
  for (const k of Object.keys(nodes)) delete nodes[k];
  for (const s of ROUND_SETTINGS) {
    const id = roundFieldId(s);
    nodes[`#${id}`] =
      s.kind === 'switch'
        ? { checked: s.def }
        : { value: over[s.name] ?? String(s.def) };
    nodes[`[data-round-field="${id}"]`] = { hidden: false };
  }
  nodes['#round-preview-colonies'] = { textContent: '' };
  nodes['#round-confirm-colonies'] = { textContent: '' };
}

beforeEach(() => {
  vi.stubGlobal('document', {
    querySelector: (sel: string) => nodes[sel] ?? null,
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the dialog follows its fields (#237)', () => {
  const hidden = (name: string): boolean | undefined =>
    nodes[`[data-round-field="${fieldOf(name)}"]`]!.hidden;
  const preview = (): string => nodes['#round-preview-colonies']!.textContent!;

  it('hides the fields of the research while it is off and shows them when it is switched on', () => {
    dialog({ colonyResearch: '0', colonyBase: '6' });
    syncRoundDialog();
    expect(hidden('colonyPerLevel')).toBe(true);
    expect(hidden('colonyMaxLevel')).toBe(true);
    nodes[`#${fieldOf('colonyResearch')}`]!.value = '1';
    syncRoundDialog();
    expect(hidden('colonyPerLevel')).toBe(false);
    expect(hidden('colonyMaxLevel')).toBe(false);
  });

  it('writes the preview again at every change, and keeps the values of hidden fields', () => {
    dialog({
      colonyResearch: '1',
      colonyBase: '6',
      colonyPerLevel: '2',
      colonyMaxLevel: '4',
    });
    syncRoundDialog();
    expect(preview()).toBe(
      'Vorschau: Ohne Forschung: 6 Planeten · Stufe 1: 8 · Stufe 2: 10 · Stufe 3: 12 · Stufe 4: 14.',
    );
    nodes[`#${fieldOf('colonyResearch')}`]!.value = '0';
    syncRoundDialog();
    expect(preview()).toBe('Vorschau: 6 Planeten');
    expect(nodes[`#${fieldOf('colonyPerLevel')}`]!.value).toBe('2');
    nodes[`#${fieldOf('colonyBase')}`]!.value = '0';
    syncRoundDialog();
    expect(preview()).toBe('Vorschau: Unbegrenzte Planetenanzahl');
    nodes[`#${fieldOf('colonyBase')}`]!.value = '';
    syncRoundDialog();
    expect(preview()).toBe('');
  });

  it('repeats the exact settings in the confirmation and writes it again at every change (#237)', () => {
    const confirm = (): string => nodes['#round-confirm-colonies']!.textContent!;
    dialog({
      colonyResearch: '1',
      colonyBase: '6',
      colonyPerLevel: '2',
      colonyMaxLevel: '4',
    });
    syncRoundDialog();
    expect(confirm()).toBe(
      'Die neue Runde startet mit: Maximale Planeten ohne Forschung: 6 · Kolonieforschung: aktiviert · Zusätzliche Planeten je Forschungsstufe: 2 · Maximale Forschungsstufe: 4.',
    );
    nodes[`#${fieldOf('colonyPerLevel')}`]!.value = '3';
    syncRoundDialog();
    expect(confirm()).toContain('je Forschungsstufe: 3 ·');
    nodes[`#${fieldOf('colonyResearch')}`]!.value = '0';
    syncRoundDialog();
    expect(confirm()).toBe(
      'Die neue Runde startet mit: Maximale Planeten ohne Forschung: 6 · Kolonieforschung: nicht aktiviert.',
    );
  });
});
