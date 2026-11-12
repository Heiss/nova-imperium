import { describe, expect, it } from 'vitest';
import { blocking, holes, type Report } from '../../scripts/trivy-gate.ts';

const v = (id: string, pkg: string, fixed = '2.0.0', path?: string) => ({
  VulnerabilityID: id,
  PkgName: pkg,
  PkgPath: path,
  InstalledVersion: '1.0.0',
  FixedVersion: fixed,
  Severity: 'HIGH',
});
const report = (...vulns: ReturnType<typeof v>[]): Report => ({
  Results: [{ Target: 'debian', Vulnerabilities: vulns }],
});

describe('trivy gate', () => {
  it('lists holes with a fix, keyed by id, package and place', () => {
    const r: Report = {
      Results: [
        {
          Target: 'debian',
          Vulnerabilities: [v('A', 'zlib1g'), v('B', 'x', '')],
        },
        {
          Target: 'Node.js',
          Vulnerabilities: [
            v('C', 'foo', '1.2.5', 'app/node_modules/foo/package.json'),
          ],
        },
        { Target: 'empty', Vulnerabilities: null },
      ],
    };
    expect(holes(r)).toEqual([
      { key: 'A zlib1g debian', line: 'HIGH A: zlib1g 1.0.0 → 2.0.0 (debian)' },
      {
        key: 'C foo app/node_modules/foo/package.json',
        line: 'HIGH C: foo 1.0.0 → 1.2.5 (app/node_modules/foo/package.json)',
      },
    ]);
    expect(holes({})).toEqual([]);
    expect(holes({ Results: null })).toEqual([]);
  });

  it('blocks every hole without a base', () => {
    expect(
      blocking(report(v('A', 'a'), v('B', 'b'))).map((h) => h.key),
    ).toEqual(['A a debian', 'B b debian']);
  });

  it('blocks only holes the base does not have', () => {
    // Two pull requests each fix one of two holes: neither blocks the other.
    const base = report(v('A', 'a'), v('B', 'b'));
    expect(blocking(report(v('B', 'b')), base)).toEqual([]);
    expect(blocking(report(v('A', 'a')), base)).toEqual([]);
    // A hole the pull request brings in blocks.
    expect(
      blocking(report(v('A', 'a'), v('N', 'n')), base).map((h) => h.key),
    ).toEqual(['N n debian']);
    // The same id in another package or place is another hole.
    expect(blocking(report(v('A', 'other')), base).map((h) => h.key)).toEqual([
      'A other debian',
    ]);
  });
});
