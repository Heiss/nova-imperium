// The dialog „Neue Runde“ as data (#118, #237): one row per setting, the
// members of a group with a legend in one fieldset, the fields preselected.
// The settings are built by hand, so no feature is named. The markup is
// compared with the view before in src/test/admin-reference.test.ts.
import { describe, expect, it } from 'vitest';
import {
  ROUND_SECTIONS,
  type RoundGroup,
  type RoundRules,
  type RoundSetting,
} from '../../core/round.ts';
import {
  UNIVERSE_HEADING,
  universeSections,
  UNIVERSE_SPECS,
} from '../../core/universe.ts';
import { roundDefaults } from '../../test/fixtures.ts';
import { roundDialogPage, type RoundRow, settingSections } from './admin.ts';

const make = (over: object): RoundSetting =>
  ({ key: 'roundX', label: 'X', order: 1, ...over }) as unknown as RoundSetting;

const group: RoundGroup = {
  name: 'limit',
  legend: 'Grenze',
  preview: (values) => `${values.cap} von ${values.base}`,
  confirm: (values) => `Start mit ${values.cap}`,
};
const settings: RoundSetting[] = [
  make({
    kind: 'switch',
    name: 'research',
    label: 'Forschung',
    def: true,
    note: 'Eine Notiz',
  }),
  make({ kind: 'switch', name: 'plain', label: 'Schlicht', def: false }),
  make({
    kind: 'number',
    name: 'base',
    label: 'Basis',
    min: 1,
    max: 9,
    def: 3,
    group,
  }),
  make({
    kind: 'number',
    name: 'cap',
    label: 'Grenze',
    min: 0,
    max: 9,
    def: 2,
    group,
    shownWhen: { name: 'research', value: 1 },
  }),
  make({
    kind: 'number',
    name: 'mode',
    label: 'Art',
    min: 0,
    max: 1,
    def: 0,
    choices: [
      { value: 0, label: 'Aus' },
      { value: 1, label: 'An' },
    ],
  }),
  make({
    kind: 'number',
    name: 'days',
    label: 'Tage',
    min: 1,
    max: 30,
    def: 7,
  }),
];
const round = {
  number: 4,
  research: true,
  plain: false,
  base: 5,
  cap: 6,
  mode: 1,
  days: 12,
} as unknown as RoundRules;

describe('the step of a number field (#433, 218a)', () => {
  it('is the step of the setting in „Neue Runde“, none without one', () => {
    const stepped = [
      make({
        kind: 'number',
        name: 'per',
        label: 'Je',
        min: 10,
        max: 100,
        def: 20,
        step: 10,
      }),
      make({
        kind: 'number',
        name: 'days',
        label: 'Tage',
        min: 1,
        max: 9,
        def: 2,
      }),
    ];
    const { rows } = roundDialogPage(
      { number: 1, per: 30, days: 3 } as unknown as RoundRules,
      stepped,
    );
    expect(rows.map((r) => r.kind === 'field' && r.field)).toEqual([
      {
        kind: 'number',
        id: 'round-per',
        label: 'Je',
        min: 10,
        max: 100,
        step: 10,
        value: 30,
      },
      {
        kind: 'number',
        id: 'round-days',
        label: 'Tage',
        min: 1,
        max: 9,
        value: 3,
      },
    ]);
  });
});

