// The groups of settings under headings in the admin panel (#357), in „Neue
// Runde“ and in the tab „Universum“: which groups the admin folded (every
// group is open at the start) and which fields hold a value that failed its
// check, so their group unfolds and shows it. The state lives in this module,
// as the page „Admin“ is mounted anew on every render; a folded group keeps
// its fields in the page, so saving sends every value as before.

import {
  ROUND_SECTIONS,
  type RoundRules,
  roundFieldId,
  roundRefused,
} from '../../core/round.ts';
import {
  universeErrors,
  universeSections,
  UNIVERSE_SPECS,
} from '../../core/universe.ts';

/** The place of a group: the dialog „Neue Runde“ or the tab „Universum“. */
export type GroupPlace = 'round' | 'universe';

const groups = $state({
  folded: {} as Record<string, boolean>,
  invalid: [] as string[],
});

const keyOf = (place: GroupPlace, heading: string): string =>
  `${place}:${heading}`;

/** Whether the group is unfolded: every group is at the start. */
export const isOpen = (place: GroupPlace, heading: string): boolean =>
  !groups.folded[keyOf(place, heading)];

/** The admin folded or unfolded the group. */
export function setOpen(
  place: GroupPlace,
  heading: string,
  open: boolean,
): void {
  groups.folded[keyOf(place, heading)] = !open;
}

/**
 * The fields of `place` whose value failed its check, by id with the heading
 * of their group: each group unfolds, and the fields are marked until the
 * next check. An empty list clears the marks.
 */
export function showInvalid(
  place: GroupPlace,
  wrong: readonly { heading: string | null; id: string }[],
): void {
  for (const { heading } of wrong) if (heading) setOpen(place, heading, true);
  groups.invalid = wrong.map((w) => w.id);
}

/** Whether the field holds a value that failed its last check. */
export const isInvalid = (id: string): boolean => groups.invalid.includes(id);

/** Every group open again, no field marked (the tests). */
export function forgetGroups(): void {
  groups.folded = {};
  groups.invalid = [];
}

/** A field whose value fails its check, with the heading of its group. */
export interface Wrong {
  heading: string | null;
  id: string;
}

/**
 * The fields of „Neue Runde“ whose value the server refuses, by the same
 * check (`roundRefused`): the first refused entry with the other refused
 * members of its group.
 */
export function roundWrong(
  current: RoundRules,
  data: Record<string, unknown>,
): Wrong[] {
  const heading = new Map(
    ROUND_SECTIONS.flatMap((x) => x.settings.map((s) => [s.name, x.heading])),
  );
  return roundRefused(
    current as unknown as Record<string, number | boolean>,
    data,
  ).map((s) => ({ heading: heading.get(s.name) ?? null, id: roundFieldId(s) }));
}

/** No coordinate in use: the check of a size against the planets is the server's. */
const NONE_USED = { g: 0, s: 0, p: 0 };

/**
 * The fields of the tab „Universum“ whose value the server refuses, by the
 * same check (`universeErrors`): a value outside its range or a rule between
 * settings. That a size lies below a planet the server alone can tell.
 */
export function universeWrong(input: Record<string, string>): Wrong[] {
  const keys = Object.keys(input);
  const specs = UNIVERSE_SPECS.filter((x) => keys.includes(x.key));
  const heading = new Map(
    universeSections(keys).flatMap((x) => x.keys.map((k) => [k, x.heading])),
  );
  return universeErrors(input, NONE_USED, specs).map((e) => ({
    heading: heading.get(e.spec.key) ?? null,
    id: `set_${e.spec.key}`,
  }));
}
