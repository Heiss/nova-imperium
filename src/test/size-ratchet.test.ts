// The size ratchet of src/client/main.ts (#242, #317 part 4): the file must
// not have more lines than on the base; there is no stored limit.
import { execFileSync, spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  baseLines,
  baseOf,
  countLines,
  LIMITED_FILE,
  run,
  verdict,
} from '../../scripts/size-ratchet.ts';

const made: string[] = [];
afterAll(() => {
  for (const dir of made) rmSync(dir, { recursive: true, force: true });
});

/** A git repository; git runs a git command in it. */
const repo = () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'size-ratchet-'));
  made.push(dir);
  const git = (...args: string[]): string =>
    execFileSync('git', args, {
      cwd: dir,
      encoding: 'utf8',
      stdio: 'pipe',
      env: {
        PATH: process.env.PATH,
        GIT_CONFIG_GLOBAL: '/dev/null',
        GIT_CONFIG_SYSTEM: '/dev/null',
        GIT_AUTHOR_NAME: 'x',
        GIT_AUTHOR_EMAIL: 'x@example.org',
        GIT_COMMITTER_NAME: 'x',
        GIT_COMMITTER_EMAIL: 'x@example.org',
      },
    }).trim();
  git('init', '-q', '-b', 'main');
  /**
   * Writes main.ts with the lines l<from> to l<to> and commits it (nothing
   * for undefined: another file); the commit.
   */
  const commit = (to: number | undefined, from = 1): string => {
    mkdirSync(path.join(dir, 'src/client'), { recursive: true });
    if (to === undefined) writeFileSync(path.join(dir, 'other.txt'), 'x\n');
    else
      writeFileSync(
        path.join(dir, LIMITED_FILE),
        Array.from({ length: to - from + 1 }, (_, i) => `l${from + i};\n`).join(
          '',
        ),
      );
    git('add', '-A');
    git('commit', '-qm', 'c', '--allow-empty');
    return git('rev-parse', 'HEAD');
  };
  return { dir, git, commit };
};

