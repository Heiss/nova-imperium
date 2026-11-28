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
  ROUND_SECTIONS,
  ROUND_SETTINGS,
  type RoundGroup,
  type RoundSection,
  type RoundRules,
  type RoundSetting,
  roundFieldId,
  MARK_LABELS,
  type RoundMark,
  roundConfirm,
  roundPreview,
  roundShown,
} from '../../core/round.ts';
import { universeSections } from '../../core/universe.ts';
import type { V } from '../views/common.ts';
import { ENDZEIT_NOTE } from './endzeit.ts';
import { fmt } from './format.ts';
import { gainWarning } from './market.ts';
import { draftOwner } from './settings-draft.ts';
import {
  type ArchivePage,
  archivePage,
  shownArchive,
} from './round-archive.ts';
import type { AdminState, GameState, Players } from './types.ts';

export const ADMIN_TABS = {
  events: 'Ereignisprotokoll',
  players: 'Spieler',
  orders: 'Aufträge',
  errors: 'Fehler',
  // [E] the name of the tab (owner, 2026-11-21, Q24).
  reports: 'Gemeldete Nachrichten',
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

/** The tag of a mark: its kind (the colour, #441) and its words. */
interface MarkTag {
  kind: RoundMark;
  label: string;
}

const markTag = (kind: RoundMark): MarkTag => ({
  kind,
  label: MARK_LABELS[kind],
});

/** One row of the settings of the universe: a field with its name, a number or a choice. */
type SettingRow = {
  key: string;
  label: string;
  /** „klassisch“ or „neu“ next to the field, with its kind for its colour (#441, 235b); none without a mark. */
  mark?: MarkTag;
} & (
  | { choices: Choice[] }
  | {
      choices: null;
      min: number;
      max: number;
      /** The step of the field; none is 1 (#433, 218a). */
      step?: number;
      value: string;
      range: string;
    }
);

/** One row of the settings of the universe (the live ones of the round included). */
function settingRow(s: GameState, x: AdminState['specs'][number]): SettingRow {
  const value = s.cfg[x.key];
  const row = {
    key: x.key,
    label: x.label,
    ...(x.mark ? { mark: markTag(x.mark) } : {}),
  };
  // A setting of the round with named choices is a selection (#283).
  if (x.choices)
    return { ...row, choices: choicesOf(x.choices, Number(value)) };
  const hint = x.size ? ' – nur vergrößern, solange dort Planeten liegen' : '';
  return {
    ...row,
    choices: null,
    min: x.min,
    max: x.max,
    ...(x.step ? { step: x.step } : {}),
    value: String(value),
    range: `${fmt(x.min)} bis ${fmt(x.max)}${hint}`,
  };
}

/**
 * Rows under the heading of their feature (#357); a null heading is a part
 * of the page without one (a setting the registry has no heading for).
 */
export interface Section<R> {
  heading: string | null;
  /** The id of the heading, where a fieldset of the group is named by it. */
  id?: string;
  rows: R[];
}

/**
 * The rows of the tab „Universum“ under headings (#357): the base values of
 * the universe first, then each live setting of the round under the heading
 * of its feature, in the order of „Neue Runde“.
 */
export function settingSections<R extends { key: string }>(
  rows: readonly R[],
): Section<R>[] {
  const byKey = new Map(rows.map((r) => [r.key, r]));
  return universeSections(rows.map((r) => r.key)).map((x) => ({
    heading: x.heading,
    rows: x.keys.map((k) => byKey.get(k)!),
  }));
}

/** What the page „Admin“ shows to an admin. */
export interface AdminPage {
  tabs: { key: AdminTab; label: string; panel: string }[];
  settings: {
    /** The account and round of the drafts: the rows are drawn anew for another (review of #347). */
    owner: string;
    rows: SettingRow[];
    /** The same rows under headings (#357). */
    sections: Section<SettingRow>[];
    warning: string | null;
  };
  /** The link of the last invitation, shown once. */
  link: string | null;
  /** The note of a used-up Endzeit; null while the button is there. */
  endzeitDone: string | null;
  archive: ArchivePage;
  /** The players, by id, for the names in the diagnostics. */
  players: Players;
  /** The cap of the moon chance in the round: „Mond anlegen“ takes up to it (#433, 210a). */
  moonCap: number;
}

const settingsOf = (
  rows: SettingRow[],
  warning: string | null,
  owner: string,
) => ({
  owner,
  rows,
  sections: settingSections(rows),
  warning,
});

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
    settings: settingsOf(
      a.specs.map((x) => settingRow(v.s, x)),
      gainWarning(v.s.cfg),
      draftOwner(v.s),
    ),
    link: v.ui.lastLink || null,
    endzeitDone: a.endzeit.done ? ENDZEIT_NOTE.done : null,
    archive: archivePage(shownArchive(v.s), true),
    players: v.s.players,
    moonCap: v.s.round.moonChanceMax,
  };
}

