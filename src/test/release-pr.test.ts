// scripts/release-pr.sh in a throwaway repository with a stub gh (#147,
// #387): the release pull request of main is created on the owner's word
// only, is ready unless a released hotfix is not merged back (then it stays a
// draft and its body carries the marker), and names no candidate image.
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

const MARKER = '<!-- release-pr: unmerged-hotfix -->';
const ROOT = resolve('.');
const root = mkdtempSync(join(tmpdir(), 'release-pr-'));
afterAll(() => rmSync(root, { recursive: true, force: true }));

const GIT_ENV = {
  GIT_AUTHOR_NAME: 'Test',
  GIT_AUTHOR_EMAIL: 'test@example.org',
  GIT_COMMITTER_NAME: 'Test',
  GIT_COMMITTER_EMAIL: 'test@example.org',
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
};

const bin = join(root, 'bin');
mkdirSync(bin);
/** The number gh answers for an open release pull request (CodeRabbit on #395). */
const NUMBER = '42';
// Writes down every call. "gh pr list" finds the pull request OPEN_PR, or
// NUMBER once "gh pr create" made one; a call that starts with GH_FAIL fails.
writeFileSync(
  join(bin, 'gh'),
  [
    '#!/bin/sh',
    'printf \'%s\\n\' "$*" >> "$GH_CALLS"',
    'if [ -n "${GH_FAIL:-}" ]; then case "$*" in "$GH_FAIL"*) exit 1 ;; esac; fi',
    'case "$*" in',
    `  "pr create"*) : > "$GH_CALLS.made" ;;`,
    `  "pr list"*) if [ -f "$GH_CALLS.made" ]; then echo ${NUMBER}; else printf '%s' "\${OPEN_PR:-}"; fi ;;`,
    'esac',
    '',
  ].join('\n'),
);
chmodSync(join(bin, 'gh'), 0o755);

type Repo = { dir: string; git: (...args: string[]) => string };

/** A repository with the release 26.11.0 and its origin. */
function repository(name: string): Repo {
  const dir = join(root, name);
  const origin = join(root, `${name}.git`);
  mkdirSync(join(dir, 'scripts'), { recursive: true });
  const git = (...args: string[]) =>
    execFileSync('git', args, {
      cwd: dir,
      env: { PATH: process.env.PATH, HOME: root, ...GIT_ENV },
      encoding: 'utf8',
    });
  execFileSync('git', ['init', '-q', '--bare', origin]);
  git('init', '-q', '-b', 'main');
  git('remote', 'add', 'origin', origin);
  for (const file of ['scripts/release-pr.sh', 'scripts/changelog.ts'])
    copyFileSync(join(ROOT, file), join(dir, file));
  writeFileSync(join(dir, 'VERSION'), '26.11.0\n');
  writeFileSync(join(dir, 'CHANGELOG.md'), '# Neuigkeiten\n');
  mkdirSync(join(dir, 'changes'));
  writeFileSync(join(dir, 'changes', 'README.md'), 'Fragments.\n');
  git('add', '-A');
  git('commit', '-q', '-m', 'Release 26.11.0');
  git('tag', '-a', '26.11.0', '-m', '26.11.0');
  return { dir, git };
}

/** A commit on the current branch that adds <file>, squash-style subject. */
function commit(repo: Repo, file: string, subject: string): void {
  writeFileSync(
    join(repo.dir, file),
    file.startsWith('changes/')
      ? `---\nart: neu\n---\n\n${subject}.\n`
      : `${subject}\n`,
  );
  repo.git('add', '-A');
  repo.git('commit', '-q', '-m', subject);
}

/** A released hotfix of 26.11.0: hotfix/x with the tag 26.11.1. */
function hotfix(repo: Repo): void {
  repo.git('switch', '-q', '-c', 'hotfix/x', '26.11.0');
  commit(repo, 'fix.txt', 'Fix (#2)');
  writeFileSync(join(repo.dir, 'VERSION'), '26.11.1\n');
  repo.git('commit', '-q', '-am', 'Release 26.11.1 (#3)');
  repo.git('tag', '-a', '26.11.1', '-m', '26.11.1');
  repo.git('switch', '-q', 'main');
}

/** Runs the script for BASE=main on <event>; the gh calls, the body it wrote and its output. */
function release(
  repo: Repo,
  event = 'workflow_dispatch',
  rebuildOnly = 'false',
  { open = '', fail = '' }: { open?: string; fail?: string } = {},
): { calls: string[]; body: string; out: string; code: number } {
  repo.git('push', '-q', 'origin', '--all');
  repo.git('push', '-q', 'origin', '--tags');
  repo.git('fetch', '-q', 'origin');
  const calls = join(repo.dir, '..', `${repo.dir.split('/').pop()}.calls`);
  let out: string;
  let code = 0;
  try {
    out = execFileSync('sh', ['scripts/release-pr.sh'], {
      cwd: repo.dir,
      env: {
        PATH: `${bin}:${process.env.PATH}`,
        HOME: root,
        ...GIT_ENV,
        BASE: 'main',
        EVENT: event,
        REBUILD_ONLY: rebuildOnly,
        GH_CALLS: calls,
        OPEN_PR: open,
        GH_FAIL: fail,
      },
      encoding: 'utf8',
      stdio: 'pipe',
    });
  } catch (error) {
    const e = error as { status: number; stdout: string; stderr: string };
    code = e.status;
    out = e.stdout + e.stderr;
  }
  const read = (file: string): string => {
    try {
      return readFileSync(file, 'utf8');
    } catch {
      return '';
    }
  };
  return {
    calls: read(calls).trim().split('\n'),
    body: read(join(repo.dir, 'release-body.md')),
    out,
    code,
  };
}

