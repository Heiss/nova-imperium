// The release image on a CPU without AVX (#456): scripts/release-noavx.sh,
// the job "noavx" of .github/workflows/release.yml, runs here with stubs of
// sudo, apt-get, ldd, docker, curl and sleep that write down their calls, as
// bash runs it on the runner. The real release is never run.
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
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

const SCRIPT = resolve('scripts/release-noavx.sh');
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
  /** Whether the package qemu-user cannot be installed. */
  noQemuUser?: boolean;
}

/** Runs the script with the stubs; its exit code, its output and the calls. */
function run(env: Record<string, string>, stubs: Stubs = {}) {
  const dir = mkdtempSync(join(root, 'run-'));
  const bin = join(dir, 'bin');
  mkdirSync(bin);
  const log = join(dir, 'calls');
  writeFileSync(log, '');
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
    stubs.noQemuUser
      ? 'case "$*" in *" qemu-user") exit 100 ;; esac'
      : 'exit 0',
  );
  stub('qemu-x86_64-static', 'exit 0');
  stub(
    'ldd',
    `echo "${stubs.ldd ?? 'statically linked'}"; exit ${stubs.lddCode ?? 0}`,
  );
  const tries = join(dir, 'tries');
  writeFileSync(tries, '0');
  stub(
    'curl',
    `n=$(( $(cat "${tries}") + 1 )); echo "$n" > "${tries}"; [ ${stubs.healthyAt ?? 1} -gt 0 ] && [ "$n" -ge ${stubs.healthyAt ?? 1} ]`,
  );
  stub('sleep', 'exit 0');
  stub(
    'docker',
    `case "$1" in exec) echo "${stubs.cmdline ?? '/usr/local/bin/qemu-x86_64-static -cpu Denverton,-xsavec /usr/local/bin/node src/server/main.ts'}" ;; logs) echo "Illegal instruction" ;; esac`,
  );
  let code = 0;
  let out = '';
  try {
    out = execFileSync('bash', ['--noprofile', '--norc', SCRIPT], {
      env: { PATH: `${bin}:${process.env.PATH}`, TRIES: '3', ...env },
      encoding: 'utf8',
      stdio: 'pipe',
    });
  } catch (error) {
    const e = error as { status: number; stdout: string; stderr: string };
    code = e.status;
    out = e.stdout + e.stderr;
  }
  const calls = readFileSync(log, 'utf8').trim().split('\n').filter(Boolean);
  return { code, out, calls, bin };
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
      `docker run --detach --name nova-noavx --platform linux/amd64 --read-only --tmpfs /tmp -v nova-noavx-data:/data -v ${r.bin}/qemu-x86_64-static:/usr/local/bin/qemu-x86_64-static:ro -e NOVA_PUBLIC_URL=http://127.0.0.1:8080 -p 127.0.0.1:8080:8080 --entrypoint /usr/local/bin/qemu-x86_64-static ghcr.io/heiss/nova-imperium@${DIGEST} -cpu Denverton,-xsavec /usr/local/bin/node src/server/main.ts`,
    );
    expect(r.calls).toContain('curl -fsS http://127.0.0.1:8080/healthz');
    expect(docker.at(-1)).toMatch(/^docker exec nova-noavx sh -c /);
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

  it('fails when the app does not run under QEMU', () => {
    const r = run(ENV, { cmdline: 'node src/server/main.ts' });
    expect(r.code).toBe(1);
    expect(r.out).toContain('did not run under QEMU.');
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

  it('takes qemu-user-static where qemu-user cannot be installed', () => {
    const r = run(ENV, { noQemuUser: true });
    expect(r.code, r.out).toBe(0);
    expect(r.calls).toContain(
      'apt-get install -y -q --no-install-recommends qemu-user-static',
    );
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
