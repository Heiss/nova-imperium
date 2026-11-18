// The size ratchet of src/client/main.ts (#242): the stored limit in
// size-ratchet.json only goes down; the check fails above it and below it.
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  baseLimit,
  check,
  countLines,
  LIMIT_FILE,
  parseLimit,
  raised,
  run,
  verdict,
} from '../../scripts/size-ratchet.ts';
import { execFileSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '../..');
const MAIN = 'src/client/main.ts';

/** A folder with the limit file and a main.ts of the given line count. */
const repo = (limit: number | undefined, lines: number | undefined) => {
  const dir = mkdtempSync(path.join(tmpdir(), 'size-ratchet-'));
  if (limit !== undefined)
    writeFileSync(
      path.join(dir, LIMIT_FILE),
      JSON.stringify({ file: MAIN, lines: limit }),
    );
  if (lines !== undefined) {
    mkdirSync(path.join(dir, 'src/client'), { recursive: true });
    writeFileSync(path.join(dir, MAIN), 'x;\n'.repeat(lines));
  }
  return dir;
};

describe('size ratchet', () => {
  it('counts lines as wc -l does', () => {
    expect(countLines('')).toBe(0);
    expect(countLines('a\n')).toBe(1);
    expect(countLines('a\nb\n')).toBe(2);
    expect(countLines('a\nb')).toBe(1);
    expect(countLines('a\r\n\n')).toBe(2);
  });

  it('passes a file at its limit', () => {
    expect(check(repo(3, 3))).toEqual({
      error: undefined,
      limit: { file: MAIN, lines: 3 },
      lines: 3,
    });
  });

  it('fails above the limit and says to move the code out', () => {
    expect(check(repo(3, 4)).error).toBe(
      `${MAIN} has 4 lines, the limit in size-ratchet.json is 3. It must not grow: move the code into a module or component (#118).`,
    );
  });

  it('fails below the limit when the limit was not lowered', () => {
    expect(check(repo(3, 2)).error).toBe(
      `${MAIN} has 2 lines, the limit in size-ratchet.json is 3. Lower the limit in size-ratchet.json to 2 in the same change; the freed lines never come back.`,
    );
  });

  it('passes below the old limit once the limit is lowered', () => {
    expect(check(repo(2, 2)).error).toBeUndefined();
  });

  it('fails on a missing limit file or a missing limited file', () => {
    expect(() => check(repo(undefined, 2))).toThrow(
      'size-ratchet.json is missing.',
    );
    expect(() => check(repo(2, undefined))).toThrow(`${MAIN} is missing.`);
  });

  it('refuses a malformed limit', () => {
    expect(parseLimit('{"file":"a.ts","lines":0}')).toEqual({
      file: 'a.ts',
      lines: 0,
    });
    for (const bad of [
      '{"lines":3}',
      '{"file":"","lines":3}',
      '{"file":3,"lines":3}',
    ])
      expect(() => parseLimit(bad)).toThrow(
        'size-ratchet.json: "file" must name the limited file',
      );
    for (const bad of [
      '{"file":"a.ts"}',
      '{"file":"a.ts","lines":"3"}',
      '{"file":"a.ts","lines":2.5}',
      '{"file":"a.ts","lines":-1}',
    ])
      expect(() => parseLimit(bad)).toThrow(
        'size-ratchet.json: "lines" must be a whole number',
      );
  });

  it('gives no verdict at the limit', () => {
    expect(verdict({ file: 'a.ts', lines: 5 }, 5)).toBeUndefined();
  });

  it('limits only src/client/main.ts, and the repository is at its limit', () => {
    const result = check(root);
    expect(result.limit.file).toBe(MAIN);
    // Stryker's sandbox puts „// @ts-nocheck“ above every source file, so
    // there main.ts has one line more than in the repository.
    const sandbox = root.split(path.sep).includes('.stryker-tmp');
    expect(result.lines).toBe(result.limit.lines + (sandbox ? 1 : 0));
    if (!sandbox) expect(result.error).toBeUndefined();
  });

  it('refuses a limit raised above the one on the base branch', () => {
    const limit = { file: MAIN, lines: 1890 };
    expect(raised(limit, 1889)).toBe(
      `The limit in ${LIMIT_FILE} was raised from 1889 to 1890; it only goes down (#242).`,
    );
    expect(raised(limit, 1890)).toBeUndefined();
    expect(raised({ file: MAIN, lines: 1880 }, 1889)).toBeUndefined();
    expect(raised(limit, undefined)).toBeUndefined();
    // main.ts and the limit raised together: refused before the equality.
    expect(check(repo(4, 4), 3).error).toBe(
      `The limit in ${LIMIT_FILE} was raised from 3 to 4; it only goes down (#242).`,
    );
    expect(check(repo(3, 3), 3).error).toBeUndefined();
  });

  it('reads the limit of the base branch, or none without it', () => {
    const dir = repo(3, 3);
    // Not a repository: no base branch; locally skipped, in the CI an error.
    expect(baseLimit(dir, false)).toBeUndefined();
    expect(() => baseLimit(dir, true)).toThrow('origin/main is missing');
  });

  /** A git repository whose origin/main holds the given limit file, if any. */
  const gitRepo = (base: number | undefined, limit: number, lines: number) => {
    const dir = repo(limit, lines);
    const git = (...args: string[]) =>
      execFileSync('git', args, { cwd: dir, stdio: 'pipe' });
    git('init', '-q');
    git('config', 'user.email', 't@example.invalid');
    git('config', 'user.name', 't');
    const own = path.join(dir, LIMIT_FILE);
    const mine = readFileSync(own, 'utf8');
    if (base === undefined) rmSync(own);
    else writeFileSync(own, JSON.stringify({ file: MAIN, lines: base }));
    git('add', '-A');
    git('commit', '-qm', 'base');
    git('update-ref', 'refs/remotes/origin/main', 'HEAD');
    writeFileSync(own, mine);
    return dir;
  };

  it('compares the limit with the one on origin/main', () => {
    expect(baseLimit(gitRepo(5, 5, 5), true)).toBe(5);
    expect(run(gitRepo(5, 5, 5), true)).toEqual({
      code: 0,
      text: `${MAIN}: 5 lines, at its limit.`,
    });
    expect(run(gitRepo(5, 6, 6), true)).toEqual({
      code: 1,
      text: `The limit in ${LIMIT_FILE} was raised from 5 to 6; it only goes down (#242).`,
    });
    expect(run(gitRepo(5, 4, 4), false).code).toBe(0);
  });

  it('skips the base comparison while origin/main has no limit file', () => {
    expect(baseLimit(gitRepo(undefined, 5, 5), true)).toBeUndefined();
    expect(run(gitRepo(undefined, 6, 6), true).code).toBe(0);
    expect(run(gitRepo(undefined, 6, 7), true)).toEqual({
      code: 1,
      text: `${MAIN} has 7 lines, the limit in ${LIMIT_FILE} is 6. It must not grow: move the code into a module or component (#118).`,
    });
  });
});
