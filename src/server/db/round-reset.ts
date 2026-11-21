// What a new round empties and what it keeps (okf/architecture/patterns.md,
// section 15; #317). The module that owns a table says so next to its code:
// it exports under the fixed name `roundReset` a list of steps. The list of
// all modules is generated (scripts/gen-features.ts, src/server/round-reset.gen.ts),
// so `newRound` in game/admin.ts names no table, and `clearRound` runs the
// steps of every module in the order of their numbers.
import type { RoundRules } from '../../core/round.ts';
import { claim } from '../claim.ts';
import type { Db } from './database.ts';

/**
 * A table a new round empties: `DELETE FROM <table>` for each of `clears`, in
 * this order, at the place of `order` among all steps (a number is used once;
 * take the next free ten above the highest). A table that a parent table
 * deletes by `ON DELETE CASCADE` needs no entry: name the parent. The order
 * matters where one table refers to another without a cascade: the referring
 * table first.
 */
interface Clear {
  order: number;
  clears: readonly string[];
  /** Only in the rounds for which this holds; the table is kept in the others. */
  when?: (rules: RoundRules) => boolean;
}

/**
 * Tables a new round leaves as they are, on purpose (the accounts, the
 * settings, the round archive, ...). With `when` only in the rounds for which
 * it holds: in the others another module empties them, or their parent does.
 */
interface Keep {
  keeps: readonly string[];
  when?: (rules: RoundRules) => boolean;
}

/** One step of what a module exports as `roundReset`. */
export type RoundReset = Clear | Keep;

/** The modules as the generated list gives them: `[path in src/server, roundReset]`. */
export type ListedResets = readonly (readonly [
  string,
  readonly RoundReset[],
])[];

const TABLE = /^[a-z][a-z0-9_]*$/;

const fileOf = (name: string): string => `src/server/${name}.ts`;

const isClear = (step: RoundReset): step is Clear => 'clears' in step;

/** Every step of every module, with the file it is in. */
const stepsOf = (
  modules: ListedResets,
): readonly (readonly [string, RoundReset])[] =>
  modules.flatMap(([name, list]) =>
    list.map((step) => [fileOf(name), step] as const),
  );

/** Whether a step holds in a round with these `rules`. */
const holds = (step: RoundReset, rules: RoundRules): boolean =>
  step.when?.(rules) ?? true;

/** The steps that empty tables of all `modules`, by ascending order, each number and each table once. */
export function clearsOf(modules: ListedResets): readonly Clear[] {
  const orders = new Map<string, string>();
  const tables = new Map<string, string>();
  const steps: Clear[] = [];
  for (const [file, step] of stepsOf(modules)) {
    if (!isClear(step)) continue;
    claim('round reset order', orders, String(step.order), file);
    for (const table of step.clears) {
      if (!TABLE.test(table))
        throw new Error(`${file}: "${table}" is not a table name.`);
      claim('round reset table', tables, table, file);
    }
    steps.push(step);
  }
  return steps.sort((a, b) => a.order - b.order);
}

/** The tables the steps of all `modules` keep in a round with these `rules`, each once. */
export function keptBy(
  modules: ListedResets,
  rules: RoundRules,
): readonly string[] {
  const owners = new Map<string, string>();
  for (const [file, step] of stepsOf(modules))
    if (!isClear(step) && holds(step, rules))
      for (const table of step.keeps) claim('kept table', owners, table, file);
  return [...owners.keys()].sort();
}

/** Empties the tables of every step that holds in a round with these `rules`, in the order of the steps. */
export function clearRound(
  db: Db,
  rules: RoundRules,
  modules: ListedResets,
): void {
  for (const step of clearsOf(modules))
    if (holds(step, rules))
      for (const table of step.clears) db.prepare(`DELETE FROM ${table}`).run();
}
