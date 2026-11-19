// The cheap and the full run of the release pull request of main in
// .github/workflows/ci.yml and release-ready.yml (owner, 2026-11-13 and
// 2026-11-14, #147): the shell of "Detect changes", of the CI Gate and of
// "Release ready" runs here with the inputs GitHub would give it, as bash
// runs it in the workflow; gh is a stub that writes down its calls.
import { execFileSync } from 'node:child_process';
import {
  chmodSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

const CI = readFileSync('.github/workflows/ci.yml', 'utf8');
const READY = readFileSync('.github/workflows/release-ready.yml', 'utf8');
const NIGHTLY = readFileSync('.github/workflows/mutation.yml', 'utf8');

/**
 * The `run: |` block of the step whose first line is <step> in the workflow
 * <source>, unindented.
 */
function script(step: string, source = CI): string {
  const lines = source.split('\n');
  const start = lines.findIndex((line) => line.trim() === step);
  const run = lines.findIndex(
    (line, i) => i > start && /^\s+run: \|$/.test(line),
  );
  if (start < 0 || run < 0) throw new Error(`no run block after ${step}`);
  const indent = lines[run]!.search(/\S/) + 2;
  const body: string[] = [];
  for (const line of lines.slice(run + 1)) {
    if (line.trim() && line.search(/\S/) < indent) break;
    body.push(line.slice(indent));
  }
  return body.join('\n');
}

/** Runs a block as GitHub runs a bash step; its exit code and output. */
function bash(
  block: string,
  env: Record<string, string>,
  cwd?: string,
): { code: number; out: string } {
  try {
    const out = execFileSync(
      'bash',
      ['--noprofile', '--norc', '-eo', 'pipefail', '-c', block],
      {
        env: { PATH: process.env.PATH, ...env },
        cwd,
        encoding: 'utf8',
        stdio: 'pipe',
      },
    );
    return { code: 0, out };
  } catch (error) {
    const e = error as { status: number; stdout: string; stderr: string };
    return { code: e.status, out: e.stdout + e.stderr };
  }
}

const dir = mkdtempSync(join(tmpdir(), 'ci-release-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('Detect changes', () => {
  const detect = script('- id: diff');
  const output = join(dir, 'output');
  const run = (env: Record<string, string>) => {
    rmSync(output, { force: true });
    const result = bash(detect, {
      EVENT: 'pull_request',
      PR_BASE: 'base',
      HEAD_SHA: 'merge',
      PR_HEAD: 'head',
      GITHUB_OUTPUT: output,
      ...env,
    });
    return { ...result, written: readFileSync(output, 'utf8') };
  };

  it('gives the draft release pull request of main the cheap run', () => {
    const { code, out, written } = run({
      PR_HEAD_REF: 'release/main',
      PR_BASE_REF: 'main',
      PR_DRAFT: 'true',
    });
    expect(code).toBe(0);
    expect(written).toBe(
      'code=false\nimage=false\nmutation=false\nsite=false\n',
    );
    expect(out).toContain('"Ready for review" starts the full run');
  });

  it('decides the cheap run from the head, the base and the draft state', () => {
    // Without a checkout, every other case fails at the file list: it never
    // takes the cheap path.
    const cases: Record<string, string>[] = [
      { PR_HEAD_REF: 'release/main', PR_BASE_REF: 'main', PR_DRAFT: 'false' },
      { PR_HEAD_REF: 'release/main', PR_BASE_REF: 'other', PR_DRAFT: 'true' },
      {
        PR_HEAD_REF: 'release/hotfix/x',
        PR_BASE_REF: 'hotfix/x',
        PR_DRAFT: 'true',
      },
      { PR_HEAD_REF: 'claude/x', PR_BASE_REF: 'main', PR_DRAFT: 'true' },
    ];
    for (const env of cases) {
      const result = bash(detect, {
        EVENT: 'pull_request',
        PR_BASE: 'base',
        HEAD_SHA: 'merge',
        GITHUB_OUTPUT: output,
        GIT_DIR: join(dir, 'no-repository'),
        ...env,
      });
      expect(result.out).not.toContain('the cheap run');
    }
  });

  it('runs everything on a push, draft or not', () => {
    const { written } = run({
      EVENT: 'push',
      PR_BASE: '',
      PR_HEAD_REF: '',
      PR_BASE_REF: '',
      PR_DRAFT: '',
    });
    expect(written).toBe('code=true\nimage=true\nmutation=true\nsite=true\n');
  });
});

describe('Detect changes: the mutation jobs of a pull request (#309)', () => {
  const detect = script('- id: diff');
  const repo = join(dir, 'repo');
  const output = join(dir, 'mutation-output');
  const vcs = (...args: string[]): string =>
    execFileSync('git', args, {
      cwd: repo,
      encoding: 'utf8',
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
  const put = (file: string, text: string): void => {
    mkdirSync(join(repo, file, '..'), { recursive: true });
    writeFileSync(join(repo, file), text);
  };

  /** The mutation-standard.json of the base of these tests. */
  const standardText = JSON.stringify({
    securityTarget: 90,
    newFile: 80,
    security: [],
    floors: { 'src/core/economy.ts': 70, 'src/core/fleet.ts': 80 },
  });
  /** A repository with the real scripts and one commit; the base. */
  const base = (): string => {
    rmSync(repo, { recursive: true, force: true });
    mkdirSync(repo, { recursive: true });
    vcs('init', '-q', '-b', 'main');
    cpSync('scripts', join(repo, 'scripts'), { recursive: true });
    cpSync('stryker.config.json', join(repo, 'stryker.config.json'));
    put('mutation-standard.json', standardText);
    put('src/core/economy.ts', 'export const a = 1;\n');
    put('src/core/economy.test.ts', 'export const t = 1;\n');
    put('src/core/fleet.ts', 'export const b = 1;\n');
    put('src/test/okf-log.test.ts', 'export const t = 1;\n');
    put('okf/ops/x.md', 'x\n');
    vcs('add', '-A');
    vcs('commit', '-q', '-m', 'base');
    return vcs('rev-parse', 'HEAD');
  };
  /** The text of a file, null when it is not there. */
  const textOf = (path: string): string | null => {
    try {
      return readFileSync(path, 'utf8');
    } catch {
      return null;
    }
  };
  /** The commit that changes <files>; the head. */
  const head = (...files: string[]): string => {
    for (const file of files) {
      const path = join(repo, file);
      // Existing files stay what they are (the scripts run, the JSON parses).
      // Read once instead of asking first whether the file is there.
      const old = textOf(path);
      if (old === null) put(file, `${file} changed\n`);
      else if (file.endsWith('.json'))
        writeFileSync(path, JSON.stringify({ ...JSON.parse(old), x: 1 }));
      else writeFileSync(path, `${old}\n// changed\n`);
    }
    vcs('add', '-A');
    vcs('commit', '-q', '-m', 'head');
    return vcs('rev-parse', 'HEAD');
  };
  const detectIn = (
    changed: string[],
    env: Record<string, string> = {},
    tag?: string,
    edit?: () => void,
  ): { code: number; out: string; written: string } => {
    const from = base();
    if (tag) vcs('tag', tag);
    edit?.();
    const to = head(...changed);
    rmSync(output, { force: true });
    const result = bash(
      detect,
      {
        EVENT: 'pull_request',
        PR_BASE: from,
        HEAD_SHA: to,
        PR_HEAD: to,
        PR_HEAD_REF: 'claude/x',
        PR_BASE_REF: 'main',
        PR_DRAFT: 'false',
        GITHUB_REPOSITORY: 'owner/game',
        GITHUB_OUTPUT: output,
        ...env,
      },
      repo,
    );
    return { ...result, written: readFileSync(output, 'utf8') };
  };
  const field = (written: string, name: string): string | undefined =>
    new RegExp(`^${name}=(.*)$`, 'm').exec(written)?.[1];

  it('mutates one changed source file only', () => {
    const { code, written } = detectIn(['src/core/economy.ts']);
    expect(code).toBe(0);
    expect(field(written, 'mutation')).toBe('partial');
    expect(field(written, 'mutation-files')).toBe('["src/core/economy.ts"]');
  });

  it('mutates the source of a changed test file only', () => {
    const { written } = detectIn(['src/core/economy.test.ts']);
    expect(field(written, 'mutation')).toBe('partial');
    expect(field(written, 'mutation-files')).toBe('["src/core/economy.ts"]');
  });

  it('runs no mutation job for documentation or a test without a source', () => {
    for (const changed of [['okf/ops/x.md'], ['src/test/okf-log.test.ts']]) {
      const { written } = detectIn(changed);
      expect(field(written, 'mutation')).toBe('false');
      expect(field(written, 'mutation-files')).toBe('');
    }
  });

  it('runs everything when the mutation configuration changes', () => {
    for (const changed of [
      ['stryker.config.json'],
      ['src/core/economy.ts', 'vitest.config.ts'],
      ['scripts/mutation-partial.ts'],
    ]) {
      const { written } = detectIn(changed);
      expect(field(written, 'mutation')).toBe('true');
      expect(field(written, 'mutation-files')).toBe('');
    }
  });

  /** Writes a mutation-standard.json that differs from the base. */
  const standard =
    (floors: Record<string, number>, rest: Record<string, unknown> = {}) =>
    (): void =>
      put(
        'mutation-standard.json',
        JSON.stringify({
          securityTarget: 90,
          newFile: 80,
          security: [],
          floors,
          ...rest,
        }),
      );

  it('mutates a source file and the file whose floor the pull request raises', () => {
    const { code, written } = detectIn(
      ['src/core/economy.ts'],
      {},
      undefined,
      standard({ 'src/core/economy.ts': 75, 'src/core/fleet.ts': 85 }),
    );
    expect(code).toBe(0);
    expect(field(written, 'mutation')).toBe('partial');
    expect(field(written, 'mutation-files')).toBe(
      '["src/core/economy.ts","src/core/fleet.ts"]',
    );
  });

  it('mutates a source file with its new floor in mutation-standard.json', () => {
    const { written } = detectIn(
      ['src/core/economy.ts', 'src/core/moon.ts'],
      {},
      undefined,
      standard({
        'src/core/economy.ts': 70,
        'src/core/fleet.ts': 80,
        'src/core/moon.ts': 90,
      }),
    );
    expect(field(written, 'mutation')).toBe('partial');
    expect(field(written, 'mutation-files')).toBe(
      '["src/core/economy.ts","src/core/moon.ts"]',
    );
  });

  it('runs everything when mutation-standard.json changes more than the floors', () => {
    const { written } = detectIn(
      ['src/core/economy.ts'],
      {},
      undefined,
      standard(
        { 'src/core/economy.ts': 70, 'src/core/fleet.ts': 80 },
        { newFile: 70 },
      ),
    );
    expect(field(written, 'mutation')).toBe('true');
    expect(field(written, 'mutation-files')).toBe('');
  });

  it('keeps mutation-standard.json a configuration where the complete run decides', () => {
    // A pull request into a hotfix branch and the release pull request of a
    // hotfix branch use scripts/mutation-changes.ts: a floor runs everything.
    const floor = standard({
      'src/core/economy.ts': 75,
      'src/core/fleet.ts': 80,
    });
    const hotfix = detectIn(
      ['okf/ops/x.md'],
      { PR_BASE_REF: 'hotfix/x' },
      undefined,
      floor,
    );
    expect(field(hotfix.written, 'mutation')).toBe('true');
    const release = detectIn(
      ['okf/ops/x.md'],
      { PR_HEAD_REF: 'release/hotfix/x', PR_BASE_REF: 'hotfix/x' },
      '26.1.1',
      floor,
    );
    expect(field(release.written, 'mutation')).toBe('true');
    const main = detectIn(
      ['okf/ops/x.md'],
      { PR_HEAD_REF: 'release/main' },
      undefined,
      floor,
    );
    expect(field(main.written, 'mutation')).toBe('true');
  });

  it('mutates a set at the limit of one job and runs everything above it', () => {
    const many = (n: number): string[] =>
      Array.from({ length: n }, (_, i) => `src/core/new${i}.ts`);
    const at = detectIn(many(12));
    expect(field(at.written, 'mutation')).toBe('partial');
    expect(JSON.parse(field(at.written, 'mutation-files')!)).toHaveLength(12);
    const above = detectIn(many(13));
    expect(above.code).toBe(0);
    expect(field(above.written, 'mutation')).toBe('true');
    expect(field(above.written, 'mutation-files')).toBe('');
  });

  it('keeps the complete run in a release pull request', () => {
    for (const changed of [['okf/ops/x.md'], ['src/core/economy.ts']]) {
      const { written } = detectIn(changed, {
        PR_HEAD_REF: 'release/main',
        PR_BASE_REF: 'main',
      });
      expect(field(written, 'mutation')).toBe('true');
      expect(field(written, 'mutation-files')).toBe('');
    }
  });

  it('keeps the decision of #146 in a pull request into a hotfix branch', () => {
    const env = { PR_BASE_REF: 'hotfix/x' };
    for (const [changed, expected] of [
      [['src/core/economy.ts'], 'true'],
      [['src/test/okf-log.test.ts'], 'true'],
      [['okf/ops/x.md'], 'false'],
    ] as const) {
      const { written } = detectIn([...changed], env);
      expect(field(written, 'mutation')).toBe(expected);
      expect(field(written, 'mutation-files')).toBe('');
    }
  });

  it('keeps the decision of #146 in the release pull request of a hotfix branch', () => {
    const env = { PR_HEAD_REF: 'release/hotfix/x', PR_BASE_REF: 'hotfix/x' };
    for (const [changed, expected] of [
      [['okf/ops/x.md'], 'false'],
      [['src/core/economy.ts'], 'true'],
    ] as const) {
      const { code, written } = detectIn([...changed], env, '26.1.1');
      expect(code).toBe(0);
      expect(field(written, 'mutation')).toBe(expected);
      expect(field(written, 'mutation-files')).toBe('');
    }
  });
});

describe('CI Gate', () => {
  const gate = script('- name: Evaluate the result');
  const green = {
    CHANGES: 'success',
    SECURITY: 'success',
    MIGRATIONS: 'success',
    WORKFLOWS: 'success',
    CODEQL: 'success',
    FRAGMENTS: 'success',
    CHECK: 'success',
    E2E: 'success',
    MUTATION_PLAN: 'success',
    MUTATION_SHARDS: 'success',
    MUTATION: 'success',
    MUTATION_PARTIAL: 'skipped',
    COMPOSE: 'success',
    SITE: 'success',
    CODE: 'true',
    IMAGE: 'true',
    MUTATED: 'true',
    SITE_SOURCES: 'true',
    EVENT: 'pull_request',
    PR_HEAD: 'head',
    HEAD_REF: 'claude/x',
    BASE_REF: 'main',
    PR_DRAFT: 'false',
  };
  const skipped = {
    CHECK: 'skipped',
    E2E: 'skipped',
    MUTATION_PLAN: 'skipped',
    MUTATION_SHARDS: 'skipped',
    MUTATION: 'skipped',
    COMPOSE: 'skipped',
    SITE: 'skipped',
    CODE: 'false',
    IMAGE: 'false',
    MUTATED: 'false',
    SITE_SOURCES: 'false',
  };
  const noMutation = {
    MUTATED: 'false',
    MUTATION_PLAN: 'skipped',
    MUTATION_SHARDS: 'skipped',
    MUTATION: 'skipped',
  };
  const partial = {
    MUTATED: 'partial',
    MUTATION_PLAN: 'skipped',
    MUTATION_SHARDS: 'skipped',
    MUTATION: 'skipped',
    MUTATION_PARTIAL: 'success',
  };
  const draftMain = { HEAD_REF: 'release/main', PR_DRAFT: 'true' };
  const hotfix = { HEAD_REF: 'release/hotfix/x', BASE_REF: 'hotfix/x' };
  const evaluate = (env: Record<string, string>) =>
    bash(gate, { ...green, ...env });

  it('fails the cheap run of the draft on purpose after its checks', () => {
    const { code, out } = evaluate({ ...skipped, ...draftMain });
    expect(code).toBe(1);
    expect(out).toContain(
      '::error::Draft release pull request of main: the cheap checks passed. The full run starts with "Ready for review".',
    );
  });

  it('names a red cheap check of the draft first', () => {
    for (const [job, name] of [
      ['CODEQL', 'CodeQL'],
      ['FRAGMENTS', 'Changelog fragments'],
      ['WORKFLOWS', 'Workflow lint'],
    ] as const) {
      const { code, out } = evaluate({
        ...skipped,
        ...draftMain,
        [job]: 'failure',
      });
      expect(code).toBe(1);
      expect(out).toContain(`::error::${name} must succeed (result: failure)`);
    }
  });

  it('fails the draft of main even when every job ran', () => {
    expect(evaluate(draftMain).code).toBe(1);
  });

  it('accepts the full run of the release pull request of main', () => {
    expect(evaluate({ HEAD_REF: 'release/main' }).code).toBe(0);
  });

  it('requires every check in every other release pull request', () => {
    const cases: Record<string, string>[] = [
      { ...skipped, HEAD_REF: 'release/main' },
      { HEAD_REF: 'release/main', IMAGE: 'false', COMPOSE: 'skipped' },
      {
        HEAD_REF: 'release/main',
        CODE: 'false',
        CHECK: 'skipped',
        E2E: 'skipped',
      },
      { HEAD_REF: 'release/main', SITE_SOURCES: 'false', SITE: 'skipped' },
      { ...skipped, ...draftMain, BASE_REF: 'other' },
      { ...skipped, ...hotfix },
      { ...skipped, ...hotfix, PR_DRAFT: 'true' },
      { ...skipped, HEAD_REF: 'release/other' },
    ];
    for (const env of cases) {
      const { code, out } = evaluate(env);
      expect(code).toBe(1);
      expect(out).toContain(
        '::error::A release pull request must run every check.',
      );
    }
  });

  it('requires the mutation jobs in a release pull request except as #146 allows', () => {
    for (const env of [
      { HEAD_REF: 'release/main', ...noMutation },
      { HEAD_REF: 'release/main', ...noMutation, MUTATED: 'reuse' },
      { HEAD_REF: 'release/other', ...noMutation },
      { ...hotfix, ...noMutation, MUTATED: 'reuse' },
    ]) {
      const { code, out } = evaluate(env);
      expect(code).toBe(1);
      expect(out).toContain(
        `::error::A release pull request must run the mutation jobs (result of the detection: ${env.MUTATED}).`,
      );
    }
    expect(evaluate({ ...hotfix, ...noMutation }).code).toBe(0);
    expect(evaluate({ ...hotfix, PR_DRAFT: 'true' }).code).toBe(0);
  });

  it('keeps every other pull request as before, draft or not', () => {
    for (const draft of ['true', 'false']) {
      expect(evaluate({ PR_DRAFT: draft }).code).toBe(0);
      expect(evaluate({ ...skipped, PR_DRAFT: draft }).code).toBe(0);
      expect(
        evaluate({
          ...hotfix,
          HEAD_REF: 'claude/x',
          ...skipped,
          PR_DRAFT: draft,
        }).code,
      ).toBe(0);
      expect(evaluate({ ...skipped, CODE: 'true', PR_DRAFT: draft }).code).toBe(
        1,
      );
    }
  });

  it('accepts the mutation of the changed files only in a pull request that needs no complete run (#309)', () => {
    expect(evaluate(partial).code).toBe(0);
    expect(evaluate({ ...partial, BASE_REF: 'other' }).code).toBe(0);
    for (const result of ['failure', 'skipped', 'cancelled']) {
      const { code, out } = evaluate({ ...partial, MUTATION_PARTIAL: result });
      expect(code).toBe(1);
      expect(out).toContain(
        `::error::Mutation tests (changed files) must succeed (result: ${result})`,
      );
    }
    for (const shards of [
      { MUTATION_PLAN: 'success' },
      { MUTATION_SHARDS: 'success' },
      { MUTATION: 'success' },
    ]) {
      const { code, out } = evaluate({ ...partial, ...shards });
      expect(code).toBe(1);
      expect(out).toContain(
        '::error::The mutation shards must not run next to the job for the changed files.',
      );
    }
  });

  it('refuses the mutation of the changed files where the complete run is required (#309)', () => {
    const cases: Record<string, string>[] = [
      { HEAD_REF: 'release/main' },
      { HEAD_REF: 'release/hotfix/x', BASE_REF: 'hotfix/x' },
      { BASE_REF: 'hotfix/x' },
      { EVENT: 'push', HEAD_REF: '', BASE_REF: '', FRAGMENTS: 'skipped' },
    ];
    for (const env of cases) {
      const { code, out } = evaluate({ ...partial, ...env });
      expect(code).toBe(1);
      expect(out).toMatch(
        /::error::(The complete mutation run|A release pull request|Pushes to main)/,
      );
    }
  });

  it('keeps the full suite on a push', () => {
    const push = {
      EVENT: 'push',
      HEAD_REF: '',
      BASE_REF: '',
      PR_DRAFT: '',
      FRAGMENTS: 'skipped',
    };
    expect(evaluate(push).code).toBe(0);
    expect(evaluate({ ...skipped, ...push }).code).toBe(1);
  });
});

describe('the start of the full run', () => {
  it('leaves the events of ci.yml as they were', () => {
    expect(CI).toContain(
      '    types: [opened, synchronize, reopened, labeled, unlabeled]\n',
    );
    expect(CI).not.toContain('ready_for_review');
  });

  it('labels only the release pull request of main, with the release App', () => {
    expect(READY).toContain('types: [ready_for_review]');
    expect(READY).toContain(
      "github.event.pull_request.head.ref == 'release/main'",
    );
    expect(READY).toContain(
      'github.event.pull_request.head.repo.full_name == github.repository',
    );
    expect(READY).toContain("github.event.pull_request.base.ref == 'main'");
    expect(READY).toContain('environment: release');
    expect(READY).toContain('permissions: {}');
    expect(READY).toContain('LABEL: voller-lauf');
    expect(READY).not.toContain('actions/checkout');
  });
});

describe('Release ready', () => {
  const ready = script('- name: Start the full run, or refuse it', READY);
  const marker = /^ {10}MARKER: '(.+)'$/m.exec(READY)?.[1];
  const bin = join(dir, 'bin');
  const calls = join(dir, 'gh-calls');
  mkdirSync(bin, { recursive: true });
  // Answers the body of the pull request; every other call succeeds.
  writeFileSync(
    join(bin, 'gh'),
    [
      '#!/bin/sh',
      'printf \'%s\\n\' "$*" >> "$GH_CALLS"',
      'case "$*" in',
      '  "api repos/owner/game/pulls/7 --jq .body")',
      '    [ -z "$FAIL" ] || exit 1',
      '    printf \'%s\\n\' "$BODY" ;;',
      'esac',
      '',
    ].join('\n'),
  );
  chmodSync(join(bin, 'gh'), 0o755);
  const run = (body: string, fail = '') => {
    rmSync(calls, { force: true });
    const result = bash(ready, {
      FAIL: fail,
      PATH: `${bin}:${process.env.PATH}`,
      GH_CALLS: calls,
      BODY: body,
      GITHUB_REPOSITORY: 'owner/game',
      NUMBER: '7',
      LABEL: 'voller-lauf',
      MARKER: marker!,
      REFUSAL: 'refused, because',
    });
    return { ...result, calls: readFileSync(calls, 'utf8').trim().split('\n') };
  };

  it('reads the marker that scripts/release-pr.sh writes', () => {
    const script = readFileSync('scripts/release-pr.sh', 'utf8');
    expect(marker).toBe('<!-- release-pr: unmerged-hotfix -->');
    expect(script).toContain(`unmerged_marker='${marker}'`);
  });

  it('adds and removes the label when no released hotfix waits', () => {
    const { code, calls } = run(
      'Merging this pull request releases **26.11.23**',
    );
    expect(code).toBe(0);
    expect(calls).toEqual([
      'api repos/owner/game/pulls/7 --jq .body',
      'api repos/owner/game/labels/voller-lauf --silent',
      'api --method POST repos/owner/game/issues/7/labels --silent -f labels[]=voller-lauf',
      'api --method DELETE repos/owner/game/issues/7/labels/voller-lauf --silent',
    ]);
  });

  it('refuses while a released hotfix is not merged back', () => {
    for (const body of [
      `Text\n\n${marker}\n**Draft:** merge the released hotfix branch(es) hotfix/x back`,
      `Text\r\n${marker}\r\n**Draft:** edited in the browser`,
    ]) {
      const { code, out, calls } = run(body);
      expect(code).toBe(1);
      expect(out).toContain(
        '::error::A released hotfix is not merged back into main: the release pull request #7 is a draft again, no full run.',
      );
      expect(calls).toEqual([
        'api repos/owner/game/pulls/7 --jq .body',
        'pr ready --undo 7 --repo owner/game',
        'pr comment 7 --repo owner/game --body refused, because',
      ]);
    }
  });

  it('touches no label when the body cannot be read', () => {
    const { code, calls } = run('', 'yes');
    expect(code).not.toBe(0);
    expect(calls).toEqual(['api repos/owner/game/pulls/7 --jq .body']);
  });
});

describe('Nightly mutation run: the issue for a file below its floor (#309)', () => {
  const step = script(
    '- name: Open or update the issue for the files below their floor',
    NIGHTLY,
  );
  const bin = join(dir, 'nightly-bin');
  const work = join(dir, 'nightly');
  const calls = join(dir, 'nightly-calls');
  const body = join(dir, 'nightly-body');
  mkdirSync(bin, { recursive: true });
  // Answers the list of open issues; records every call and the body file.
  writeFileSync(
    join(bin, 'gh'),
    [
      '#!/bin/sh',
      'printf \'%s\\n\' "$*" >> "$GH_CALLS"',
      'prev=',
      'for a in "$@"; do',
      '  [ "$prev" != --body-file ] || cp "$a" "$GH_BODY"',
      '  prev=$a',
      'done',
      'case "$1 $2" in',
      '  "issue list") printf \'%s\\n\' "$OPEN" ;;',
      'esac',
      '',
    ].join('\n'),
  );
  chmodSync(join(bin, 'gh'), 0o755);

  const run = (report: unknown, open = '') => {
    rmSync(work, { recursive: true, force: true });
    mkdirSync(join(work, 'reports/mutation'), { recursive: true });
    cpSync('scripts', join(work, 'scripts'), { recursive: true });
    for (const file of ['stryker.config.json', 'mutation-standard.json'])
      cpSync(file, join(work, file));
    writeFileSync(
      join(work, 'reports/mutation/mutation.json'),
      JSON.stringify(report),
    );
    rmSync(calls, { force: true });
    rmSync(body, { force: true });
    const result = bash(
      step,
      {
        PATH: `${bin}:${process.env.PATH}`,
        GH_CALLS: calls,
        GH_BODY: body,
        OPEN: open,
        RUN: 'https://example.org/run/1',
        TITLE: 'Mutation floor missed on main',
      },
      work,
    );
    return {
      ...result,
      calls: readFileSync(calls, 'utf8').trim().split('\n'),
      body: readFileSync(body, 'utf8'),
    };
  };
  const mutants = (...statuses: string[]) => ({
    mutants: statuses.map((status) => ({ status })),
  });
  const below = {
    files: { 'src/core/new-file.ts': mutants('Killed', 'Survived') },
  };
  const search =
    'issue list --state open --search "Mutation floor missed on main" in:title --json number,title --jq .[] | select(.title == "Mutation floor missed on main") | .number';

  it('opens an issue with the files below their floor', () => {
    const { code, calls, body } = run(below);
    expect(code).toBe(0);
    expect(calls).toEqual([
      search,
      'issue create --title Mutation floor missed on main --body-file body.md',
    ]);
    expect(body).toContain('(https://example.org/run/1)');
    expect(body).toContain(
      '- Mutation score below the floor: src/core/new-file.ts: 50 % < 80 % (new file)',
    );
    expect(body).toContain(
      '- Total mutation score below the break threshold: 50 % < 80 %',
    );
  });

  it('updates the open issue instead of opening another', () => {
    const { code, calls, body } = run(below, '42\n43');
    expect(code).toBe(0);
    expect(calls).toEqual([search, 'issue edit 42 --body-file body.md']);
    expect(body).toContain('src/core/new-file.ts: 50 %');
  });

  it('says so when the gate names nothing', () => {
    const { code, body } = run({ files: 'broken' });
    expect(code).toBe(0);
    expect(body).toContain('- (none named: see the log of the run)');
  });
});

describe('Nightly mutation run: the permission of the issue step (#309)', () => {
  it('writes issues in the gate job only, on main only, after a failed gate', () => {
    expect(NIGHTLY.match(/issues: write/g)).toHaveLength(1);
    expect(NIGHTLY).toContain('\npermissions:\n  contents: read\n');
    const job = NIGHTLY.slice(NIGHTLY.indexOf('\n  mutation:\n'));
    expect(job).toContain(
      '    permissions:\n      contents: read\n      issues: write',
    );
    expect(job).toContain(
      "if: always() && steps.gate.outcome == 'failure' && github.ref == 'refs/heads/main'",
    );
    expect(job).toContain('        id: gate\n');
  });
});
