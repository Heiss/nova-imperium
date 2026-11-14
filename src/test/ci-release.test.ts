// The cheap and the full run of the release pull request of main in
// .github/workflows/ci.yml and release-ready.yml (owner, 2026-11-13 and
// 2026-11-14, #147): the shell of "Detect changes", of the CI Gate and of
// "Release ready" runs here with the inputs GitHub would give it, as bash
// runs it in the workflow; gh is a stub that writes down its calls.
import { execFileSync } from 'node:child_process';
import {
  chmodSync,
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
): { code: number; out: string } {
  try {
    const out = execFileSync(
      'bash',
      ['--noprofile', '--norc', '-eo', 'pipefail', '-c', block],
      {
        env: { PATH: process.env.PATH, ...env },
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
