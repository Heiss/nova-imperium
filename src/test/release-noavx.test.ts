// The release image on a CPU without AVX (#456): scripts/release-noavx.sh
// and its helper scripts/static-qemu.sh (shared with ci.yml),
// the job "noavx" of .github/workflows/release.yml, runs here with stubs of
// sudo, apt-get, ldd, docker, curl and sleep that write down their calls, as
// bash runs it on the runner. The real release is never run.
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  symlinkSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

const SCRIPT = resolve('scripts/release-noavx.sh');
/** bash itself, so a run with only the stubs on PATH still finds it. */
const bash = spawnSync('bash', ['-c', 'command -v bash'], {
  encoding: 'utf8',
}).stdout.trim();
const RELEASE = readFileSync('.github/workflows/release.yml', 'utf8');
const root = mkdtempSync(join(tmpdir(), 'release-noavx-'));
afterAll(() => rmSync(root, { recursive: true, force: true }));

const DIGEST = `sha256:${'a'.repeat(64)}`;

interface Stubs {
  /** What ldd says about the QEMU binary, and its exit code. */
  ldd?: string;
  lddCode?: number;
  /** /healthz answers from this try on; 0 never. */
  healthyAt?: number;
  /** What PID 1 of the container runs. */
  cmdline?: string;
  /** Whether the package qemu-user-static cannot be installed. */
  noQemuUserStatic?: boolean;
  /** What docker inspect says of the container running; true by default. */
  running?: string;
  /** No QEMU binary at all on PATH, only the stubs and bash. */
  noQemu?: boolean;
}

/** The default answers of the stubs. */
const DEFAULTS = {
  ldd: 'statically linked',
  lddCode: 0,
  healthyAt: 1,
  cmdline:
    '/usr/local/bin/qemu-x86_64-static -cpu Denverton,-xsavec /usr/local/bin/node src/server/main.ts',
  running: 'true',
};

/** Writes the stubs into <dir>/bin; their calls go to <dir>/calls. */
function writeStubs(dir: string, stubs: Stubs): { bin: string; log: string } {
  const bin = join(dir, 'bin');
  mkdirSync(bin);
  const log = join(dir, 'calls');
  writeFileSync(log, '');
  const s = { ...DEFAULTS, ...stubs };
  const stub = (name: string, body: string) => {
    writeFileSync(
      join(bin, name),
      `#!/usr/bin/env bash\necho "${name} $*" >> "${log}"\n${body}\n`,
    );
    chmodSync(join(bin, name), 0o755);
  };
  stub('sudo', '"$@"');
  stub(
    'apt-get',
    s.noQemuUserStatic
      ? 'case "$*" in *" qemu-user-static") exit 100 ;; esac'
      : 'exit 0',
  );
  if (s.noQemu) symlinkSync(bash, join(bin, 'bash'));
  else stub('qemu-x86_64-static', 'exit 0');
  stub('ldd', `echo "${s.ldd}"; exit ${s.lddCode}`);
  const tries = join(dir, 'tries');
  writeFileSync(tries, '0');
  stub(
    'curl',
    `n=$(( $(cat "${tries}") + 1 )); echo "$n" > "${tries}"; [ ${s.healthyAt} -gt 0 ] && [ "$n" -ge ${s.healthyAt} ]`,
  );
  stub('sleep', 'exit 0');
  stub(
    'docker',
    `case "$1" in exec) echo "${s.cmdline}" ;; inspect) echo "${s.running}" ;; logs) echo "Illegal instruction" ;; esac`,
  );
  return { bin, log };
}

/** Runs the script with the stubs; its exit code, its output and the calls. */
function run(env: Record<string, string>, stubs: Stubs = {}, script = SCRIPT) {
  const { bin, log } = writeStubs(mkdtempSync(join(root, 'run-')), stubs);
  const path = stubs.noQemu ? bin : `${bin}:${process.env.PATH}`;
  const result = spawnSync(bash, ['--noprofile', '--norc', script], {
    env: { PATH: path, TRIES: '3', ...env },
    encoding: 'utf8',
  });
  const code = result.status ?? 1;
  const stdout = result.stdout;
  const out = result.stdout + result.stderr;
  const calls = readFileSync(log, 'utf8').trim().split('\n').filter(Boolean);
  return { code, out, stdout, calls, bin };
}

const ENV = { IMAGE: 'ghcr.io/heiss/nova-imperium', DIGEST };

