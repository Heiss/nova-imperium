// The release pull request in .github/workflows/ci.yml: it changes only the
// metadata files and runs no expensive job (owner, 2026-11-23 and
// 2026-11-24, #387). The shell of "Detect changes" and of the CI Gate runs
// here with the inputs GitHub would give it, as bash runs it in the
// workflow; gh is a stub that writes down its calls.
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
import { formatFloors } from '../../scripts/mutation-floorfile.ts';

const CI = readFileSync('.github/workflows/ci.yml', 'utf8');
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

  it('runs everything but the mutation jobs at night (#387 part 3)', () => {
    const { code, written } = run({
      EVENT: 'schedule',
      PR_BASE: '',
      PR_HEAD_REF: '',
      PR_BASE_REF: '',
    });
    expect(code).toBe(0);
    expect(written).toBe('code=true\nimage=true\nmutation=false\nsite=true\n');
  });

  it('runs everything on a push', () => {
    const { written } = run({
      EVENT: 'push',
      PR_BASE: '',
      PR_HEAD_REF: '',
      PR_BASE_REF: '',
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
  });
  /** The mutation-floors.txt of the base of these tests. */
  const floorsText = 'src/core/economy.ts 70\nsrc/core/fleet.ts 80\n';
  /** A repository with the real scripts and one commit; the base. */
  const base = (): string => {
    rmSync(repo, { recursive: true, force: true });
    mkdirSync(repo, { recursive: true });
    vcs('init', '-q', '-b', 'main');
    cpSync('scripts', join(repo, 'scripts'), { recursive: true });
    cpSync('stryker.config.json', join(repo, 'stryker.config.json'));
    put('mutation-standard.json', standardText);
    put('mutation-floors.txt', floorsText);
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
        GITHUB_REPOSITORY: 'owner/game',
        GITHUB_OUTPUT: output,
        ...env,
      },
      repo,
    );
    return { ...result, written: textOf(output) ?? '' };
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

  /** Writes a mutation-floors.txt that differs from the base. */
  const floors = (changed: Record<string, number>) => (): void =>
    put('mutation-floors.txt', formatFloors(changed));

  /** Writes a mutation-standard.json that differs from the base. */
  const standard = (rest: Record<string, unknown>) => (): void =>
    put(
      'mutation-standard.json',
      JSON.stringify({
        securityTarget: 90,
        newFile: 80,
        security: [],
        ...rest,
      }),
    );

  it('mutates a source file and the file whose floor the pull request raises', () => {
    const { code, written } = detectIn(
      ['src/core/economy.ts'],
      {},
      undefined,
      floors({ 'src/core/economy.ts': 75, 'src/core/fleet.ts': 85 }),
    );
    expect(code).toBe(0);
    expect(field(written, 'mutation')).toBe('partial');
    expect(field(written, 'mutation-files')).toBe(
      '["src/core/economy.ts","src/core/fleet.ts"]',
    );
  });

  it('mutates a source file with its new floor in mutation-floors.txt', () => {
    const { written } = detectIn(
      ['src/core/economy.ts', 'src/core/moon.ts'],
      {},
      undefined,
      floors({
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

  it('runs everything when mutation-standard.json changes (newFile, security), and once for the change that moves the floors out of it', () => {
    const { written } = detectIn(
      ['src/core/economy.ts'],
      {},
      undefined,
      standard({ newFile: 70 }),
    );
    expect(field(written, 'mutation')).toBe('true');
    expect(field(written, 'mutation-files')).toBe('');
    // The file missing on one side (the change that introduces it): everything.
    const first = detectIn(['src/core/economy.ts'], {}, undefined, () =>
      rmSync(join(repo, 'mutation-floors.txt')),
    );
    expect(field(first.written, 'mutation')).toBe('true');
  });

  it('keeps mutation-floors.txt a configuration where the complete run decides', () => {
    // A pull request into a hotfix branch uses scripts/mutation-changes.ts:
    // a floor runs everything. A release pull request may not change the
    // floors at all (#387).
    const floor = floors({
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
    const releases: Record<string, string>[] = [
      { PR_HEAD_REF: 'release/hotfix/x', PR_BASE_REF: 'hotfix/x' },
      { PR_HEAD_REF: 'release/main' },
    ];
    for (const env of releases) {
      const release = detectIn(['VERSION'], env, undefined, floor);
      expect(release.code).toBe(1);
      expect(release.out).toContain('not: mutation-floors.txt');
    }
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

  it('runs no expensive job in a release pull request that changes only the metadata files (#387)', () => {
    for (const env of [
      { PR_HEAD_REF: 'release/main', PR_BASE_REF: 'main' },
      { PR_HEAD_REF: 'release/hotfix/x', PR_BASE_REF: 'hotfix/x' },
    ]) {
      const { code, out, written } = detectIn(
        ['VERSION', 'CHANGELOG.md', 'changes/neu.md'],
        env,
      );
      expect(code).toBe(0);
      expect(written).toBe(
        'code=false\nimage=false\nmutation=false\nsite=false\n',
      );
      expect(out).toContain('Release pull request: metadata only');
    }
  });

  it('refuses a release pull request that moves a file into changes/ (#387, CodeRabbit 4679061288)', () => {
    const { code, out } = detectIn(
      ['VERSION'],
      { PR_HEAD_REF: 'release/main', PR_BASE_REF: 'main' },
      undefined,
      () => {
        mkdirSync(join(repo, 'changes'), { recursive: true });
        vcs('mv', 'src/core/economy.ts', 'changes/economy.ts');
      },
    );
    expect(code).toBe(1);
    expect(out).toContain('not: src/core/economy.ts');
  });

  it('refuses a release pull request that changes any other file (#387)', () => {
    for (const env of [
      { PR_HEAD_REF: 'release/main', PR_BASE_REF: 'main' },
      { PR_HEAD_REF: 'release/hotfix/x', PR_BASE_REF: 'hotfix/x' },
    ])
      for (const other of [
        'src/core/economy.ts',
        'okf/ops/x.md',
        'changes.md',
        'docs/VERSION',
      ]) {
        const { code, out } = detectIn(['VERSION', other], env);
        expect(code, other).toBe(1);
        expect(out).toContain(
          `::error::A release pull request changes only VERSION, CHANGELOG.md and changes/, not: ${other}`,
        );
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
});

describe('CI Gate', () => {
  const gate = script('- name: Evaluate the result');
  const green = {
    CHANGES: 'success',
    SECURITY: 'success',
    MIGRATIONS: 'success',
    WORKFLOWS: 'success',
    REDOS: 'success',
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
  const partial = {
    MUTATED: 'partial',
    MUTATION_PLAN: 'skipped',
    MUTATION_SHARDS: 'skipped',
    MUTATION: 'skipped',
    MUTATION_PARTIAL: 'success',
  };
  const releaseMain = { HEAD_REF: 'release/main' };
  const hotfix = { HEAD_REF: 'release/hotfix/x', BASE_REF: 'hotfix/x' };
  const evaluate = (env: Record<string, string>) =>
    bash(gate, { ...green, ...env });

  it('accepts the metadata-only run of a release pull request of main or of a hotfix branch (#387)', () => {
    for (const env of [releaseMain, hotfix]) {
      const { code, out } = evaluate({ ...skipped, ...env });
      expect(code).toBe(0);
      expect(out).toContain('Release pull request: metadata only (#387).');
    }
  });

  it('names a red cheap check of a release pull request first', () => {
    for (const [job, name] of [
      ['CHANGES', 'Detect changes'],
      ['CODEQL', 'CodeQL'],
      ['FRAGMENTS', 'Changelog fragments'],
      ['WORKFLOWS', 'Workflow lint'],
      ['REDOS', 'ReDoS lint'],
    ] as const) {
      const { code, out } = evaluate({
        ...skipped,
        ...releaseMain,
        [job]: 'failure',
      });
      expect(code).toBe(1);
      expect(out).toContain(`::error::${name} must succeed (result: failure)`);
    }
  });

  it('refuses an expensive job in a release pull request (#387)', () => {
    for (const env of [
      releaseMain,
      { ...skipped, ...releaseMain, CODE: 'true' },
      { ...skipped, ...releaseMain, IMAGE: 'true' },
      { ...skipped, ...releaseMain, MUTATED: 'true' },
      { ...skipped, ...releaseMain, MUTATED: 'partial' },
      { ...skipped, ...releaseMain, MUTATED: 'reuse' },
      { ...skipped, ...releaseMain, SITE_SOURCES: 'true' },
      { ...skipped, ...hotfix, CODE: 'true' },
      { ...skipped, HEAD_REF: 'release/other', MUTATED: 'true' },
    ]) {
      const { code, out } = evaluate(env);
      expect(code).toBe(1);
      expect(out).toContain(
        '::error::A release pull request runs no expensive job',
      );
    }
  });

  it('keeps every other pull request as before', () => {
    expect(evaluate({}).code).toBe(0);
    expect(evaluate(skipped).code).toBe(0);
    expect(evaluate({ ...hotfix, HEAD_REF: 'claude/x', ...skipped }).code).toBe(
      0,
    );
    expect(evaluate({ ...skipped, CODE: 'true' }).code).toBe(1);
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

  it('requires every job but the mutation jobs in the nightly run (#387 part 3)', () => {
    const night = {
      EVENT: 'schedule',
      HEAD_REF: '',
      BASE_REF: '',
      FRAGMENTS: 'skipped',
      MUTATED: 'false',
      MUTATION_PLAN: 'skipped',
      MUTATION_SHARDS: 'skipped',
      MUTATION: 'skipped',
    };
    expect(evaluate(night).code).toBe(0);
    const missing: Record<string, string>[] = [
      { CODE: 'false', CHECK: 'skipped', E2E: 'skipped' },
      { IMAGE: 'false', COMPOSE: 'skipped' },
      { SITE_SOURCES: 'false', SITE: 'skipped' },
      { MUTATED: 'true' },
    ];
    for (const env of missing) {
      const { code, out } = evaluate({ ...night, ...env });
      expect(code).toBe(1);
      expect(out).toContain('::error::The nightly run runs the unit suite');
    }
    for (const [job, name] of [
      ['CHECK', 'Lint, types, unit tests and build'],
      ['E2E', 'E2E tests'],
      ['COMPOSE', 'Docker image and Compose stack'],
    ] as const) {
      const { code, out } = evaluate({ ...night, [job]: 'failure' });
      expect(code).toBe(1);
      expect(out).toContain(`::error::${name} must succeed (result: failure)`);
    }
    // A proof counts only on a push.
    expect(
      evaluate({ ...night, CHECK: 'skipped', PROOF_CHECK: 'x' }).code,
    ).toBe(1);
  });

  it('keeps the full suite on a push', () => {
    const push = {
      EVENT: 'push',
      HEAD_REF: '',
      BASE_REF: '',
      FRAGMENTS: 'skipped',
    };
    expect(evaluate(push).code).toBe(0);
    expect(evaluate({ ...skipped, ...push }).code).toBe(1);
  });
});

describe('the events of ci.yml', () => {
  it('start no run when a pull request is marked ready, and know no label of a full run (#387)', () => {
    expect(CI).toContain(
      '    types: [opened, synchronize, reopened, labeled, unlabeled]\n',
    );
    expect(CI).not.toContain('ready_for_review');
    expect(CI).not.toContain('voller-lauf');
    expect(CI).not.toContain('PR_DRAFT');
  });

  it('check out the scripts and .node-version for „Detect changes“ at night too (CodeRabbit 4679061280)', () => {
    const job = CI.slice(
      CI.indexOf('  changes:\n'),
      CI.indexOf('  fragments:\n'),
    );
    const checkouts = job
      .split('\n')
      .map((line, i, all) =>
        line.includes('actions/checkout@') ? all[i + 1]!.trim() : null,
      )
      .filter((c) => c !== null);
    expect(checkouts).toEqual([
      "if: github.event_name == 'pull_request'",
      "if: github.event_name == 'push' || github.event_name == 'schedule'",
    ]);
    expect(job).toContain('node-version-file: .node-version');
  });

  it('run every night on main (#387 part 3)', () => {
    expect(CI).toMatch(/\n {2}schedule:\n {4}- cron: '\d+ \d+ \* \* \*'\n/);
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
    for (const file of [
      'stryker.config.json',
      'mutation-standard.json',
      'mutation-floors.txt',
    ])
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

describe('the image „next“ (#387, owner, 2026-11-23)', () => {
  const NEXT = readFileSync('.github/workflows/next-image.yml', 'utf8');
  const version = script('- name: Version and image name', NEXT);

  it('writes the short commit into VERSION and names the image of the owner in lower case', () => {
    const repo = join(dir, 'next');
    rmSync(repo, { recursive: true, force: true });
    mkdirSync(repo, { recursive: true });
    const git = (...args: string[]): string =>
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
    git('init', '-q', '-b', 'main');
    writeFileSync(join(repo, 'VERSION'), '26.11.25\n');
    git('add', '-A');
    git('commit', '-q', '-m', 'c');
    const sha = git('rev-parse', 'HEAD');
    const output = join(dir, 'next-output');
    rmSync(output, { force: true });
    const { code } = bash(
      version,
      {
        SHA: sha,
        GITHUB_REPOSITORY_OWNER: 'Heiss',
        GITHUB_OUTPUT: output,
      },
      repo,
    );
    expect(code).toBe(0);
    expect(readFileSync(join(repo, 'VERSION'), 'utf8')).toBe(
      `${git('rev-parse', '--short', sha)}\n`,
    );
    expect(readFileSync(output, 'utf8')).toBe(
      'image=ghcr.io/heiss/nova-imperium\n',
    );
  });

  it('runs after a green push run on main only, for amd64 and arm64, with the revision label, and moves only „next“', () => {
    expect(NEXT).toContain("github.event.workflow_run.conclusion == 'success'");
    expect(NEXT).toContain("github.event.workflow_run.event == 'push'");
    expect(NEXT).toContain("github.event.workflow_run.head_branch == 'main'");
    expect(NEXT).toContain(
      'github.event.workflow_run.head_repository.full_name == github.repository',
    );
    expect(NEXT).toContain('platforms: linux/amd64,linux/arm64');
    expect(NEXT).toContain(
      'labels: org.opencontainers.image.revision=${{ github.event.workflow_run.head_sha }}',
    );
    expect(NEXT).toContain('tags: ${{ steps.v.outputs.image }}:next');
    // The one tag it pushes; no candidate number, no latest or stable.
    expect(NEXT.match(/^\s+tags:.*$/gm)).toEqual([
      '          tags: ${{ steps.v.outputs.image }}:next',
    ]);
  });
});

describe('the scan of the release image (owner, 2026-11-24, 79a)', () => {
  const RELEASE = readFileSync('.github/workflows/release.yml', 'utf8');
  const job = (name: string): string => {
    const start = RELEASE.indexOf(`\n  ${name}:\n`);
    const next = RELEASE.slice(start + 1).search(/\n {2}[a-z-]+:\n/);
    return next < 0
      ? RELEASE.slice(start)
      : RELEASE.slice(start, start + 1 + next);
  };

  it('scans the published image of the run for High and Critical holes with a fix', () => {
    const scan = job('scan');
    expect(scan).toContain('    needs: image\n');
    expect(scan).toContain("if: needs.image.outputs.publish == 'true'");
    expect(scan).toContain('--severity HIGH,CRITICAL --ignore-unfixed');
    expect(scan).toContain('"$IMAGE:$TAG"');
    // Every published platform on its own (CodeRabbit on #395).
    const platforms = /platforms: (\S+)/.exec(job('image'))![1]!.split(',');
    expect(platforms.length).toBeGreaterThan(1);
    expect(scan).toContain(`        platform: [${platforms.join(', ')}]\n`);
    expect(scan).toContain('      fail-fast: false\n');
    expect(scan).toContain('docker pull --platform "$PLATFORM" "$IMAGE:$TAG"');
    expect(scan).toContain('image --platform "$PLATFORM" --scanners vuln');
    expect(scan).toContain('PLATFORM: ${{ matrix.platform }}');
    expect(scan).toContain('node scripts/trivy-gate.ts trivy-image.json\n');
    expect(job('image')).toContain('tag: ${{ steps.v.outputs.tag }}');
  });

  it('lets the aliases move only after the scan passed', () => {
    const aliases = job('aliases');
    expect(aliases).toContain('    needs: [image, scan]\n');
    // No always() or failure(): a failed scan skips the aliases.
    expect(aliases).not.toMatch(/always\(\)|failure\(\)|!cancelled\(\)/);
  });

  it('move the aliases only to the image the run scanned, never to a newer one whose scan failed', () => {
    const aliases = job('aliases');
    expect(aliases).toContain('TAG: ${{ needs.image.outputs.tag }}');
    expect(aliases).toMatch(
      /if \[ "\$newest" != "\$TAG" \]; then\n[^\n]*\n {12}exit 0\n {10}fi\n/,
    );
    expect(aliases.indexOf('"$newest" != "$TAG"')).toBeLessThan(
      aliases.indexOf('imagetools create'),
    );
  });
});

describe('„Migrations append-only“ in every kind of run (CodeRabbit on #395)', () => {
  /** The run script of the step „Released migrations are unchanged“, unindented. */
  const script = (): string => {
    const at = CI.indexOf('      - name: Released migrations are unchanged');
    const run = CI.indexOf('        run: |\n', at) + '        run: |\n'.length;
    const end = CI.indexOf('\n\n', run);
    return CI.slice(run, end)
      .split('\n')
      .map((line) => line.replace(/^ {10}/, ''))
      .join('\n');
  };

  /** Runs it in a repository with the release 26.11.0 and one commit after it; what the gate was called with, or the error. */
  function run(env: Record<string, string>): { out: string; code: number } {
    const dir = mkdtempSync(join(tmpdir(), 'migrations-job-'));
    try {
      const git = (...args: string[]) =>
        execFileSync('git', args, {
          cwd: dir,
          encoding: 'utf8',
          env: {
            PATH: process.env.PATH,
            HOME: dir,
            GIT_AUTHOR_NAME: 'T',
            GIT_AUTHOR_EMAIL: 't@example.org',
            GIT_COMMITTER_NAME: 'T',
            GIT_COMMITTER_EMAIL: 't@example.org',
            GIT_CONFIG_GLOBAL: '/dev/null',
            GIT_CONFIG_NOSYSTEM: '1',
          },
        }).trim();
      git('init', '-q', '-b', 'main');
      git('commit', '-q', '--allow-empty', '-m', 'Release 26.11.0');
      git('tag', '-a', '26.11.0', '-m', '26.11.0');
      git('commit', '-q', '--allow-empty', '-m', 'Next');
      const head = git('rev-parse', 'HEAD');
      const bin = join(dir, 'bin');
      mkdirSync(bin);
      // The gate itself is tested elsewhere: here only what it is given.
      writeFileSync(join(bin, 'node'), '#!/bin/sh\necho "gate $2 $3 $4"\n');
      chmodSync(join(bin, 'node'), 0o755);
      try {
        const out = execFileSync('bash', ['-e', '-c', script()], {
          cwd: dir,
          encoding: 'utf8',
          stdio: 'pipe',
          env: {
            PATH: `${bin}:${process.env.PATH}`,
            GITHUB_SHA: head,
            BASE: '',
            BASE_REF: '',
            CREATED: '',
            REF: 'refs/heads/main',
            EVENT: 'push',
            ...env,
          },
        });
        return { out: out.replace(head, 'HEAD'), code: 0 };
      } catch (error) {
        const e = error as { status: number; stdout: string };
        return { out: e.stdout, code: e.status };
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  it('compares the nightly run with itself and with the last release tag', () => {
    expect(run({ EVENT: 'schedule' })).toEqual({
      out: 'gate HEAD 26.11.0 \n',
      code: 0,
    });
  });

  it('still refuses a push without a previous tip, rather than passing silently', () => {
    const { out, code } = run({ EVENT: 'push' });
    expect(code).toBe(1);
    expect(out).toContain(
      '::error::No base commit to compare the migrations with.',
    );
    expect(
      run({ EVENT: 'push', BASE: '0000000000000000000000000000000000000000' })
        .code,
    ).toBe(1);
  });
});
