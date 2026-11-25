// The rules that hold for every box of „Optionen“ (#378). The test names no
// box and no count: a box registers itself in its own module of this folder
// (`optionBoxes`), and the page as a whole is tested in
// src/client/views/options.test.ts and src/test/options-reference.test.ts.
// The assembly of the boxes is tested here too; the script that lists them in
// src/test/gen-option-boxes.test.ts.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { roundDefaults } from '../../../test/fixtures.ts';
import { levelView } from '../../../test/level-view.ts';
import { OPTION_SECTIONS } from '../../logic/phone-options.ts';
import type { GameState } from '../../logic/types.ts';
import type { V } from '../common.ts';
import { assembleBoxes } from './assemble.ts';
import { BOXES, optionsPage } from './boxes.ts';
import { OPTION_BOXES } from './boxes.gen.ts';

const declared = OPTION_BOXES.flatMap(([name, list]) =>
  list.map((box) => [name, box] as const),
);
const KEY = /^[a-z][a-zA-Z0-9]*$/;
const MEMBERS = ['key', 'order', 'section', 'component', 'data', 'shown'];

/** A view state with every part of the page filled. */
function view(): V {
  const v = levelView({}, {}, [], { probes: 2, pushOff: [] });
  v.s.round = roundDefaults() as unknown as GameState['round'];
  v.s.homePlanet = 'p';
  v.ui = {
    animations: true,
    view: 'help',
    webPush: true,
  } as unknown as V['ui'];
  return v;
}

describe('the boxes of „Optionen“ (#378)', () => {
  it('are declared by modules of src/client/views/options, each named once', () => {
    const names = OPTION_BOXES.map(([name]) => name);
    expect(new Set(names).size).toBe(names.length);
    for (const [name, list] of OPTION_BOXES) {
      expect(name).toMatch(/^[a-z][a-z0-9-]*$/);
      expect(list.length, name).toBeGreaterThan(0);
    }
  });

  it('each have a plain key, a whole order number, a section of the switch, a component and only the known members', () => {
    const sections = OPTION_SECTIONS.map((s) => s.key);
    for (const [name, box] of declared) {
      const where = `${name}: ${box.key}`;
      expect(box.key, where).toMatch(KEY);
      expect(Number.isInteger(box.order), where).toBe(true);
      expect(sections, where).toContain(box.section);
      expect(typeof box.component, where).toBe('function');
      for (const member of Object.keys(box))
        expect(MEMBERS, `${where}: ${member}`).toContain(member);
    }
  });

  it('define no key and no order number twice, and stand in the order of their numbers', () => {
    const keys = declared.map(([, box]) => box.key);
    const orders = declared.map(([, box]) => box.order);
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(orders).size).toBe(orders.length);
    expect(BOXES).toHaveLength(declared.length);
    const shown = BOXES.map((box) => box.order);
    expect(shown).toEqual([...orders].sort((a, b) => a - b));
  });

  it('each give the page its own fields, so the page keeps the part of every box', () => {
    const v = view();
    const owner = new Map<string, string>();
    for (const [, box] of declared)
      for (const field of Object.keys(box.data?.(v) ?? {})) {
        expect(owner.get(field), `${box.key}: ${field}`).toBeUndefined();
        owner.set(field, box.key);
      }
    expect(Object.keys(optionsPage(v)).sort()).toEqual(
      [...owner.keys()].sort(),
    );
  });

  it('are named by neither Options.svelte nor logic/options.ts', () => {
    const page = readFileSync('src/client/views/Options.svelte', 'utf8');
    expect(page).not.toMatch(/<Box\b|title=|data-act=|\bid=/);
    for (const file of [
      'src/client/views/Options.svelte',
      'src/client/logic/options.ts',
    ]) {
      const source = readFileSync(file, 'utf8');
      for (const [name, box] of declared) {
        expect(source, `${file}: ${box.key}`).not.toContain(`'${box.key}'`);
        expect(source, `${file}: ${name}`).not.toContain(`options/${name}.ts`);
      }
    }
  });
});

describe('the assembly of the boxes (#378)', () => {
  const box = (key: string, order: number) => ({ key, order });

  it('puts the boxes of every module in the order of their numbers', () => {
    const boxes = assembleBoxes([
      ['a', [box('last', 30), box('first', 10)]],
      ['b', [box('mid', 20)]],
    ]);
    expect(boxes.map((b) => b.key)).toEqual(['first', 'mid', 'last']);
  });

  it('throws when two modules define one key, naming both files', () => {
    expect(() =>
      assembleBoxes([
        ['a', [box('x', 10)]],
        ['b', [box('x', 20)]],
      ]),
    ).toThrow(
      'option box "x" is defined in src/client/views/options/a.ts and in src/client/views/options/b.ts.',
    );
  });

  it('throws when an order number exists twice, naming both files', () => {
    expect(() =>
      assembleBoxes([
        ['a', [box('x', 10)]],
        ['b', [box('y', 10)]],
      ]),
    ).toThrow(
      'option box number "10" is defined in src/client/views/options/a.ts and in src/client/views/options/b.ts.',
    );
  });
});
