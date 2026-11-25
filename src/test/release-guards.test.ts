// The CI of a release head refuses what the release pull request only marks
// as a draft (CodeRabbit on #395): `scripts/release-pr.sh check` in a
// throwaway repository, as the checkout of the job sees it (every branch
// under refs/remotes/origin, every tag).
import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

const ROOT = resolve('.');
const root = mkdtempSync(join(tmpdir(), 'release-guards-'));
afterAll(() => rmSync(root, { recursive: true, force: true }));

const ENV = {
  PATH: process.env.PATH,
  HOME: root,
  GIT_AUTHOR_NAME: 'Test',
  GIT_AUTHOR_EMAIL: 'test@example.org',
  GIT_COMMITTER_NAME: 'Test',
  GIT_COMMITTER_EMAIL: 'test@example.org',
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
};

type Repo = { dir: string; git: (...args: string[]) => string };

/** main with the release 26.11.0 and a release head release/main for 26.11.1, pushed to its origin. */
function repository(name: string): Repo {
  const dir = join(root, name);
  const origin = join(root, `${name}.git`);
  mkdirSync(join(dir, 'scripts'), { recursive: true });
  const git = (...args: string[]) =>
    execFileSync('git', args, { cwd: dir, env: ENV, encoding: 'utf8' });
  execFileSync('git', ['init', '-q', '--bare', origin]);
  git('init', '-q', '-b', 'main');
  git('remote', 'add', 'origin', origin);
  copyFileSync(
    join(ROOT, 'scripts/release-pr.sh'),
    join(dir, 'scripts/release-pr.sh'),
  );
  version(dir, '26.11.0');
  git('add', '-A');
  git('commit', '-q', '-m', 'Release 26.11.0');
  git('tag', '-a', '26.11.0', '-m', '26.11.0');
  writeFileSync(join(dir, 'feature.txt'), 'new\n');
  git('add', '-A');
  git('commit', '-q', '-m', 'Feature (#1)');
  git('switch', '-q', '-c', 'release/main');
  version(dir, '26.11.1');
  git('commit', '-q', '-am', 'Release 26.11.1');
  git('switch', '-q', 'main');
  return { dir, git };
}

const version = (dir: string, v: string): void =>
  writeFileSync(join(dir, 'VERSION'), `${v}\n`);

/** A released hotfix of 26.11.0: hotfix/x with the tag <tag>. */
function hotfix(repo: Repo, tag: string): void {
  repo.git('switch', '-q', '-c', 'hotfix/x', '26.11.0');
  writeFileSync(join(repo.dir, 'fix.txt'), 'fix\n');
  version(repo.dir, tag);
  repo.git('add', '-A');
  repo.git('commit', '-q', '-m', `Release ${tag} (#3)`);
  repo.git('tag', '-a', tag, '-m', tag);
  repo.git('switch', '-q', 'main');
}

/** The check on the release head of main as the CI checks it out; its exit code and output. */
function check(repo: Repo): { code: number; out: string } {
  // The release head is rebuilt, as release-pr.sh does: a forced push.
  repo.git('push', '-q', '--force', 'origin', '--all');
  repo.git('push', '-q', 'origin', '--tags');
  repo.git('fetch', '-q', 'origin');
  repo.git('switch', '-q', '--detach', 'origin/release/main');
  try {
    const out = execFileSync('sh', ['scripts/release-pr.sh', 'check'], {
      cwd: repo.dir,
      env: { ...ENV, BASE: 'main' },
      encoding: 'utf8',
      stdio: 'pipe',
    });
    return { code: 0, out };
  } catch (error) {
    const e = error as { status: number; stdout: string };
    return { code: e.status, out: e.stdout };
  } finally {
    repo.git('switch', '-q', 'main');
  }
}

