// What the page „Admin“ and the dialogs of the admin show (#118, bundle 7;
// okf/architecture/patterns.md, section 9), without the HTML of their parts:
// the tabs, the settings of the universe, the invitation, the Endzeit, the
// archive of rounds, and the dialogs „Neue Runde“ and „Endzeit einläuten“.
// The components Admin, RoundDialog and EndzeitDialog render it. The ids and
// `data-act`s belong to features/ (admin.ts, round.ts, round-archive.ts) and
// to the panel of views/admin-panel.ts; the rules of what a field shows are
// made here, not in the components.
import {
  GIFT_MINUTES,
  GIFT_RESOURCES,
  GIFT_SHIPS_EACH,
} from '../../core/endzeit.ts';
import {
  ROUND_SETTINGS,
  type RoundGroup,
  type RoundRules,
  type RoundSetting,
  roundFieldId,
  roundConfirm,
  roundPreview,
  roundShown,
} from '../../core/round.ts';
import type { V } from '../views/common.ts';
import { ENDZEIT_NOTE } from './endzeit.ts';
import { fmt } from './format.ts';
import { gainWarning } from './market.ts';
import {
  type ArchivePage,
  archivePage,
  shownArchive,
} from './round-archive.ts';
import type { AdminState, GameState } from './types.ts';

export const ADMIN_TABS = {
  events: 'Ereignisprotokoll',
  players: 'Spieler',
  orders: 'Aufträge',
  errors: 'Fehler',
  invitations: 'Einladungen',
  universe: 'Universum',
  announce: 'Servernachricht',
} as const;

export type AdminTab = keyof typeof ADMIN_TABS;

/** The tabs that share the panel „Diagnose und Protokoll“. */
export const diagnosticTab = (
  tab: string,
): tab is 'events' | 'players' | 'orders' =>
  tab === 'events' || tab === 'players' || tab === 'orders';

/** One value of a setting with named choices, the current one marked. */
interface Choice {
  value: number;
  label: string;
  selected: boolean;
}

/** The options of a setting with named choices, the current one selected (#283). */
const choicesOf = (
  choices: readonly { value: number; label: string }[],
  current: number,
): Choice[] => choices.map((c) => ({ ...c, selected: c.value === current }));

/** One row of the settings of the universe: a field with its name, a number or a choice. */
type SettingRow = { key: string; label: string } & (
  | { choices: Choice[] }
  | { choices: null; min: number; max: number; value: string; range: string }
);

/** One row of the settings of the universe (the live ones of the round included). */
function settingRow(s: GameState, x: AdminState['specs'][number]): SettingRow {
  const value = s.cfg[x.key];
  const row = { key: x.key, label: x.label };
  // A setting of the round with named choices is a selection (#283).
  if (x.choices)
    return { ...row, choices: choicesOf(x.choices, Number(value)) };
  const hint = x.size ? ' – nur vergrößern, solange dort Planeten liegen' : '';
  return {
    ...row,
    choices: null,
    min: x.min,
    max: x.max,
    value: String(value),
    range: `${fmt(x.min)} bis ${fmt(x.max)}${hint}`,
  };
}

/** What the page „Admin“ shows to an admin. */
export interface AdminPage {
  tabs: { key: AdminTab; label: string; panel: string }[];
  settings: { rows: SettingRow[]; warning: string | null };
  /** The link of the last invitation, shown once. */
  link: string | null;
  /** The note of a used-up Endzeit; null while the button is there. */
  endzeitDone: string | null;
  archive: ArchivePage;
}

/** The page at the view state `v`; null for a state without the admin's data. */
export function adminPage(v: V): AdminPage | null {
  const a = v.s.admin;
  if (!a) return null;
  return {
    tabs: (Object.entries(ADMIN_TABS) as [AdminTab, string][]).map(
      ([key, label]) => ({
        key,
        label,
        panel: diagnosticTab(key) ? 'diagnostics' : key,
      }),
    ),
    settings: {
      rows: a.specs.map((x) => settingRow(v.s, x)),
      warning: gainWarning(v.s.cfg),
    },
    link: v.ui.lastLink || null,
    endzeitDone: a.endzeit.done ? ENDZEIT_NOTE.done : null,
    archive: archivePage(shownArchive(v.s), true),
  };
}

/** The field of one setting of the round (#283), preselected with its value. */
export type RoundField = { id: string; label: string } & (
  | { kind: 'switch'; checked: boolean; note: string | null }
  | { kind: 'choice'; choices: Choice[] }
  | { kind: 'number'; min: number; max: number; value: number }
);

