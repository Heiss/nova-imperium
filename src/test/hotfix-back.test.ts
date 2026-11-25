// scripts/hotfix-back.sh in a throwaway repository with a stub gh (owner,
// 2026-11-25, 111a): the merge-back of a released hotfix comes from
// hotfix-back/<name>, the current main with the hotfix merged in; it is
// built again when main moves; a conflict stops with the files named; the
// hotfix branch itself never changes.
import { execFileSync } from 'node:child_process';
import {
  chmodSync,
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
const root = mkdtempSync(join(tmpdir(), 'hotfix-back-'));
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

const NO_IDENTITY = {
  PATH: process.env.PATH,
  HOME: join(root, 'empty-home'),
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
  EMAIL: '',
};
mkdirSync(NO_IDENTITY.HOME);

// Writes down every call; "pr list" answers OPEN_PR (the number of an open
// merge-back) or BACKS (the heads of the open merge-backs, one per line).
const bin = join(root, 'bin');
mkdirSync(bin);
writeFileSync(
  join(bin, 'gh'),
  [
    '#!/bin/sh',
    'printf \'%s\\n\' "$*" >> "$GH_CALLS"',
    'case "$*" in',
    '  "pr list --base"*) if [ -n "${GH_FAIL:-}" ]; then exit 1; fi ;;',
    'esac',
    'case "$*" in',
    '  "pr list --head"*) printf \'%s\' "${OPEN_PR:-}" ;;',
    '  "pr list --base"*) printf \'%s\' "${BACKS:-}" ;;',
    'esac',
    '',
  ].join('\n'),
);
chmodSync(join(bin, 'gh'), 0o755);

type Repo = {
  dir: string;
  git: (...args: string[]) => string;
  remote: (ref: string) => string;
};

/** main with 26.11.0 and the released hotfix hotfix/sec-x (26.11.1), both on origin. */
function repository(name: string): Repo {
  const dir = join(root, name);
  const origin = join(root, `${name}.git`);
  mkdirSync(join(dir, 'scripts'), { recursive: true });
  const git = (...args: string[]) =>
    execFileSync('git', args, { cwd: dir, env: ENV, encoding: 'utf8' }).trim();
  execFileSync('git', ['init', '-q', '--bare', origin]);
  git('init', '-q', '-b', 'main');
  git('remote', 'add', 'origin', origin);
  for (const file of ['scripts/hotfix-back.sh', 'scripts/release-pr.sh'])
    copyFileSync(join(ROOT, file), join(dir, file));
  writeFileSync(join(dir, 'VERSION'), '26.11.0\n');
  writeFileSync(join(dir, 'game.txt'), 'line one\nline two\n');
  git('add', '-A');
  git('commit', '-q', '-m', 'Release 26.11.0');
  git('tag', '-a', '26.11.0', '-m', '26.11.0');
  git('switch', '-q', '-c', 'hotfix/sec-x');
  writeFileSync(join(dir, 'fix.txt'), 'the fix\n');
  writeFileSync(join(dir, 'VERSION'), '26.11.1\n');
  git('add', '-A');
  git('commit', '-q', '-m', 'Release 26.11.1 (#3)');
  git('tag', '-a', '26.11.1', '-m', '26.11.1');
  git('switch', '-q', 'main');
  git('push', '-q', 'origin', '--all');
  git('push', '-q', 'origin', '--tags');
  const remote = (ref: string) =>
    execFileSync('git', ['rev-parse', ref], {
      cwd: origin,
      encoding: 'utf8',
    }).trim();
  return { dir, git, remote };
}

/** A commit on main of origin that changes <file>. */
function moveMain(repo: Repo, file: string, text: string): void {
  repo.git('switch', '-q', 'main');
  repo.git('pull', '-q', '--ff-only', 'origin', 'main');
  writeFileSync(join(repo.dir, file), text);
  repo.git('add', '-A');
  repo.git('commit', '-q', '-m', `Change ${file}`);
  repo.git('push', '-q', 'origin', 'main');
}

/** Runs the script; its exit code, output, error and the gh calls. */
function run(
  repo: Repo,
  args: string[],
  env: Record<string, string> = {},
  bare = false,
) {
  const calls = join(root, `${repo.dir.split('/').pop()}-${Date.now()}.calls`);
  let code = 0;
  let out: string;
  let err = '';
  try {
    out = execFileSync('sh', ['scripts/hotfix-back.sh', ...args], {
      cwd: repo.dir,
      env: {
        // A runner without a Git identity: no author or committer, an empty
        // home and no global or system configuration.
        ...(bare ? NO_IDENTITY : ENV),
        PATH: `${bin}:${process.env.PATH}`,
        GH_CALLS: calls,
        ...env,
      },
      encoding: 'utf8',
      stdio: 'pipe',
    });
  } catch (error) {
    const e = error as { status: number; stdout: string; stderr: string };
    code = e.status;
    out = e.stdout;
    err = e.stderr;
  }
  let gh: string[] = [];
  try {
    gh = readFileSync(calls, 'utf8').trim().split('\n');
  } catch {
    // No call.
  }
  return { code, out, err, gh };
}

/** The files and their text on <ref> of origin. */
const files = (repo: Repo, ref: string) => {
  repo.git('fetch', '-q', 'origin');
  return repo.git('ls-tree', '--name-only', '-r', `origin/${ref}`).split('\n');
};

describe('the merge-back of a released hotfix (owner, 2026-11-25, 111a)', () => {
  it('comes from hotfix-back/<name>: the current main with the hotfix merged in', () => {
    const repo = repository('open');
    moveMain(repo, 'news.txt', 'main moved on\n');
    const hotfix = repo.remote('refs/heads/hotfix/sec-x');
    const { code, gh } = run(repo, ['open', 'hotfix/sec-x', '26.11.1']);
    expect(code).toBe(0);
    // Main's commit and the hotfix are both in it.
    expect(files(repo, 'hotfix-back/sec-x')).toEqual(
      expect.arrayContaining(['fix.txt', 'news.txt', 'game.txt']),
    );
    repo.git(
      'merge-base',
      '--is-ancestor',
      'origin/main',
      'origin/hotfix-back/sec-x',
    );
    repo.git(
      'merge-base',
      '--is-ancestor',
      'origin/hotfix/sec-x',
      'origin/hotfix-back/sec-x',
    );
    const create = gh.find((c) => c.startsWith('pr create'))!;
    expect(create).toContain('--base main --head hotfix-back/sec-x');
    expect(create).toContain(
      '--title Sicherheits-Hotfix 26.11.1 zurück nach main',
    );
    expect(create).toContain('instead of the hotfix branch itself');
    // The hotfix branch is untouched.
    expect(repo.remote('refs/heads/hotfix/sec-x')).toBe(hotfix);
  });

  it('opens no second pull request while one is open', () => {
    const repo = repository('again');
    const { code, gh } = run(repo, ['open', 'hotfix/sec-x', '26.11.1'], {
      OPEN_PR: '9',
    });
    expect(code).toBe(0);
    expect(gh.filter((c) => c.startsWith('pr create'))).toEqual([]);
  });

  it('is built again from the new main when main moves, the hotfix branch unchanged', () => {
    const repo = repository('rebuild');
    run(repo, ['open', 'hotfix/sec-x', '26.11.1']);
    const hotfix = repo.remote('refs/heads/hotfix/sec-x');
    moveMain(repo, 'later.txt', 'main moved again\n');
    const { code, out } = run(repo, ['rebuild'], {
      BACKS: 'hotfix-back/sec-x\n',
    });
    expect(code).toBe(0);
    expect(out).toContain('Rebuilt hotfix-back/sec-x from the new main.');
    expect(files(repo, 'hotfix-back/sec-x')).toEqual(
      expect.arrayContaining(['fix.txt', 'later.txt']),
    );
    repo.git(
      'merge-base',
      '--is-ancestor',
      'origin/main',
      'origin/hotfix-back/sec-x',
    );
    expect(repo.remote('refs/heads/hotfix/sec-x')).toBe(hotfix);
  });

  it('stops at a conflict with the files named and leaves the branch as it was', () => {
    const repo = repository('conflict');
    run(repo, ['open', 'hotfix/sec-x', '26.11.1']);
    const before = repo.remote('refs/heads/hotfix-back/sec-x');
    // Main changes VERSION too: it no longer merges cleanly.
    moveMain(repo, 'VERSION', '26.11.5\n');
    const { code, err } = run(repo, ['rebuild'], {
      BACKS: 'hotfix-back/sec-x\n',
    });
    expect(code).toBe(1);
    expect(err).toContain(
      '::error::hotfix/sec-x does not merge into main cleanly: conflict in VERSION. hotfix-back/sec-x and its pull request stay as they are; merge it by hand.',
    );
    expect(repo.remote('refs/heads/hotfix-back/sec-x')).toBe(before);
    // Nothing is left half merged.
    expect(repo.git('status', '--porcelain')).toBe('');
  });

  it('counts as merged back once squashed into main: no release of main waits for it', () => {
    const repo = repository('squash');
    run(repo, ['open', 'hotfix/sec-x', '26.11.1']);
    // The owner squashes the merge-back pull request into main.
    repo.git('switch', '-q', 'main');
    repo.git('merge', '-q', '--squash', 'origin/hotfix-back/sec-x');
    repo.git(
      'commit',
      '-q',
      '-m',
      'Sicherheits-Hotfix 26.11.1 zurück nach main (#10)',
    );
    writeFileSync(join(repo.dir, 'feature.txt'), 'new\n');
    repo.git('add', '-A');
    repo.git('commit', '-q', '-m', 'Feature (#11)');
    repo.git('switch', '-q', '-c', 'release/main');
    writeFileSync(join(repo.dir, 'VERSION'), '26.11.2\n');
    repo.git('commit', '-q', '-am', 'Release 26.11.2');
    repo.git('push', '-q', 'origin', '--all');
    repo.git('fetch', '-q', 'origin');
    const out = execFileSync('sh', ['scripts/release-pr.sh', 'check'], {
      cwd: repo.dir,
      env: { ...ENV, BASE: 'main' },
      encoding: 'utf8',
    });
    expect(out).toContain('no released hotfix waits');
  });

  it('is started by tag.yml after the release of a security hotfix and rebuilt by release-pr.yml on a push to main', () => {
    const tag = readFileSync('.github/workflows/tag.yml', 'utf8');
    // The script comes from main, not from the checkout of the hotfix
    // branch, which may predate it (CodeRabbit on #413).
    expect(tag).toContain(
      'git show origin/main:scripts/hotfix-back.sh > "$RUNNER_TEMP/hotfix-back.sh"',
    );
    expect(tag).toContain(
      'GH_TOKEN="$APP_TOKEN" sh "$RUNNER_TEMP/hotfix-back.sh" open "$BRANCH" "$version"',
    );
    expect(tag).not.toContain('sh scripts/hotfix-back.sh');
    expect(tag).not.toContain('--head "$BRANCH"');
    const pr = readFileSync('.github/workflows/release-pr.yml', 'utf8');
    expect(pr).toMatch(
      /- name: Rebuild the merge-back of a released hotfix\n {8}if: \$\{\{ !cancelled\(\) && github\.event_name == 'push' && github\.ref_name == 'main' \}\}\n {8}env:\n {10}GH_TOKEN: \$\{\{ steps\.app\.outputs\.token \}\}\n {8}run: sh scripts\/hotfix-back\.sh rebuild\n/,
    );
  });

  it('merges with the release identity on a runner that has none (CodeRabbit on #413)', () => {
    const repo = repository('no-identity');
    const { code, err } = run(
      repo,
      ['open', 'hotfix/sec-x', '26.11.1'],
      {},
      true,
    );
    expect(err).toBe('');
    expect(code).toBe(0);
    repo.git('fetch', '-q', 'origin');
    expect(
      repo.git(
        'log',
        '-1',
        '--format=%an <%ae>|%cn',
        'origin/hotfix-back/sec-x',
      ),
    ).toBe(
      'Nova Imperium Release <nova-imperium-release@users.noreply.github.com>|Nova Imperium Release',
    );
  });

  it('reports a refused push as a failure and prints no „Rebuilt“', () => {
    const repo = repository('refused');
    run(repo, ['open', 'hotfix/sec-x', '26.11.1']);
    moveMain(repo, 'later.txt', 'main moved\n');
    // From now on the remote refuses the branch of the merge-back.
    const hook = join(root, 'refused.git', 'hooks', 'pre-receive');
    writeFileSync(
      hook,
      '#!/bin/sh\nwhile read old new ref; do case "$ref" in refs/heads/hotfix-back/*) exit 1 ;; esac; done\n',
    );
    chmodSync(hook, 0o755);
    const { code, out, err } = run(repo, ['rebuild'], {
      BACKS: 'hotfix-back/sec-x\n',
    });
    expect(code).toBe(1);
    expect(out).not.toContain('Rebuilt');
    expect(err).toContain(
      '::error::Could not push hotfix-back/sec-x; it and its pull request stay as they were.',
    );
  });

  it('fails when the open pull requests cannot be listed, and asks for all of them', () => {
    const repo = repository('no-list');
    const failed = run(repo, ['rebuild'], { GH_FAIL: '1' });
    expect(failed.code).toBe(1);
    expect(failed.err).toContain(
      '::error::Could not list the open pull requests into main.',
    );
    // An empty list is nothing to do; the listing asks for every pull request.
    const empty = run(repo, ['rebuild']);
    expect(empty.code).toBe(0);
    expect(empty.out).toBe('');
    expect(empty.gh.find((c) => c.startsWith('pr list --base'))).toContain(
      '--limit 1000',
    );
  });
});