describe('the CI of a release head (CodeRabbit on #395)', () => {
  it('lets a clean release head pass', () => {
    expect(check(repository('clean'))).toEqual({
      code: 0,
      out: 'Release head of main: 26.11.1 is free and no released hotfix waits.\n',
    });
  });

  it('refuses a version that is a release already', () => {
    const repo = repository('tagged');
    repo.git('tag', '-a', '26.11.1', '-m', '26.11.1', 'main');
    const { code, out } = check(repo);
    expect(code).toBe(1);
    expect(out).toContain(
      '::error::26.11.1 is a release already (tag 26.11.1).',
    );
  });

  it('refuses a version that another release branch holds', () => {
    const repo = repository('held');
    repo.git('switch', '-q', '-c', 'release/hotfix/y', '26.11.0');
    version(repo.dir, '26.11.1');
    repo.git('commit', '-q', '-am', 'Release 26.11.1');
    repo.git('switch', '-q', 'main');
    const { code, out } = check(repo);
    expect(code).toBe(1);
    expect(out).toContain('::error::release/hotfix/y holds 26.11.1 too.');
  });

  it('refuses while a released hotfix is not merged back, and passes again once it is', () => {
    const repo = repository('hotfix');
    hotfix(repo, '26.11.2');
    const refused = check(repo);
    expect(refused.code).toBe(1);
    expect(refused.out).toContain(
      '::error::Released hotfix not in main yet: hotfix/x; this release would drop its fix from stable.',
    );
    // The hotfix is merged back into main and the release head rebuilt on it.
    repo.git('merge', '-q', '--no-edit', '-X', 'ours', 'hotfix/x');
    repo.git('switch', '-q', '-C', 'release/main');
    version(repo.dir, '26.11.3');
    repo.git('commit', '-q', '-am', 'Release 26.11.3');
    repo.git('switch', '-q', 'main');
    expect(check(repo).code).toBe(0);
  });

  it('runs on every push to a release head, before the jobs it gates', () => {
    const ci = readFileSync('.github/workflows/ci.yml', 'utf8');
    expect(ci).toContain('types: [opened, synchronize, reopened');
    expect(ci).toMatch(
      /- name: The release head is releasable\n {8}if: github\.event_name == 'pull_request' && startsWith\(github\.head_ref, 'release\/'\)\n {8}env:\n {10}BASE: \$\{\{ github\.base_ref \}\}\n {8}run: sh scripts\/release-pr\.sh check\n/,
    );
    // In "Detect changes", which the CI Gate requires.
    const changes = ci.slice(
      ci.indexOf('\n  changes:\n'),
      ci.indexOf('\n  fragments:\n'),
    );
    expect(changes).toContain('- name: The release head is releasable');
  });
});

describe('a release is never published after a newer one (owner, 2026-11-25, 108)', () => {
  /** main with the tags <tags> and a release head whose VERSION is <head>; the check's code and output. */
  function versions(name: string, tags: string[], head: string) {
    const dir = join(root, name);
    mkdirSync(join(dir, 'scripts'), { recursive: true });
    const git = (...args: string[]) =>
      execFileSync('git', args, { cwd: dir, env: ENV, encoding: 'utf8' });
    git('init', '-q', '-b', 'main');
    copyFileSync(
      join(ROOT, 'scripts/release-pr.sh'),
      join(dir, 'scripts/release-pr.sh'),
    );
    for (const tag of tags) {
      version(dir, tag);
      git('add', '-A');
      git('commit', '-q', '-m', `Release ${tag}`);
      git('tag', '-a', tag, '-m', tag);
    }
    version(dir, head);
    git('add', '-A');
    // --allow-empty: a head equal to the newest tag changes nothing.
    git('commit', '-q', '--allow-empty', '-m', `Release ${head}`);
    try {
      const out = execFileSync('sh', ['scripts/release-pr.sh', 'check'], {
        cwd: dir,
        env: { ...ENV, BASE: 'main' },
        encoding: 'utf8',
        stdio: 'pipe',
      });
      return { code: 0, out };
    } catch (error) {
      const e = error as { status: number; stdout: string };
      return { code: e.status, out: e.stdout };
    }
  }
  const refusal = (head: string, newest: string) =>
    `::error::${head} is not newer than the newest release ${newest}: a release is never published after a newer one. Recovery: rebuild the release pull request from main, which takes the next free version, or a new release pull request on the owner's word.`;

  it('refuses a version below the newest tag: the 26.11.26 of an old release head after the hotfix 26.11.27', () => {
    const { code, out } = versions(
      'below',
      ['26.11.25', '26.11.27'],
      '26.11.26',
    );
    expect(code).toBe(1);
    expect(out).toContain(refusal('26.11.26', '26.11.27'));
  });

  it('refuses a version equal to the newest tag', () => {
    const { code, out } = versions(
      'equal',
      ['26.11.25', '26.11.27'],
      '26.11.27',
    );
    expect(code).toBe(1);
    expect(out).toContain(refusal('26.11.27', '26.11.27'));
  });

  it('compares each part as a number, not as text, also over a month and a year', () => {
    const cases: [string[], string, boolean][] = [
      [['26.11.9'], '26.11.10', true],
      [['26.11.10'], '26.11.9', false],
      [['26.9.5'], '26.10.0', true],
      [['26.10.0'], '26.9.6', false],
      [['26.12.3'], '27.1.0', true],
      [['27.1.0'], '26.12.4', false],
      // The newest of several tags counts, whatever order they were made in.
      [['26.11.30', '26.11.4'], '26.11.5', false],
    ];
    cases.forEach(([tags, head, passes], i) => {
      const { code, out } = versions(`numbers-${i}`, tags, head);
      expect(code, `${tags.join(',')} then ${head}`).toBe(passes ? 0 : 1);
      if (!passes)
        expect(out).toContain(`${head} is not newer than the newest release`);
    });
  });

  it('lets the next version pass, gaps included', () => {
    expect(versions('next', ['26.11.27'], '26.11.28').code).toBe(0);
    expect(versions('gap', ['26.11.25'], '26.11.28').code).toBe(0);
  });
});
