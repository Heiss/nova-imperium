// The marks of mutants that no test can kill (owner, 2026-11-21, #338). The
// building agent may mark such a mutant with Stryker's comment
//     <two slashes> Stryker disable next-line <Mutator>: <reason>
// only in a sensitive file (the list "exact" of mutation-standard.json), each
// mark with a reason that says why no test can tell the mutation, and every
// mark is listed in the report of the pull request. This script finds every
// comment of Stryker in the files Stryker mutates and refuses one in another
// form (a whole file, "all", "restore"), one without a reason and one outside
// the list; src/test/mutation-marks.test.ts runs it over the tree.
//
//   node scripts/mutation-marks.ts
//        prints every mark ("<file>:<line> <mutators>: <reason>") for the
//        report and the problems; exit code 1 when there is one
import { readFileSync } from 'node:fs';
import { runCli } from './cli.ts';
import { readMutate } from './mutation-changes.ts';
import { parseStandard, STANDARD } from './mutation-gate.ts';
import { FLOORS_FILE } from './mutation-floorfile.ts';
import { mutatedFiles } from './mutation-shards.ts';

/** A Stryker comment of a mutated file. */
export interface Mark {
  file: string;
  line: number;
  /** The text of the comment after "Stryker". */
  text: string;
}

/** A directive of Stryker in a comment (disable or restore); other text does not count. */
const COMMENT =
  /(?:^|\s)(?:\/\/|\/\*+|\*)\s*Stryker\s+((?:disable|restore)\b.*?)\s*(?:\*\/)?$/i;

/** The one allowed form: one line, named mutators, a reason. */
const ALLOWED =
  /^disable next-line ([A-Z][A-Za-z]*(?:,\s*[A-Z][A-Za-z]*)*): (\S.*)$/;

/** Every Stryker comment in the text of <file>, with its line (from 1). */
export function marksIn(file: string, text: string): Mark[] {
  return text.split('\n').flatMap((content, index) => {
    const found = COMMENT.exec(content);
    return found ? [{ file, line: index + 1, text: found[1]! }] : [];
  });
}

/** One message per mark that is not allowed, by its place. */
export function markProblems(
  marks: readonly Mark[],
  exact: readonly string[],
): string[] {
  return marks.flatMap((m) => {
    const at = `${m.file}:${m.line}`;
    if (!exact.includes(m.file))
      return [
        `${at}: a mark outside the sensitive files of mutation-standard.json ("exact")`,
      ];
    const allowed = ALLOWED.exec(m.text);
    if (!allowed)
      return [
        `${at}: "Stryker ${m.text}" is not "Stryker disable next-line <Mutator>: <reason>"`,
      ];
    return allowed[2]!.trim().length < 10
      ? [`${at}: the reason "${allowed[2]}" says nothing`]
      : [];
  });
}

/** What the command reads; the defaults are the real files. */
export interface Deps {
  files: () => string[];
  read: (file: string) => string;
  log: (line: string) => void;
}

const real: Deps = {
  files: () => mutatedFiles(readMutate()),
  read: (file) => readFileSync(file, 'utf8'),
  log: (line) => console.log(line),
};

/** Lists the marks and the problems; the exit code. */
export function main(deps: Partial<Deps> = {}): number {
  const d = { ...real, ...deps };
  const { exact } = parseStandard(d.read(STANDARD), d.read(FLOORS_FILE));
  const marks = d
    .files()
    .sort()
    .flatMap((file) => marksIn(file, d.read(file)));
  for (const m of marks) d.log(`${m.file}:${m.line} ${m.text}`);
  const problems = markProblems(marks, exact);
  for (const p of problems) d.log(`::error::${p}`);
  d.log(
    `${marks.length} marks of mutants that cannot be killed, ${problems.length} not allowed.`,
  );
  return problems.length ? 1 : 0;
}

if (import.meta.main) runCli(() => main());
