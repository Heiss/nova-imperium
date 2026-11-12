import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  compareVersions,
  findings,
  fixedVersion,
  fragment,
  markOsUpdates,
  pinBase,
  pinPackages,
  plan,
  severityOf,
  stillVulnerable,
  type TrivyReport,
} from '../../scripts/security-hotfix.ts';
import { parseFragment } from '../../scripts/changelog.ts';

const DIGEST = `sha256:${'a'.repeat(64)}`;
const OTHER = `sha256:${'b'.repeat(64)}`;

const vuln = (over: Record<string, unknown> = {}) => ({
  VulnerabilityID: 'GHSA-1',
  PkgName: 'foo',
  PkgPath: 'app/node_modules/foo/package.json',
  InstalledVersion: '1.2.3',
  FixedVersion: '1.2.5',
  Severity: 'HIGH',
  ...over,
});
const node = (...vulns: ReturnType<typeof vuln>[]): TrivyReport => ({
  Results: [
    {
      Target: 'Node.js',
      Class: 'lang-pkgs',
      Type: 'node-pkg',
      Vulnerabilities: vulns,
    },
  ],
});

describe('security hotfix: versions', () => {
  it('compares numerically, part by part', () => {
    expect(compareVersions('1.10.0', '1.9.2')).toBeGreaterThan(0);
    expect(compareVersions('1.2.3', '1.2.3')).toBe(0);
    expect(compareVersions('v2.0.0', '2.0.0')).toBe(0);
    expect(compareVersions('1.2', '1.2.0')).toBe(0);
    expect(compareVersions('1.2.0', '1.2.1')).toBeLessThan(0);
    expect(compareVersions('1.0.0-beta', '1.0.0-alpha')).toBe(1);
    expect(compareVersions('1.0.0-alpha', '1.0.0-beta')).toBe(-1);
  });

  it('put a prerelease before its release and ignore build metadata', () => {
    expect(compareVersions('1.2.3-beta', '1.2.3')).toBe(-1);
    expect(compareVersions('1.2.3', '1.2.3-beta')).toBe(1);
    expect(compareVersions('1.2.3-beta.2', '1.2.3-beta.10')).toBeLessThan(0);
    expect(compareVersions('1.2.3+build.5', '1.2.3')).toBe(0);
    expect(compareVersions('1.2.4-rc.1', '1.2.3')).toBeGreaterThan(0);
    expect(fixedVersion('1.2.3-beta', '1.2.3')).toBe('1.2.3');
  });

  it('take the lowest fix above the installed version', () => {
    expect(fixedVersion('1.2.3', '2.0.1, 1.2.5')).toBe('1.2.5');
    expect(fixedVersion('2.0.0', '1.2.5, 2.0.1')).toBe('2.0.1');
    expect(fixedVersion('3.0.0', '1.2.5, 2.0.1')).toBe('');
    expect(fixedVersion('1.2.3', '')).toBe('');
  });

  it('rate npm packages by GitHub (GHSA), others by Trivy', () => {
    expect(
      severityOf(
        vuln({ Severity: 'MEDIUM', VendorSeverity: { ghsa: 3, nvd: 2 } }),
        true,
      ),
    ).toBe('HIGH');
    expect(
      severityOf(vuln({ Severity: 'HIGH', VendorSeverity: { ghsa: 2 } }), true),
    ).toBe('MEDIUM');
    expect(
      severityOf(
        vuln({ Severity: 'CRITICAL', VendorSeverity: { nvd: 1 } }),
        true,
      ),
    ).toBe('CRITICAL');
    expect(
      severityOf(vuln({ Severity: 'LOW', VendorSeverity: { ghsa: 4 } }), true),
    ).toBe('CRITICAL');
    expect(
      severityOf(vuln({ Severity: 'LOW', VendorSeverity: { ghsa: 1 } }), true),
    ).toBe('LOW');
    expect(
      severityOf(vuln({ Severity: 'HIGH', VendorSeverity: { ghsa: 9 } }), true),
    ).toBe('HIGH');
  });

  it('rate the base image by Trivy, even with a GHSA rating', () => {
    expect(
      severityOf(
        vuln({ Severity: 'HIGH', VendorSeverity: { ghsa: 2 } }),
        false,
      ),
    ).toBe('HIGH');
    const os: TrivyReport = {
      Results: [
        {
          Target: 'debian',
          Type: 'debian',
          Vulnerabilities: [
            vuln({ PkgPath: undefined, VendorSeverity: { ghsa: 2 } }),
          ],
        },
      ],
    };
    expect(findings(os).map((f) => f.severity)).toEqual(['HIGH']);
  });
});

