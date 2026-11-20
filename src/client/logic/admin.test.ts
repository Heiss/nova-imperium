// The dialog „Neue Runde“ as data (#118, #237): one row per setting, the
// members of a group with a legend in one fieldset, the fields preselected.
// The settings are built by hand, so no feature is named. The markup is
// compared with the view before in src/test/admin-reference.test.ts.
import { describe, expect, it } from 'vitest';
import type { RoundGroup, RoundRules, RoundSetting } from '../../core/round.ts';
import { roundDialogPage } from './admin.ts';

const make = (over: object): RoundSetting =>
  ({ key: 'roundX', label: 'X', order: 1, ...over }) as unknown as RoundSetting;

const group: RoundGroup = {
  name: 'limit',
  legend: 'Grenze',
  preview: (values) => `${values.cap} von ${values.base}`,
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
    expect(rows[2]).toMatchObject({ preview: { text: '0 von 5' } });
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
    expect(rows[0]).toMatchObject({ preview: null });
  });
});