/** The field of one setting of the round (#283), preselected with its value. */
export type RoundField = {
  id: string;
  label: string;
  /** The stored key of the setting: its explanation (#358). */
  key: string;
} & (
  | { kind: 'switch'; checked: boolean; note: string | null }
  | { kind: 'choice'; choices: Choice[] }
  | {
      kind: 'number';
      min: number;
      max: number;
      /** The step of the field; none is 1 (#433, 218a). */
      step?: number;
      value: number;
    }
) & {
    /** „klassisch“ or „neu“ next to the field, with its kind for its colour (#441, 235b); none without a mark. */
    mark?: MarkTag;
  };

function roundField(s: RoundSetting, value: number | boolean): RoundField {
  const field = {
    id: roundFieldId(s),
    label: s.label,
    key: s.key,
    ...(s.mark ? { mark: markTag(s.mark) } : {}),
  };
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
    ...(s.step ? { step: s.step } : {}),
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
      /**
       * The legend of the fieldset; null where it would repeat the heading of
       * its group (owner, 2026-11-22), and the fieldset is then named by the
       * heading (`labelledBy`, the id of the heading).
       */
      legend: string | null;
      labelledBy?: string;
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
export function roundDialogPage(
  round: RoundRules,
  settings: readonly RoundSetting[] = ROUND_SETTINGS,
  fresh: Readonly<Record<string, number>> = {},
  sections: readonly RoundSection[] = ROUND_SECTIONS,
): { rows: RoundRow[]; sections: Section<RoundRow>[] } {
  const rows = roundRows(round, settings, fresh);
  return { rows, sections: rowSections(rows, settings, sections) };
}

/** The ids of the fields of a row of the dialog. */
const idsOf = (row: RoundRow): string[] =>
  row.kind === 'field' ? [row.field.id] : row.members.map((m) => m.field.id);

/**
 * The rows of the dialog under the heading of their feature (#357): the rows
 * in their order, a run of rows of one feature under its heading.
 */
function rowSections(
  rows: readonly RoundRow[],
  settings: readonly RoundSetting[],
  sections: readonly RoundSection[],
): Section<RoundRow>[] {
  const heading = new Map(
    sections.flatMap((x) => x.settings.map((s) => [s.name, x.heading])),
  );
  const byId = new Map(
    settings.map((s) => [roundFieldId(s), heading.get(s.name) ?? null]),
  );
  const out: Section<RoundRow>[] = [];
  for (const row of rows) {
    const h = byId.get(idsOf(row)[0]!) ?? null;
    let last = out.at(-1);
    if (!last || last.heading !== h) {
      last = { heading: h, id: `round-heading-${out.length}`, rows: [] };
      out.push(last);
    }
    last.rows.push(UNDER_HEADING[row.kind](row as never, h, last.id!));
  }
  return out;
}

type Row<K extends RoundRow['kind']> = Extract<RoundRow, { kind: K }>;

/**
 * A row under its heading, by its kind: a legend that repeats the heading of
 * its group goes, and the heading names the fieldset instead (owner,
 * 2026-11-22); a field stays as it is.
 */
const UNDER_HEADING: {
  [K in RoundRow['kind']]: (
    row: Row<K>,
    heading: string | null,
    id: string,
  ) => RoundRow;
} = {
  field: (row) => row,
  group: (row, heading, id) =>
    row.legend === heading ? { ...row, legend: null, labelledBy: id } : row,
};

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