describe('size ratchet', () => {
  it('counts lines as wc -l does', () => {
    expect(countLines('')).toBe(0);
    expect(countLines('a\n')).toBe(1);
    expect(countLines('a\nb\n')).toBe(2);
    expect(countLines('a\nb')).toBe(1);
    expect(countLines('a\r\n\n')).toBe(2);
  });

  it('lets the file stay or shrink, and says to move the code out when it grows', () => {
    expect(verdict(LIMITED_FILE, 5, 5)).toBeUndefined();
    expect(verdict(LIMITED_FILE, 4, 5)).toBeUndefined();
    expect(verdict(LIMITED_FILE, 0, 0)).toBeUndefined();
    expect(verdict(LIMITED_FILE, 6, 5)).toBe(
      `${LIMITED_FILE} has 6 lines, 1 more than on its base (5). It must not grow: move the code into a module or component (#118).`,
    );
  });

  it('reads the lines of the file on a base, none while it was not there', () => {
    const { dir, commit } = repo();
    const base = commit(3);
    const none = commit(undefined);
    expect(baseLines(dir, base)).toBe(3);
    // The same file, unchanged, in the later commit.
    expect(baseLines(dir, none)).toBe(3);
    expect(baseLines(dir, `${base}~1`)).toBeUndefined();
  });

  describe('against the base commit the CI passes', () => {
    it('passes a file at the lines of the base or below', () => {
      const { dir, commit } = repo();
      const base = commit(5);
      expect(run(dir, true, base)).toEqual({
        code: 0,
        text: `${LIMITED_FILE}: 5 lines, 5 on the base.`,
      });
      commit(4);
      expect(run(dir, true, base)).toEqual({
        code: 0,
        text: `${LIMITED_FILE}: 4 lines, 5 on the base.`,
      });
    });

    it('fails a file that grew over the base, without anything stored to edit', () => {
      const { dir, commit } = repo();
      const base = commit(5);
      commit(6);
      expect(run(dir, true, base)).toEqual({
        code: 1,
        text: `${LIMITED_FILE} has 6 lines, 1 more than on its base (5). It must not grow: move the code into a module or component (#118).`,
      });
    });

    it('measures the working tree, not only the commits', () => {
      const { dir, commit } = repo();
      const base = commit(5);
      writeFileSync(path.join(dir, LIMITED_FILE), 'x;\n'.repeat(7));
      expect(run(dir, true, base).code).toBe(1);
    });

    it('does not blame a branch for what main shrank after it forked', () => {
      // The merge commit the CI tests has main as its first parent: a branch
      // that leaves main.ts alone is at the lines of main, not above.
      const { dir, git, commit } = repo();
      const fork = commit(10);
      git('checkout', '-q', '-b', 'topic');
      writeFileSync(path.join(dir, 'topic.txt'), 'x\n');
      git('add', '-A');
      git('commit', '-qm', 'topic');
      git('checkout', '-q', 'main');
      const main = commit(10, 5);
      git('merge', '-q', '--no-ff', '-m', 'merge', 'topic');
      expect(run(dir, true, main).code).toBe(0);
      // Measured against the old fork point, the same tree has shrunk too.
      expect(run(dir, true, fork).code).toBe(0);
    });

    it('fails a branch that grows the file after main shrank it', () => {
      const { dir, git, commit } = repo();
      commit(10);
      git('checkout', '-q', '-b', 'topic');
      commit(11);
      git('checkout', '-q', 'main');
      const main = commit(10, 5);
      git('merge', '-q', '--no-ff', '-m', 'merge', 'topic');
      // The 6 lines of main plus the line of the branch: 7 > 6.
      expect(
        countLines(readFileSync(path.join(dir, LIMITED_FILE), 'utf8')),
      ).toBe(7);
      expect(run(dir, true, main).code).toBe(1);
    });

    it('passes a change that adds the file, and a push that creates a branch', () => {
      const { dir, commit } = repo();
      const base = commit(undefined);
      commit(8);
      expect(run(dir, true, base)).toEqual({
        code: 0,
        text: `${LIMITED_FILE}: 8 lines, not on the base yet.`,
      });
      expect(run(dir, true, '0'.repeat(40))).toEqual({
        code: 0,
        text: `${LIMITED_FILE}: 8 lines, no base to compare with (skipped).`,
      });
    });

    it('fails on a base that is not fetched, and without the file', () => {
      const { dir, commit } = repo();
      commit(2);
      expect(() => run(dir, true, 'f'.repeat(40))).toThrow(
        `The base ${'f'.repeat(40)} is missing; fetch it before the check.`,
      );
      rmSync(path.join(dir, LIMITED_FILE));
      expect(() => run(dir, true, 'HEAD')).toThrow(
        `${LIMITED_FILE} is missing.`,
      );
    });
  });

  describe('without a base commit', () => {
    it('takes the merge base with origin/main, and fails a branch that grows the file', () => {
      const { dir, git, commit } = repo();
      commit(5);
      git('update-ref', 'refs/remotes/origin/main', 'HEAD');
      expect(run(dir, false)).toEqual({
        code: 0,
        text: `${LIMITED_FILE}: 5 lines, 5 on the base.`,
      });
      commit(6);
      expect(run(dir, false).code).toBe(1);
      commit(4);
      expect(run(dir, false).code).toBe(0);
    });

    it('measures from the fork point, not from the newest main', () => {
      const { dir, git, commit } = repo();
      commit(10);
      git('checkout', '-q', '-b', 'topic');
      commit(undefined);
      git('checkout', '-q', 'main');
      commit(10, 5);
      git('update-ref', 'refs/remotes/origin/main', 'HEAD');
      git('checkout', '-q', 'topic');
      // main shrank to 6 after the fork: the branch at 10 has not grown.
      expect(run(dir, false).code).toBe(0);
    });

    it('is skipped locally without origin/main, an error in the CI', () => {
      const { dir, commit } = repo();
      commit(5);
      expect(baseOf(dir, undefined, false)).toBeUndefined();
      expect(run(dir, false)).toEqual({
        code: 0,
        text: `${LIMITED_FILE}: 5 lines, no base to compare with (skipped).`,
      });
      expect(() => run(dir, true)).toThrow(
        'The CI passes the base commit: size-ratchet.ts <base>.',
      );
    });
  });

  describe('as a command', () => {
    const script = path.resolve(
      import.meta.dirname,
      '../../scripts/size-ratchet.ts',
    );
    const cli = (dir: string, args: string[], env: Record<string, string>) =>
      spawnSync('node', [script, ...args], {
        cwd: dir,
        encoding: 'utf8',
        env: { PATH: process.env.PATH, ...env },
      });

    it('prints the result and exits 0 within the lines of the base', () => {
      const { dir, commit } = repo();
      const base = commit(5);
      const result = cli(dir, [base], { CI: 'true' });
      expect(result.status).toBe(0);
      expect(result.stdout).toBe(`${LIMITED_FILE}: 5 lines, 5 on the base.\n`);
    });

    it('prints the message to stderr and exits 1 above the lines of the base', () => {
      const { dir, commit } = repo();
      const base = commit(5);
      commit(6);
      const result = cli(dir, [base], {});
      expect(result.status).toBe(1);
      expect(result.stdout).toBe('');
      expect(result.stderr).toContain(`${LIMITED_FILE} has 6 lines, 1 more`);
    });

    it('needs the base in the CI, and skips the check locally without origin/main', () => {
      const { dir, commit } = repo();
      commit(5);
      const ci = cli(dir, [], { CI: 'true' });
      expect(ci.status).toBe(1);
      expect(ci.stderr).toBe(
        'The CI passes the base commit: size-ratchet.ts <base>.\n',
      );
      for (const env of [{}, { CI: '' }, { CI: 'false' }] as Record<
        string,
        string
      >[]) {
        const local = cli(dir, [], env);
        expect(local.status).toBe(0);
        expect(local.stdout).toBe(
          `${LIMITED_FILE}: 5 lines, no base to compare with (skipped).\n`,
        );
      }
    });
  });

  it('knows a base only when git finds its commit', () => {
    const { dir, commit } = repo();
    commit(1);
    // Names that look like the all-zero commit of a new branch, but are not.
    for (const name of ['10', '01', 'a0', '0a', '00x0'])
      expect(() => baseOf(dir, name, false)).toThrow(
        `The base ${name} is missing; fetch it before the check.`,
      );
    // git cannot even start in a folder that is not there.
    expect(() => baseOf(path.join(dir, 'nowhere'), 'HEAD', false)).toThrow(
      'The base HEAD is missing',
    );
  });

  it('limits only src/client/main.ts', () => {
    expect(LIMITED_FILE).toBe('src/client/main.ts');
  });
});
