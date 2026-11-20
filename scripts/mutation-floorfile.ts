// The file of the mutation floors, mutation-floors.txt (#317 part 4, #304):
// one line per file, "<path> <floor>", sorted by path, nothing else. Git
// merges different lines without a conflict, and `merge=union` in
// .gitattributes joins two branches that added a line at the same place. A
// file that both sides changed then has two lines: that is a duplicate, and
// every reader refuses it by name (parseFloors) instead of picking one.
// The floors are written by scripts/mutation-floors.ts only, from the merged
// report of a complete CI run.
//
// The rest of the standard (newFile, security, securityTarget) is in
// mutation-standard.json, which changes rarely.

export const FLOORS_FILE = 'mutation-floors.txt';

const LINE = /^(\S+) (\d{1,3}(?:\.\d{1,2})?)$/;

/**
 * The floors of the text of the file. Throws, naming the line, for a line
 * that is not "<path> <floor>", a floor above 100 and a file with two lines.
 * The order of the lines does not matter here; isCanonical tells whether the
 * file is sorted.
 */
export function parseFloors(text: string): Record<string, number> {
  const floors: Record<string, number> = {};
  const lines = text.split('\n');
  // The last line ends with a newline: nothing follows it.
  if (lines[lines.length - 1] === '') lines.pop();
  lines.forEach((line, index) => {
    const found = LINE.exec(line);
    if (!found)
      throw new Error(
        `${FLOORS_FILE}, line ${index + 1}: "${line}" is not "<file> <floor>".`,
      );
    const [, file, value] = found as unknown as [string, string, string];
    const floor = Number(value);
    if (floor > 100)
      throw new Error(
        `${FLOORS_FILE}, line ${index + 1}: ${file} has a floor above 100.`,
      );
    if (Object.hasOwn(floors, file))
      throw new Error(
        `${FLOORS_FILE}, line ${index + 1}: ${file} has two floors (${floors[file]} and ${floor}), probably a merge of two branches that changed it. Keep the line of main or the higher one (never a lower floor than main's) and delete the other.`,
      );
    floors[file] = floor;
  });
  return floors;
}

/** The text of the file for these floors: sorted by path, one line each. */
export function formatFloors(floors: Readonly<Record<string, number>>): string {
  return Object.keys(floors)
    .sort()
    .map((file) => `${file} ${floors[file]}\n`)
    .join('');
}

/**
 * Whether the text is what formatFloors writes for its floors (sorted, each
 * floor in its shortest form, a newline at the end). A merge by union can
 * leave two lines out of order; scripts/mutation-floors.ts --format sorts
 * the file again.
 */
export function isCanonical(text: string): boolean {
  return formatFloors(parseFloors(text)) === text;
}