describe('the release image on a CPU without AVX (#456)', () => {
  it('starts the image by digest under QEMU with Denverton on a fresh volume and gets /healthz', () => {
    const r = run(ENV);
    expect(r.code, r.out).toBe(0);
    expect(r.out).toContain(
      `ghcr.io/heiss/nova-imperium@${DIGEST} runs on a CPU without AVX.`,
    );
    const docker = r.calls.filter((c) => c.startsWith('docker '));
    expect(docker[0]).toBe('docker volume create nova-noavx-data');
    expect(docker[1]).toBe(
      `docker run --detach --name nova-noavx --platform linux/amd64 --read-only --tmpfs /tmp --cap-drop ALL --security-opt no-new-privileges:true -v nova-noavx-data:/data -v ${r.bin}/qemu-x86_64-static:/usr/local/bin/qemu-x86_64-static:ro -e NOVA_PUBLIC_URL=http://127.0.0.1:8080 -e NOVA_EMAIL_LOGIN_CODES=0 -p 127.0.0.1:8080:8080 --entrypoint /usr/local/bin/qemu-x86_64-static ghcr.io/heiss/nova-imperium@${DIGEST} -cpu Denverton,-xsavec /usr/local/bin/node src/server/main.ts`,
    );
    expect(r.calls).toContain('curl -fsS http://127.0.0.1:8080/healthz');
    expect(docker.at(-1)).toMatch(/^docker exec nova-noavx sh -c /);
  });

  it('starts with what a bare start needs, the mail codes off without a mail server', () => {
    const r = run(ENV);
    const start = r.calls.find((c) => c.startsWith('docker run '))!;
    expect(start).toContain(' -e NOVA_EMAIL_LOGIN_CODES=0 ');
    expect(start).not.toContain('SMTP_');
  });

  it('waits for a start under QEMU, two seconds apart', () => {
    const r = run({ ...ENV, TRIES: '5' }, { healthyAt: 3 });
    expect(r.code, r.out).toBe(0);
    expect(r.calls.filter((c) => c.startsWith('curl '))).toHaveLength(3);
    expect(r.calls.filter((c) => c === 'sleep 2')).toHaveLength(2);
  });

  it('fails and shows the log when /healthz never answers', () => {
    const r = run(ENV, { healthyAt: 0 });
    expect(r.code).toBe(1);
    expect(r.calls.filter((c) => c.startsWith('curl '))).toHaveLength(3);
    expect(r.calls).toContain('docker logs --tail 60 nova-noavx');
    expect(r.out).toContain('Illegal instruction');
    expect(r.out).toContain(
      `::error::ghcr.io/heiss/nova-imperium@${DIGEST} did not answer /healthz on a CPU without AVX.`,
    );
  });

  it('stops at once with the log when the container stopped, without waiting out the tries', () => {
    const r = run({ ...ENV, TRIES: '5' }, { healthyAt: 0, running: 'false' });
    expect(r.code).toBe(1);
    expect(r.calls.filter((c) => c.startsWith('curl '))).toHaveLength(1);
    expect(r.calls).not.toContain('sleep 2');
    expect(r.calls).toContain(
      'docker inspect -f {{.State.Running}} nova-noavx',
    );
    expect(r.calls).toContain('docker logs --tail 60 nova-noavx');
    expect(r.out).toContain('Illegal instruction');
    expect(r.out).toContain(
      `::error::ghcr.io/heiss/nova-imperium@${DIGEST} stopped on a CPU without AVX.`,
    );
  });

  it('fails when the app does not run under QEMU, with what PID 1 runs and the log', () => {
    const r = run(ENV, { cmdline: 'node src/server/main.ts' });
    expect(r.code).toBe(1);
    expect(r.out).toContain('PID 1 runs: node src/server/main.ts');
    expect(r.calls).toContain('docker logs --tail 60 nova-noavx');
    expect(r.out).toContain('did not run under QEMU.');
  });

  it('runs the app with the hardening of compose.yaml', () => {
    const start = run(ENV).calls.find((c) => c.startsWith('docker run '))!;
    const compose = readFileSync('compose.yaml', 'utf8');
    expect(compose).toMatch(
      /read_only: true\n\s+tmpfs:\n\s+- \/tmp\n\s+cap_drop: \[ALL\]\n\s+security_opt:\n\s+- no-new-privileges:true/,
    );
    for (const flag of [
      ' --read-only ',
      ' --tmpfs /tmp ',
      ' --cap-drop ALL ',
      ' --security-opt no-new-privileges:true ',
    ])
      expect(start).toContain(flag);
  });

  it('starts with the entrypoint and command of compose.noavx.yaml', () => {
    const yaml = readFileSync('compose.noavx.yaml', 'utf8');
    /** The quoted items of the flow list after <key>. */
    const list = (key: string): string[] => {
      const from = yaml.indexOf(`${key}:`);
      const text = yaml.slice(from, yaml.indexOf(']', from));
      return [...text.matchAll(/'([^']*)'/g)].map((m) => m[1]!);
    };
    const start = run(ENV).calls.find((c) => c.startsWith('docker run '))!;
    const [, entrypoint, rest] = /--entrypoint (\S+) \S+@sha256:\S+ (.*)$/.exec(
      start,
    )!;
    expect([entrypoint, ...rest!.split(' ')]).toEqual([
      ...list('entrypoint'),
      ...list('command'),
    ]);
    expect(list('entrypoint')).toHaveLength(4);
  });

  it('matches in the shell, not by a pipe into grep -q (pipefail)', () => {
    for (const file of ['scripts/release-noavx.sh', 'scripts/static-qemu.sh'])
      expect(readFileSync(file, 'utf8'), file).not.toMatch(/\|\s*grep -q/);
  });

  it('takes a static binary whichever way ldd says it, with its exit code', () => {
    for (const [words, code] of [
      ['statically linked', 0],
      ['not a dynamic executable', 1],
    ] as const) {
      const r = run(ENV, { ldd: words, lddCode: code });
      expect(r.code, `${words}: ${r.out}`).toBe(0);
    }
  });

  it('refuses a QEMU binary that is not static, before any container', () => {
    const r = run(ENV, { ldd: 'linux-vdso.so.1 => (0x00007ff)' });
    expect(r.code).toBe(1);
    expect(r.out).toContain('is not a static binary');
    expect(r.calls.some((c) => c.startsWith('docker '))).toBe(false);
  });

  it('installs qemu-user-static first, where it is a real package (24.04)', () => {
    const r = run(ENV);
    expect(r.code, r.out).toBe(0);
    const installs = r.calls.filter((c) => c.startsWith('apt-get install'));
    expect(installs).toEqual([
      'apt-get install -y -q --no-install-recommends qemu-user-static',
    ]);
  });

  it('takes qemu-user where qemu-user-static cannot be installed (newer Ubuntu)', () => {
    const r = run(ENV, { noQemuUserStatic: true });
    expect(r.code, r.out).toBe(0);
    const installs = r.calls.filter((c) => c.startsWith('apt-get install'));
    expect(installs).toEqual([
      'apt-get install -y -q --no-install-recommends qemu-user-static',
      'apt-get install -y -q --no-install-recommends qemu-user',
    ]);
  });

  it('refuses a missing digest, before anything else', () => {
    for (const digest of ['', 'latest', '26.11.3']) {
      const r = run({ ...ENV, DIGEST: digest });
      expect(r.code, digest).toBe(1);
      expect(r.out).toContain(
        '::error::No digest of the pushed release image.',
      );
      expect(r.calls).toEqual([]);
    }
  });
});