function roundField(s: RoundSetting, value: number | boolean): RoundField {
  const field = { id: roundFieldId(s), label: s.label };
  if (s.kind === 'switch')
    return { ...field, kind: 'switch', checked: !!value, note: s.note ?? null };
  if (s.choices)
    return {
      ...field,
      kind: 'choice',
      choices: choicesOf(s.choices, Number(value)),
    };
  return {
    ...field,
    kind: 'number',
    min: s.min,
    max: s.max,
    value: Number(value),
  };
}

/**
 * A member of a fieldset. One that is shown only while another field has a
 * value (`shownWhen`, #237) is wrapped, so the browser hides it together with
 * its line break when the other field changes (features/round.ts).
 */
interface RoundMember {
  field: RoundField;
  /** Whether a line break stands before the field: every member but the first. */
  lead: boolean;
  /** The wrapper of a conditional field, hidden while the other field disagrees. */
  wrap: { id: string; hidden: boolean } | null;
}

/** One entry of the dialog: a setting as its own paragraph, or a group in a fieldset. */
export type RoundRow =
  | { kind: 'field'; field: RoundField }
  | {
      kind: 'group';
      legend: string;
      members: RoundMember[];
      /** The preview line of the group, written again by the browser whenever a field changes. */
      preview: { name: string; text: string } | null;
      /** The confirmation line of the group above the button, written again by the browser whenever a field changes (#237). */
      confirm: { name: string; text: string } | null;
    };

type Values = Readonly<Record<string, number | boolean>>;

function member(s: RoundSetting, index: number, values: Values): RoundMember {
  return {
    field: roundField(s, values[s.name]!),
    lead: index > 0,
    wrap: s.shownWhen
      ? { id: roundFieldId(s), hidden: !roundShown(s, values) }
      : null,
  };
}

const previewOf = (
  group: RoundGroup,
  values: Values,
  settings: readonly RoundSetting[],
): { name: string; text: string } | null =>
  group.preview
    ? { name: group.name, text: roundPreview(group, values, settings) }
    : null;

const confirmOf = (
  group: RoundGroup,
  values: Values,
  settings: readonly RoundSetting[],
): { name: string; text: string } | null =>
  group.confirm
    ? { name: group.name, text: roundConfirm(group, values, settings) }
    : null;

/**
 * The rows of the dialog „Neue Runde“, one per setting of the registry
 * (#283); the members of a group with a legend in one fieldset.
 */
function roundRows(
  round: RoundRules,
  settings: readonly RoundSetting[],
  fresh: Readonly<Record<string, number>>,
): RoundRow[] {
  const values = { ...round, ...fresh } as unknown as Record<
    string,
    number | boolean
  >;
  const rows: RoundRow[] = [];
  const drawn = new Set<RoundGroup>();
  for (const s of settings) {
    const group = s.group;
    if (!group?.legend)
      rows.push({ kind: 'field', field: roundField(s, values[s.name]!) });
    else if (!drawn.has(group)) {
      drawn.add(group);
      rows.push({
        kind: 'group',
        legend: group.legend,
        members: settings
          .filter((x) => x.group === group)
          .map((x, k) => member(x, k, values)),
        preview: previewOf(group, values, settings),
        confirm: confirmOf(group, values, settings),
      });
    }
  }
  return rows;
}

/**
 * The dialog „Neue Runde“, preselected with the values of the running round;
 * where it has none of its own, with what a new round starts with (`fresh`,
 * #237).
 */
export const roundDialogPage = (
  round: RoundRules,
  settings: readonly RoundSetting[] = ROUND_SETTINGS,
  fresh: Readonly<Record<string, number>> = {},
): { rows: RoundRow[] } => ({ rows: roundRows(round, settings, fresh) });

/** What the dialog „Endzeit einläuten“ shows (#161): the numbers of the gift and the flight time. */
export const endzeitDialogPage = (minutes: number) => ({
  ships: fmt(GIFT_SHIPS_EACH),
  resources: fmt(GIFT_RESOURCES),
  minutes,
  min: GIFT_MINUTES.min,
  max: GIFT_MINUTES.max,
  range: `${fmt(GIFT_MINUTES.min)} bis ${fmt(GIFT_MINUTES.max)} (72 h), in Echtzeit`,
});

export type EndzeitDialogPage = ReturnType<typeof endzeitDialogPage>;
export type RoundDialogPage = ReturnType<typeof roundDialogPage>;