describe('security hotfix: findings', () => {
  it('keep only High and Critical with a fix', () => {
    const report = node(
      vuln(),
      vuln({ VulnerabilityID: 'C', Severity: 'CRITICAL' }),
      vuln({ VulnerabilityID: 'M', Severity: 'MEDIUM' }),
      vuln({ VulnerabilityID: 'N', FixedVersion: '' }),
      vuln({ VulnerabilityID: 'U', FixedVersion: undefined }),
      vuln({ VulnerabilityID: 'O', FixedVersion: '1.0.0' }),
    );
    expect(findings(report).map((f) => f.id)).toEqual(['GHSA-1', 'C']);
    expect(findings(report)[0]).toEqual({
      id: 'GHSA-1',
      severity: 'HIGH',
      package: 'foo',
      installed: '1.2.3',
      fixed: '1.2.5',
      layer: 'app',
    });
  });

  it('put packages outside the app and OS packages into the base image', () => {
    const report: TrivyReport = {
      Results: [
        {
          Target: 'Node.js',
          Type: 'node-pkg',
          Vulnerabilities: [
            vuln({ PkgPath: 'usr/local/lib/node_modules/npm/package.json' }),
            vuln({
              PkgPath: '/app/node_modules/bar/package.json',
              PkgName: 'bar',
            }),
          ],
        },
        {
          Target: 'debian',
          Class: 'os-pkgs',
          Type: 'debian',
          Vulnerabilities: [
            vuln({
              PkgName: 'libssl3',
              PkgPath: undefined,
              FixedVersion: '3.0.17-1~deb12u3',
            }),
          ],
        },
        {
          Target: 'gobinary',
          Type: 'gobinary',
          Vulnerabilities: [vuln({ PkgPath: 'app/node_modules/x' })],
        },
        { Target: 'empty', Vulnerabilities: null },
      ],
    };
    expect(findings(report).map((f) => [f.package, f.layer, f.fixed])).toEqual([
      ['foo', 'base', '1.2.5'],
      ['bar', 'app', '1.2.5'],
      ['libssl3', 'base', '3.0.17-1~deb12u3'],
      ['foo', 'base', '1.2.5'],
    ]);
    expect(findings({})).toEqual([]);
    expect(findings({ Results: null })).toEqual([]);
  });
});

describe('security hotfix: plan', () => {
  it('is empty without findings', () => {
    expect(plan(node(vuln({ Severity: 'LOW' })))).toEqual({
      id: '',
      packages: [],
      base: false,
      findings: [],
    });
  });

  it('take the highest fix per package, sorted by name', () => {
    const p = plan(
      node(
        vuln({ PkgName: 'zed' }),
        vuln({ VulnerabilityID: 'GHSA-2', FixedVersion: '1.2.9' }),
        vuln({ VulnerabilityID: 'GHSA-3', FixedVersion: '1.2.4' }),
      ),
    );
    expect(p.packages).toEqual([
      { name: 'foo', version: '1.2.9' },
      { name: 'zed', version: '1.2.5' },
    ]);
    expect(p.base).toBe(false);
    expect(p.id).toMatch(/^[a-f0-9]{10}$/);
  });

  it('give the same holes the same id, other holes another one', () => {
    const a = plan(node(vuln(), vuln({ PkgName: 'bar' })));
    const b = plan(node(vuln({ PkgName: 'bar' }), vuln()));
    const c = plan(node(vuln({ FixedVersion: '1.2.6' })));
    expect(a.id).toBe(b.id);
    expect(a.id).not.toBe(c.id);
    const base1 = plan(
      node(vuln({ PkgPath: 'usr/x', VulnerabilityID: 'CVE-1' })),
    );
    const base2 = plan(
      node(vuln({ PkgPath: 'usr/x', VulnerabilityID: 'CVE-2' })),
    );
    expect(base1.base).toBe(true);
    expect(base1.packages).toEqual([]);
    expect(base1.id).not.toBe(base2.id);
    expect(base1.id).not.toBe('');
  });
});

