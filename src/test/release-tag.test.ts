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