describe('the static QEMU binary, one rule for CI and the release (#449, #456)', () => {
  const HELPER = resolve('scripts/static-qemu.sh');

  it('prints only the path of the binary on stdout, whichever way ldd says static', () => {
    for (const [words, code] of [
      ['statically linked', 0],
      ['not a dynamic executable', 1],
    ] as const) {
      const r = run(ENV, { ldd: words, lddCode: code }, HELPER);
      expect(r.code, r.out).toBe(0);
      expect(r.stdout).toBe(`${r.bin}/qemu-x86_64-static\n`);
    }
  });

  it('says why when no QEMU binary is there after the installs', () => {
    const r = run(ENV, { noQemu: true }, HELPER);
    expect(r.code).toBe(1);
    expect(r.stdout).toBe('');
    expect(r.out).toContain(
      'No QEMU binary for x86_64 after installing qemu-user-static or qemu-user.',
    );
  });

  it('fails with the reason on stderr for a binary that is not static', () => {
    const r = run(ENV, { ldd: 'libc.so.6 => /lib/libc.so.6' }, HELPER);
    expect(r.code).toBe(1);
    expect(r.stdout).toBe('');
    expect(r.out).toContain('is not a static binary: libc.so.6');
  });

  it('is what the check of CI runs, with its error on stdout', () => {
    const ci = readFileSync('.github/workflows/ci.yml', 'utf8');
    expect(ci).toContain('if ! NOVA_QEMU=$(scripts/static-qemu.sh); then');
    expect(ci).not.toContain('ldd "$NOVA_QEMU"');
  });
});

describe('the release workflow runs it before the aliases (#456)', () => {
  /** The lines of a job, from its key to the next job. */
  const job = (name: string): string => {
    const start = RELEASE.indexOf(`\n  ${name}:\n`);
    const next = RELEASE.slice(start + 1).search(/\n {2}[a-z]+:\n/);
    return RELEASE.slice(start, next < 0 ? undefined : start + 1 + next);
  };

  it('hands the digest of the pushed image to the job noavx', () => {
    expect(job('image')).toContain('digest: ${{ steps.build.outputs.digest }}');
    expect(job('image')).toMatch(
      /- name: Build and push the image\n {8}id: build\n/,
    );
    const noavx = job('noavx');
    expect(noavx).toContain('needs: image');
    expect(noavx).toContain("if: needs.image.outputs.publish == 'true'");
    expect(noavx).toContain('DIGEST: ${{ needs.image.outputs.digest }}');
    expect(noavx).toContain('IMAGE: ${{ needs.image.outputs.image }}');
    expect(noavx).toContain('run: scripts/release-noavx.sh');
    expect(noavx).toContain('sparse-checkout: scripts');
  });

  it('moves latest and stable only after the job noavx passed', () => {
    expect(job('aliases')).toContain('needs: [image, scan, noavx]');
  });
});
