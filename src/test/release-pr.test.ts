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
// Writes down every call; "gh pr list" finds no open pull request.
writeFileSync(
  join(bin, 'gh'),
  '#!/bin/sh\nprintf \'%s\\n\' "$*" >> "$GH_CALLS"\n',
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
): { calls: string[]; body: string; out: string } {
  repo.git('push', '-q', 'origin', '--all');
  repo.git('push', '-q', 'origin', '--tags');
  repo.git('fetch', '-q', 'origin');
  const calls = join(repo.dir, '..', `${repo.dir.split('/').pop()}.calls`);
  const out = execFileSync('sh', ['scripts/release-pr.sh'], {
    cwd: repo.dir,
    env: {
      PATH: `${bin}:${process.env.PATH}`,
      HOME: root,
      ...GIT_ENV,
      BASE: 'main',
      EVENT: event,
      GH_CALLS: calls,
    },
    encoding: 'utf8',
    stdio: 'pipe',
  });
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

describe('release-pr.sh for main', () => {
  it('marks the pull request ready and writes no marker without a hotfix (#387: no draft)', () => {
    const repo = repository('plain');
    commit(repo, 'changes/neu.md', 'Neue Funktion (#1)');
    const { calls, body } = release(repo);
    created(calls);
    expect(ready(calls)).toHaveLength(1);
    expect(undone(calls)).toEqual([]);
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
    expect(undone(calls)).toHaveLength(1);
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

  it('creates none on a push to main: only the owner’s word starts one (#387)', () => {
    const repo = repository('push');
    commit(repo, 'changes/neu.md', 'Neue Funktion (#1)');
    const { calls, out } = release(repo, 'push');
    expect(calls.filter((c) => c.startsWith('pr create'))).toEqual([]);
    expect(out).toContain('No release pull request is open');
  });
});