describe('the dialog „Neue Runde“', () => {
  it('has a row per setting, a group of members in one fieldset at the place of its first member', () => {
    const { rows } = roundDialogPage(round, settings);
    expect(rows).toEqual([
      {
        kind: 'field',
        field: {
          kind: 'switch',
          id: 'round-research',
          label: 'Forschung',
          checked: true,
          note: 'Eine Notiz',
        },
      },
      {
        kind: 'field',
        field: {
          kind: 'switch',
          id: 'round-plain',
          label: 'Schlicht',
          checked: false,
          note: null,
        },
      },
      {
        kind: 'group',
        legend: 'Grenze',
        members: [
          {
            field: {
              kind: 'number',
              id: 'round-base',
              label: 'Basis',
              min: 1,
              max: 9,
              value: 5,
            },
            lead: false,
            wrap: null,
          },
          {
            field: {
              kind: 'number',
              id: 'round-cap',
              label: 'Grenze',
              min: 0,
              max: 9,
              value: 6,
            },
            lead: true,
            wrap: { id: 'round-cap', hidden: false },
          },
        ],
        preview: { name: 'limit', text: '6 von 5' },
        confirm: { name: 'limit', text: 'Start mit 6' },
      },
      {
        kind: 'field',
        field: {
          kind: 'choice',
          id: 'round-mode',
          label: 'Art',
          choices: [
            { value: 0, label: 'Aus', selected: false },
            { value: 1, label: 'An', selected: true },
          ],
        },
      },
      {
        kind: 'field',
        field: {
          kind: 'number',
          id: 'round-days',
          label: 'Tage',
          min: 1,
          max: 30,
          value: 12,
        },
      },
    ]);
  });

  it('hides a conditional member while the other field disagrees and writes the preview from the shown values', () => {
    const off = { ...round, research: false } as unknown as RoundRules;
    const row = roundDialogPage(off, settings).rows[2];
    expect(row).toMatchObject({
      kind: 'group',
      members: [{ wrap: null }, { wrap: { id: 'round-cap', hidden: true } }],
    });
  });

  it('takes what a new round starts with where the running round has no value', () => {
    const { rows } = roundDialogPage(round, settings, { cap: 0, days: 14 });
    expect(rows[2]).toMatchObject({
      preview: { text: '0 von 5' },
      confirm: { text: 'Start mit 0' },
    });
    expect(rows[4]).toMatchObject({ field: { value: 14 } });
  });

  it('draws a group without a legend as single fields and a group without a preview without one', () => {
    const quiet: RoundGroup = { name: 'quiet', legend: 'Still' };
    const bare: RoundGroup = { name: 'bare' };
    const list = [
      make({
        kind: 'number',
        name: 'one',
        min: 0,
        max: 9,
        def: 1,
        group: quiet,
      }),
      make({
        kind: 'number',
        name: 'two',
        min: 0,
        max: 9,
        def: 1,
        group: bare,
      }),
      make({
        kind: 'number',
        name: 'three',
        min: 0,
        max: 9,
        def: 1,
        group: bare,
      }),
    ];
    const values = {
      number: 1,
      one: 1,
      two: 2,
      three: 3,
    } as unknown as RoundRules;
    const { rows } = roundDialogPage(values, list);
    expect(rows.map((r) => r.kind)).toEqual(['group', 'field', 'field']);
    expect(rows[0]).toMatchObject({ preview: null, confirm: null });
  });
});

describe('the settings under headings (#357)', () => {
  const real = (): RoundRules =>
    ({ number: 1, ...roundDefaults() }) as unknown as RoundRules;

  it('puts the rows of „Neue Runde“ under the heading of their feature, every row once and in the same order', () => {
    const page = roundDialogPage(real());
    expect(page.sections.map((x) => x.heading)).toEqual(
      ROUND_SECTIONS.map((x) => x.heading),
    );
    // Folded or not, the fields are the same as without the headings.
    const ids = (rows: readonly RoundRow[]) =>
      rows.flatMap((r) =>
        r.kind === 'field' ? [r.field.id] : r.members.map((m) => m.field.id),
      );
    expect(ids(page.sections.flatMap((x) => x.rows))).toEqual(ids(page.rows));
  });

  it('shows no legend that repeats the heading of its group; the fieldset is named by the heading (owner, 2026-11-22)', () => {
    const page = roundDialogPage(real());
    const groups = page.sections.flatMap((x) =>
      x.rows.flatMap((r) =>
        r.kind === 'group' ? [{ heading: x.heading, id: x.id, row: r }] : [],
      ),
    );
    for (const { heading, id, row } of groups) {
      expect(row.legend, heading ?? '').not.toBe(heading);
      if (row.legend === null) {
        expect(id).toMatch(/^round-heading-\d+$/);
        expect(row.labelledBy).toBe(id);
      } else expect(row.labelledBy).toBeUndefined();
    }
    const repeated = groups
      .filter((g) => g.row.legend === null)
      .map((g) => g.heading);
    expect(repeated).toEqual([
      'Aktivität',
      'Fremde Flotten erkennen',
      'Expeditionen',
      'Marktplatz',
      'Planetengrenze',
    ]);
    // A legend that says something else stays.
    expect(groups.map((g) => g.row.legend)).toContain(
      'Belohnungen für die neue Runde',
    );
    expect(groups.map((g) => g.row.legend)).toContain('Rückbau');
  });

  it('shows a setting the registry has no heading for without one', () => {
    const page = roundDialogPage(
      {
        number: 1,
        one: true,
        base: 3,
        cap: 2,
        days: 7,
      } as unknown as RoundRules,
      settings,
    );
    expect(page.sections).toEqual([
      { heading: null, id: 'round-heading-0', rows: page.rows },
    ]);
  });

  it('puts the rows of the tab „Universum“ under headings, the base values first, every row once', () => {
    const rows = UNIVERSE_SPECS.map((x) => ({ key: x.key as string }));
    const sections = settingSections(rows);
    expect(sections[0]!.heading).toBe(UNIVERSE_HEADING);
    expect(
      sections
        .flatMap((x) => x.rows)
        .map((r) => r.key)
        .sort(),
    ).toEqual(rows.map((r) => r.key).sort());
    expect(sections.map((x) => x.heading)).toEqual(
      universeSections(rows.map((r) => r.key)).map((x) => x.heading),
    );
  });
});