/** Whether the release pull request was created as a draft and then marked ready, or left a draft. */
const created = (calls: string[]) => {
  expect(calls.some((c) => c.startsWith('pr create --draft --base main'))).toBe(
    true,
  );
  expect(calls.filter((c) => c.startsWith('pr merge'))).toEqual([]);
};
const ready = (calls: string[]) =>
  calls.filter((c) => /^pr ready(?! --undo)/.test(c));
const undone = (calls: string[]) =>
  calls.filter((c) => c.startsWith('pr ready --undo'));
/** Every transition of the draft state names the pull request <n>. */
const transitions = (calls: string[], n: string) => {
  const all = calls.filter((c) => c.startsWith('pr ready'));
  expect(all.length).toBeGreaterThan(0);
  for (const c of all) expect(c).toMatch(new RegExp(` ${n}$`));
};

describe('release-pr.sh for main', () => {
  it('marks the pull request ready and writes no marker without a hotfix (#387: no draft)', () => {
    const repo = repository('plain');
    commit(repo, 'changes/neu.md', 'Neue Funktion (#1)');
    const { calls, body } = release(repo);
    created(calls);
    expect(ready(calls)).toEqual([`pr ready ${NUMBER}`]);
    expect(undone(calls)).toEqual([]);
    transitions(calls, NUMBER);
    expect(body).not.toContain('Draft');
    expect(body).not.toContain('-rc.');
    expect(body).toContain(
      'changes only `VERSION`, `CHANGELOG.md` and `changes/`',
    );
    expect(body).not.toContain(MARKER);
  });

  it('keeps it a draft and writes the marker while a released hotfix is not merged back', () => {
    const repo = repository('unmerged');
    hotfix(repo);
    commit(repo, 'changes/neu.md', 'Neue Funktion (#1)');
    const { calls, body } = release(repo);
    created(calls);
    expect(ready(calls)).toEqual([]);
    expect(undone(calls)).toEqual([`pr ready --undo ${NUMBER}`]);
    expect(body).toContain(
      `\n${MARKER}\n**Draft:** merge the released hotfix branch(es) hotfix/x back into \`main\` first`,
    );
    expect(body.split(MARKER)).toHaveLength(2);
  });

  it('writes no marker and marks it ready once the hotfix is merged back', () => {
    const repo = repository('merged');
    hotfix(repo);
    commit(repo, 'changes/neu.md', 'Neue Funktion (#1)');
    repo.git('merge', '-q', '--no-edit', 'hotfix/x');
    const { calls, body } = release(repo);
    created(calls);
    expect(ready(calls)).toHaveLength(1);
    expect(body).not.toContain(MARKER);
  });

  it('rebuilds an open pull request without a draft transition when all goes well', () => {
    const repo = repository('open');
    commit(repo, 'changes/neu.md', 'Neue Funktion (#1)');
    const { calls, code } = release(repo, 'push', 'false', { open: '7' });
    expect(code).toBe(0);
    expect(calls.filter((c) => c.startsWith('pr create'))).toEqual([]);
    expect(calls).toContain(
      `pr edit 7 --title Release ${'26.11.1'} --body-file release-body.md`,
    );
    expect(undone(calls)).toEqual([]);
    expect(ready(calls)).toEqual(['pr ready 7']);
  });

  it('sets a ready pull request back to draft when the rebuild fails after its push (CodeRabbit 4679061330)', () => {
    const repo = repository('fails');
    commit(repo, 'changes/neu.md', 'Neue Funktion (#1)');
    const { calls, code } = release(repo, 'push', 'false', {
      open: '7',
      fail: 'pr edit',
    });
    expect(code).not.toBe(0);
    expect(calls.at(-1)).toBe('pr ready --undo 7');
    expect(ready(calls)).toEqual([]);
  });

  it('creates none on a push to main: only the owner’s word starts one (#387)', () => {
    const repo = repository('push');
    commit(repo, 'changes/neu.md', 'Neue Funktion (#1)');
    const { calls, out } = release(repo, 'push');
    expect(calls.filter((c) => c.startsWith('pr create'))).toEqual([]);
    expect(out).toContain('No release pull request is open');
  });

  it('creates none when tag.yml only rebuilds after a hotfix release (#387)', () => {
    const repo = repository('rebuild');
    commit(repo, 'changes/neu.md', 'Neue Funktion (#1)');
    const { calls, out } = release(repo, 'workflow_dispatch', 'true');
    expect(calls.filter((c) => c.startsWith('pr create'))).toEqual([]);
    expect(out).toContain('No release pull request is open');
    expect(readFileSync('.github/workflows/tag.yml', 'utf8')).toContain(
      'gh workflow run release-pr.yml --ref main -f rebuild=true',
    );
  });

  it('rebuilds the release pull request of main after a squashed merge-back of a hotfix (116a)', () => {
    const repo = repository('squashed-back');
    hotfix(repo);
    commit(repo, 'changes/neu.md', 'Neue Funktion (#1)');
    // The merge-back of the hotfix, squashed into main.
    repo.git('merge', '-q', '--squash', 'hotfix/x');
    repo.git(
      'commit',
      '-q',
      '-m',
      'Sicherheits-Hotfix 26.11.1 zurück nach main (#4)',
    );
    const { calls, code } = release(repo, 'push', 'false', { open: '7' });
    expect(code).toBe(0);
    expect(calls).toContain(
      'pr edit 7 --title Release 26.11.2 --body-file release-body.md',
    );
    expect(undone(calls)).toEqual([]);
  });
});
