// scripts/release.sh when a hotfix released the version first (O25, CodeRabbit
// on #395): the release commit of main is not tagged, and the refusal names
// the way out, a new release pull request on the owner's word (#387).
import { execFileSync } from 'node:child_process';
import {
  chmodSync,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

const ROOT = resolve('.');
const root = mkdtempSync(join(tmpdir(), 'release-tag-'));
afterAll(() => rmSync(root, { recursive: true, force: true }));
const REAL_GIT = execFileSync('sh', ['-c', 'command -v git'], {
  encoding: 'utf8',
}).trim();

const ENV = {
  HOME: root,
  GIT_AUTHOR_NAME: 'Test',
  GIT_AUTHOR_EMAIL: 'test@example.org',
  GIT_COMMITTER_NAME: 'Test',
  GIT_COMMITTER_EMAIL: 'test@example.org',
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
};

// The origin is a local repository; its URL as GitHub names it, and a green
// CI run for every commit.
const bin = join(root, 'bin');
mkdirSync(bin);
writeFileSync(
  join(bin, 'git'),
  [
    '#!/bin/sh',
    'if [ "$1 $2" = "remote get-url" ]; then echo https://github.com/Heiss/nova-imperium.git; exit 0; fi',
    `exec ${REAL_GIT} "$@"`,
    '',
  ].join('\n'),
);
writeFileSync(
  join(bin, 'curl'),
  '#!/bin/sh\nprintf \'{"total_count": 1, "workflow_runs": []}\'\n',
);
chmodSync(join(bin, 'git'), 0o755);
chmodSync(join(bin, 'curl'), 0o755);

/** main with 26.11.0, a hotfix that released 26.11.1, and main's own release commit of 26.11.1. */
function repository(): { dir: string; release: string } {
  const dir = join(root, 'repo');
  const origin = join(root, 'repo.git');
  mkdirSync(join(dir, 'scripts'), { recursive: true });
  const git = (...args: string[]) =>
    execFileSync(REAL_GIT, args, {
      cwd: dir,
      env: { PATH: process.env.PATH, ...ENV },
      encoding: 'utf8',
    }).trim();
  execFileSync(REAL_GIT, ['init', '-q', '--bare', origin]);
  git('init', '-q', '-b', 'main');
  git('remote', 'add', 'origin', origin);
  copyFileSync(
    join(ROOT, 'scripts/release.sh'),
    join(dir, 'scripts/release.sh'),
  );
  const version = (v: string) => writeFileSync(join(dir, 'VERSION'), `${v}\n`);
  version('26.11.0');
  git('add', '-A');
  git('commit', '-q', '-m', 'Release 26.11.0');
  git('tag', '-a', '26.11.0', '-m', '26.11.0');
  git('switch', '-q', '-c', 'hotfix/x');
  version('26.11.1');
  git('commit', '-q', '-am', 'Release 26.11.1 (hotfix)');
  git('tag', '-a', '26.11.1', '-m', '26.11.1');
  git('switch', '-q', 'main');
  writeFileSync(join(dir, 'feature.txt'), 'new\n');
  version('26.11.1');
  git('add', '-A');
  git('commit', '-q', '-m', 'Release 26.11.1 (#9)');
  git('push', '-q', 'origin', 'main', 'hotfix/x', '--tags');
  return { dir, release: git('rev-parse', 'HEAD') };
}

describe('the tag of a release whose version a hotfix took first (O25)', () => {
  it('is refused, and the refusal names a new release pull request on the owner’s word', () => {
    const { dir, release } = repository();
    let out = '';
    let code = 0;
    try {
      execFileSync('sh', ['scripts/release.sh'], {
        cwd: dir,
        env: {
          PATH: `${bin}:${process.env.PATH}`,
          ...ENV,
          NOVA_RELEASE_EXPECTED_SHA: release,
          NOVA_RELEASE_BRANCH: 'main',
        },
        encoding: 'utf8',
        stdio: 'pipe',
      });
    } catch (error) {
      const e = error as { status: number; stderr: string };
      code = e.status;
      out = e.stderr;
    }
    expect(code).toBe(1);
    expect(out).toContain(
      '26.11.1 is already the tag of another release: this release is not tagged. Recovery: a new release pull request of main on the owner\'s word (workflow "Release pull request"), which takes the next free version.',
    );
  });
});

describe('the tag of a version not newer than every release (owner, 2026-11-25, 108)', () => {
  /** main with the tags <tags> on a side branch and its own release commit of <release>; the exit code and the error. */
  function tagging(name: string, tags: string[], release: string) {
    const dir = join(root, name);
    const origin = join(root, `${name}.git`);
    mkdirSync(join(dir, 'scripts'), { recursive: true });
    const git = (...args: string[]) =>
      execFileSync(REAL_GIT, args, {
        cwd: dir,
        env: { PATH: process.env.PATH, ...ENV },
        encoding: 'utf8',
      }).trim();
    execFileSync(REAL_GIT, ['init', '-q', '--bare', origin]);
    git('init', '-q', '-b', 'main');
    git('remote', 'add', 'origin', origin);
    copyFileSync(
      join(ROOT, 'scripts/release.sh'),
      join(dir, 'scripts/release.sh'),
    );
    const version = (v: string) =>
      writeFileSync(join(dir, 'VERSION'), `${v}\n`);
    version('26.1.0');
    git('add', '-A');
    git('commit', '-q', '-m', 'Start');
    git('switch', '-q', '-c', 'hotfix/x');
    for (const tag of tags) {
      version(tag);
      git('commit', '-q', '-am', `Release ${tag}`);
      git('tag', '-a', tag, '-m', tag);
    }
    git('switch', '-q', 'main');
    writeFileSync(join(dir, 'feature.txt'), `${name}\n`);
    version(release);
    git('add', '-A');
    git('commit', '-q', '-m', `Release ${release} (#9)`);
    git('push', '-q', 'origin', 'main', 'hotfix/x', '--tags');
    const commit = git('rev-parse', 'HEAD');
    try {
      execFileSync('sh', ['scripts/release.sh', '--dry-run'], {
        cwd: dir,
        env: {
          PATH: `${bin}:${process.env.PATH}`,
          ...ENV,
          NOVA_RELEASE_EXPECTED_SHA: commit,
          NOVA_RELEASE_BRANCH: 'main',
        },
        encoding: 'utf8',
        stdio: 'pipe',
      });
      return { code: 0, err: '' };
    } catch (error) {
      const e = error as { status: number; stderr: string };
      return { code: e.status, err: e.stderr };
    }
  }

  it('tags no version below the newest release: the merged 26.11.26 after the hotfix 26.11.27', () => {
    const { code, err } = tagging('tag-below', ['26.11.27'], '26.11.26');
    expect(code).toBe(1);
    expect(err).toContain(
      '26.11.26 is not newer than the newest release 26.11.27: this release is not tagged, a release is never published after a newer one. Recovery: a new release pull request of main on the owner\'s word (workflow "Release pull request"), which takes the next free version.',
    );
  });

  it('compares each part as a number, also over a month and a year', () => {
    expect(tagging('tag-9-10', ['26.11.9'], '26.11.10').code).toBe(0);
    expect(tagging('tag-10-9', ['26.11.10'], '26.11.9').code).toBe(1);
    expect(tagging('tag-month', ['26.10.0'], '26.9.6').code).toBe(1);
    expect(tagging('tag-year', ['27.1.0'], '26.12.4').code).toBe(1);
    expect(tagging('tag-next', ['26.12.3'], '27.1.0').code).toBe(0);
  });

  it('tags the next version, gaps included', () => {
    expect(tagging('tag-next-28', ['26.11.27'], '26.11.28').code).toBe(0);
    expect(tagging('tag-gap', ['26.11.25'], '26.11.28').code).toBe(0);
  });
});

describe('the merge-back of a released hotfix, squashed into main (owner, 2026-11-25, 116a)', () => {
  /** main with 26.11.0; a branch <branch> released 26.11.1 with a fix; main takes it in by <how>. */
  function mergedBack(
    name: string,
    branch: string,
    how: 'squash' | 'merge' | 'own',
  ) {
    const dir = join(root, name);
    const origin = join(root, `${name}.git`);
    mkdirSync(join(dir, 'scripts'), { recursive: true });
    const git = (...args: string[]) =>
      execFileSync(REAL_GIT, args, {
        cwd: dir,
        env: { PATH: process.env.PATH, ...ENV },
        encoding: 'utf8',
      }).trim();
    execFileSync(REAL_GIT, ['init', '-q', '--bare', origin]);
    git('init', '-q', '-b', 'main');
    git('remote', 'add', 'origin', origin);
    copyFileSync(
      join(ROOT, 'scripts/release.sh'),
      join(dir, 'scripts/release.sh'),
    );
    const version = (v: string) =>
      writeFileSync(join(dir, 'VERSION'), `${v}\n`);
    version('26.11.0');
    writeFileSync(join(dir, 'game.txt'), 'game\n');
    git('add', '-A');
    git('commit', '-q', '-m', 'Release 26.11.0');
    git('tag', '-a', '26.11.0', '-m', '26.11.0');
    writeFileSync(join(dir, 'later.txt'), 'main moved on\n');
    git('add', '-A');
    git('commit', '-q', '-m', 'Later work (#5)');
    git('switch', '-q', '-c', branch, '26.11.0');
    writeFileSync(join(dir, 'fix.txt'), 'the fix\n');
    version('26.11.1');
    git('add', '-A');
    git('commit', '-q', '-m', 'Release 26.11.1 (#3)');
    git('tag', '-a', '26.11.1', '-m', '26.11.1');
    git('switch', '-q', 'main');
    if (how === 'merge') git('merge', '-q', '--no-edit', branch);
    else if (how === 'squash') {
      git('merge', '-q', '--squash', branch);
      git(
        'commit',
        '-q',
        '-m',
        `Sicherheits-Hotfix 26.11.1 zurück nach main (#10)`,
      );
    } else {
      // main's own release commit took the version: its own changes, no fix.
      writeFileSync(join(dir, 'feature.txt'), 'own\n');
      version('26.11.1');
      git('add', '-A');
      git('commit', '-q', '-m', 'Release 26.11.1 (#9)');
    }
    git('push', '-q', 'origin', 'main', branch, '--tags');
    const commit = git('rev-parse', 'HEAD');
    let code = 0;
    let out: string;
    let err = '';
    try {
      out = execFileSync('sh', ['scripts/release.sh'], {
        cwd: dir,
        env: {
          PATH: `${bin}:${process.env.PATH}`,
          ...ENV,
          NOVA_RELEASE_EXPECTED_SHA: commit,
          NOVA_RELEASE_BRANCH: 'main',
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
    const tags = git('tag', '--list').split('\n');
    return { code, out, err, tags };
  }

  it('is green and tags nothing when the hotfix was squashed into main', () => {
    const { code, out, tags } = mergedBack(
      'squashed',
      'hotfix/sec-x',
      'squash',
    );
    expect(code).toBe(0);
    expect(out).toContain(
      '26.11.1 is the release of a merged-back hotfix: nothing to tag.',
    );
    expect(tags).toEqual(['26.11.0', '26.11.1']);
  });

  it('stays green as before when the hotfix was merged into main', () => {
    const { code, out } = mergedBack('merged', 'hotfix/sec-x', 'merge');
    expect(code).toBe(0);
    expect(out).toContain('is the release of a merged-back hotfix');
  });

  it('still refuses the same version squashed in from a branch that is no hotfix', () => {
    const { code, err } = mergedBack('unrelated', 'side', 'squash');
    expect(code).toBe(1);
    expect(err).toContain('26.11.1 is already the tag of another release');
  });

  it('still refuses a release commit of main that took the version of a hotfix (O25)', () => {
    const { code, err } = mergedBack('own-release', 'hotfix/sec-x', 'own');
    expect(code).toBe(1);
    expect(err).toContain('26.11.1 is already the tag of another release');
  });
});