describe('security hotfix: apply', () => {
  it('override every older copy and pin a direct dependency', () => {
    const pkg = {
      name: 'x',
      dependencies: { foo: '1.2.3' },
      pnpm: { onlyBuiltDependencies: ['esbuild'] },
    };
    expect(
      pinPackages(pkg, [
        { name: 'foo', version: '1.2.5' },
        { name: 'deep', version: '2.0.1' },
      ]),
    ).toEqual({
      name: 'x',
      dependencies: { foo: '1.2.5' },
      pnpm: {
        onlyBuiltDependencies: ['esbuild'],
        overrides: { 'foo@<1.2.5': '1.2.5', 'deep@<2.0.1': '2.0.1' },
      },
    });
    expect(pkg.dependencies.foo).toBe('1.2.3');
    expect(pinPackages({}, [{ name: 'deep', version: '1.0.0' }])).toEqual({
      pnpm: { overrides: { 'deep@<1.0.0': '1.0.0' } },
    });
    expect(
      pinPackages({ pnpm: { overrides: { a: '1' } } }, [
        { name: 'deep', version: '1.0.0' },
      ]),
    ).toEqual({ pnpm: { overrides: { a: '1', 'deep@<1.0.0': '1.0.0' } } });
  });

  it('find versions below a fix in pnpm-lock.yaml', () => {
    const lock = [
      'lockfileVersion: 9.0',
      'overrides:',
      '  foo@<1.2.5: 1.2.5',
      'importers:',
      '  .:',
      '    dependencies:',
      '      foo:',
      '        version: 1.2.3',
      'packages:',
      '  foo@1.2.3:',
      "  '@scope/bar@2.0.0':",
      '  foo@1.2.5:',
      'snapshots:',
      '  foo@1.2.3(peer@1.0.0):',
      "  '@scope/bar@2.0.0(x@1)':",
      '  other@0.0.1:',
    ].join('\n');
    const fixes = [
      { name: 'foo', version: '1.2.5' },
      { name: '@scope/bar', version: '2.1.0' },
      { name: 'missing', version: '1.0.0' },
    ];
    expect(stillVulnerable(lock, fixes)).toEqual([
      '@scope/bar@2.0.0',
      'foo@1.2.3',
    ]);
    expect(stillVulnerable(lock, [{ name: 'foo', version: '1.2.3' }])).toEqual(
      [],
    );
    expect(stillVulnerable('', fixes)).toEqual([]);
  });

  it('insert the same OS updates block as the Dockerfile has', () => {
    const inserted = markOsUpdates('FROM x AS app\n', 'ab')
      .split('\n')
      .slice(2)
      .join('\n')
      .trim();
    expect(readFileSync('Dockerfile', 'utf8')).toContain(inserted);
  });

  it('set the OS updates default to the hotfix id', () => {
    const docker = 'FROM x AS app\nARG OS_UPDATES=none\nRUN apt-get upgrade\n';
    expect(markOsUpdates(docker, 'abc123')).toBe(
      'FROM x AS app\nARG OS_UPDATES=sec-abc123\nRUN apt-get upgrade\n',
    );
    expect(markOsUpdates('ARG OS_UPDATES=sec-old\n', 'ff')).toBe(
      'ARG OS_UPDATES=sec-ff\n',
    );
    expect(
      markOsUpdates('FROM x AS base\nFROM y AS app\nWORKDIR /app\n', 'ab'),
    ).toBe(
      [
        'FROM x AS base',
        'FROM y AS app',
        'ARG OS_UPDATES=sec-ab',
        [
          String.raw`RUN apt-get update --error-on=any`,
          String.raw` && apt-get full-upgrade -y --no-install-recommends`,
          String.raw` && out="$(apt-get -s full-upgrade)"`,
          String.raw` && if ! printf '%s\n' "$out" | grep -qx '0 upgraded, 0 newly installed, 0 to remove and 0 not upgraded.'; then printf '%s\n' "$out" >&2; echo 'Debian updates were held back.' >&2; exit 1; fi`,
          String.raw` && rm -rf /var/lib/apt/lists/*`,
        ].join(' \\\n'),
        'WORKDIR /app',
        '',
      ].join('\n'),
    );
    expect(() => markOsUpdates('FROM x\n', 'ab')).toThrow('no stage "app"');
    expect(() => markOsUpdates(docker, 'x y')).toThrow('Not a hotfix id');
    expect(() => markOsUpdates(docker, '')).toThrow('Not a hotfix id');
  });

  it('pin every FROM of the base image to the digest', () => {
    const docker =
      'FROM node:26-slim AS base\nRUN x\nFROM base AS b\nFROM node:26-slim@' +
      OTHER +
      ' AS app\n';
    expect(pinBase(docker, DIGEST)).toBe(
      `FROM node:26-slim@${DIGEST} AS base\nRUN x\nFROM base AS b\nFROM node:26-slim@${DIGEST} AS app\n`,
    );
    expect(() => pinBase(docker, 'sha256:xyz')).toThrow('Not an image digest');
    expect(() => pinBase(docker, `x${DIGEST}`)).toThrow('Not an image digest');
    expect(() => pinBase(`${docker}x`, `${DIGEST}`)).not.toThrow();
    expect(() => pinBase('FROM node:26-slimmer AS a\n', DIGEST)).toThrow(
      'has no FROM',
    );
    expect(() => pinBase('FROM node:26xslim AS a\n', DIGEST)).toThrow(
      'has no FROM',
    );
  });

  it('write a valid German fragment without internals', () => {
    const f = parseFragment('sicherheit-x.md', fragment());
    expect(f.kind).toBe('behoben');
    expect(f.text).toBe(
      'Sicherheitsupdate: eine bekannte Lücke in einer verwendeten Komponente ist geschlossen.',
    );
  });
});
