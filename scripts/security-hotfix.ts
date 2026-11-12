// Security hotfix (owner, 2026-11-12): an hourly Trivy scan of the image
// "stable" finds holes rated High or Critical that have a fix; the workflow
// .github/workflows/security-hotfix.yml then builds a hotfix from the last
// release tag. This script turns the scan into a plan and applies it to the
// checkout of the release tag. See okf/ops/branching-release.md.
//
//   node scripts/security-hotfix.ts plan <trivy.json>      print the plan as
//        JSON ({"id": "", ...} when nothing needs a hotfix)
//   node scripts/security-hotfix.ts apply <plan.json> [base-digest]
//        pin the fixed versions in package.json, pin the base image to
//        base-digest when the plan needs it, write the changelog fragment
//   node scripts/security-hotfix.ts verify <plan.json>     fail when
//        pnpm-lock.yaml still holds a version below a fix
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

/** Severities that start a hotfix (owner: High and above). */
const URGENT = new Set(['HIGH', 'CRITICAL']);
/** Trivy's numbers in VendorSeverity. */
const VENDOR: Record<number, string> = {
  1: 'LOW',
  2: 'MEDIUM',
  3: 'HIGH',
  4: 'CRITICAL',
};
/** Where the image keeps the dependencies of package.json (Dockerfile). */
const APP_MODULES = /^\/?app\/node_modules\//;
const BASE_IMAGE = 'node:26-slim';

interface TrivyVulnerability {
  VulnerabilityID: string;
  PkgName: string;
  PkgPath?: string;
  InstalledVersion: string;
  FixedVersion?: string;
  Severity: string;
  VendorSeverity?: Record<string, number>;
}
interface TrivyResult {
  Target: string;
  Class?: string;
  Type?: string;
  Vulnerabilities?: TrivyVulnerability[] | null;
}
export interface TrivyReport {
  Results?: TrivyResult[] | null;
}

export interface Finding {
  id: string;
  severity: string;
  package: string;
  installed: string;
  fixed: string;
  /** "app": a dependency of package.json; "base": the base image. */
  layer: 'app' | 'base';
}
export interface PackageFix {
  name: string;
  version: string;
}
export interface Plan {
  /** Names the hotfix branch; empty when nothing needs a hotfix. */
  id: string;
  packages: PackageFix[];
  base: boolean;
  findings: Finding[];
}

/** A numeric part as a number, a missing one as 0, any other as text. */
const part = (p: string | undefined): number | string =>
  p === undefined ? 0 : /^\d+$/.test(p) ? Number(p) : p;

function compareParts(a: readonly string[], b: readonly string[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = part(a[i]);
    const y = part(b[i]);
    if (x === y) continue;
    if (typeof x === 'number' && typeof y === 'number') return x - y;
    return String(x) < String(y) ? -1 : 1;
  }
  return 0;
}

/**
 * Compares two versions numerically, part by part ("1.10.0" > "1.9.2"); a
 * prerelease comes before its release ("1.2.3-beta" < "1.2.3"), build
 * metadata after "+" does not count.
 */
export function compareVersions(a: string, b: string): number {
  const split = (v: string): [string[], string] => {
    const core = v.replace(/^v/, '').split('+')[0] ?? '';
    const dash = core.indexOf('-');
    return dash < 0
      ? [core.split('.'), '']
      : [core.slice(0, dash).split('.'), core.slice(dash + 1)];
  };
  const [ma, pa] = split(a);
  const [mb, pb] = split(b);
  const release = compareParts(ma, mb);
  if (release !== 0 || pa === pb) return release;
  if (!pa) return 1;
  if (!pb) return -1;
  return compareParts(pa.split('.'), pb.split('.'));
}

/**
 * The fixed version to install: Trivy may list one per release line
 * ("1.2.5, 2.0.1"). The lowest one above the installed version wins, so a
 * fix stays on the installed major version when that line has one.
 */
export function fixedVersion(installed: string, listed: string): string {
  const above = listed
    .split(',')
    .map((v) => v.trim())
    .filter((v) => v && compareVersions(v, installed) > 0)
    .sort(compareVersions);
  return above[0] ?? '';
}

/**
 * npm packages: GitHub's rating (GHSA), Trivy's own rating when GitHub has
 * none. Everything else (the base image): Trivy's rating.
 */
export function severityOf(v: TrivyVulnerability, npm: boolean): string {
  const ghsa = npm ? v.VendorSeverity?.ghsa : undefined;
  return ghsa === undefined ? v.Severity : (VENDOR[ghsa] ?? v.Severity);
}

/** One hole as a finding, or null when it does not start a hotfix. */
function toFinding(result: TrivyResult, v: TrivyVulnerability): Finding | null {
  const severity = severityOf(v, result.Type === 'node-pkg');
  if (!URGENT.has(severity) || !v.FixedVersion) return null;
  const app = result.Type === 'node-pkg' && APP_MODULES.test(v.PkgPath ?? '');
  const fixed = app
    ? fixedVersion(v.InstalledVersion, v.FixedVersion)
    : v.FixedVersion;
  if (!fixed) return null;
  return {
    id: v.VulnerabilityID,
    severity,
    package: v.PkgName,
    installed: v.InstalledVersion,
    fixed,
    layer: app ? 'app' : 'base',
  };
}

/** High and Critical holes with a fix, from a Trivy JSON report. */
export function findings(report: TrivyReport): Finding[] {
  return (report.Results ?? []).flatMap((result) =>
    (result.Vulnerabilities ?? [])
      .map((v) => toFinding(result, v))
      .filter((f): f is Finding => f !== null),
  );
}

/** What the hotfix changes; the id is the same for the same holes. */
export function plan(report: TrivyReport): Plan {
  const found = findings(report);
  const wanted = new Map<string, string>();
  for (const f of found) {
    if (f.layer !== 'app') continue;
    const before = wanted.get(f.package);
    if (!before || compareVersions(f.fixed, before) > 0) {
      wanted.set(f.package, f.fixed);
    }
  }
  const packages = [...wanted]
    .map(([name, version]) => ({ name, version }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const base = found.some((f) => f.layer === 'base');
  if (found.length === 0) return { id: '', packages, base, findings: found };
  const key = [
    ...packages.map((p) => `${p.name}@${p.version}`),
    ...found
      .filter((f) => f.layer === 'base')
      .map((f) => `base:${f.id}`)
      .sort(),
  ].join('\n');
  const id = createHash('sha256').update(key).digest('hex').slice(0, 10);
  return { id, packages, base, findings: found };
}

interface PackageJson {
  dependencies?: Record<string, string>;
  pnpm?: { overrides?: Record<string, string>; [key: string]: unknown };
  [key: string]: unknown;
}

/**
 * Every older copy of the package gets the fixed version through a pnpm
 * override; a direct dependency also gets it in package.json, which pins
 * exact versions.
 */
export function pinPackages(
  pkg: PackageJson,
  fixes: readonly PackageFix[],
): PackageJson {
  const next: PackageJson = structuredClone(pkg);
  for (const fix of fixes) {
    if (next.dependencies && fix.name in next.dependencies) {
      next.dependencies[fix.name] = fix.version;
    }
    next.pnpm ??= {};
    next.pnpm.overrides ??= {};
    next.pnpm.overrides[`${fix.name}@<${fix.version}`] = fix.version;
  }
  return next;
}

/**
 * Packages of the plan that pnpm-lock.yaml still holds below their fixed
 * version, as "name@version".
 */
export function stillVulnerable(
  lock: string,
  fixes: readonly PackageFix[],
): string[] {
  const wanted = new Map(fixes.map((f) => [f.name, f.version]));
  const left = new Set<string>();
  const key = /^ {2}'?((?:@[^@/\s']+\/)?[^@\s'(]+)@(\d[^(':\s]*)/;
  for (const line of lock.split('\n')) {
    const m = key.exec(line);
    if (!m) continue;
    const [, name = '', version = ''] = m;
    const fixed = wanted.get(name);
    if (fixed && compareVersions(version, fixed) < 0) {
      left.add(`${name}@${version}`);
    }
  }
  return [...left].sort();
}

/** Pins every FROM of the base image to the digest. */
export function pinBase(dockerfile: string, digest: string): string {
  if (!/^sha256:[a-f0-9]{64}$/.test(digest)) {
    throw new Error(`Not an image digest: "${digest}"`);
  }
  const from = new RegExp(
    `^(FROM\\s+)${BASE_IMAGE.replace('.', '\\.')}(@sha256:[a-f0-9]{64})?(\\s)`,
    'gm',
  );
  if (!from.test(dockerfile)) {
    throw new Error(`The Dockerfile has no FROM ${BASE_IMAGE}.`);
  }
  return dockerfile.replace(from, `$1${BASE_IMAGE}@${digest}$3`);
}

/** Debian's security updates in the image that runs (Dockerfile). */
/** The upgrade, one Dockerfile line per entry, joined with " \\". */
const OS_UPGRADE = [
  String.raw`RUN apt-get update --error-on=any`,
  String.raw` && apt-get full-upgrade -y --no-install-recommends`,
  String.raw` && out="$(apt-get -s full-upgrade)"`,
  String.raw` && if ! printf '%s\n' "$out" | grep -qx '0 upgraded, 0 newly installed, 0 to remove and 0 not upgraded.'; then printf '%s\n' "$out" >&2; echo 'Debian updates were held back.' >&2; exit 1; fi`,
  String.raw` && rm -rf /var/lib/apt/lists/*`,
].join(' \\\n');

const OS_UPDATES = (id: string) => `ARG OS_UPDATES=sec-${id}\n${OS_UPGRADE}`;

/**
 * Sets the default of OS_UPDATES to the hotfix id, so the hotfix changes the
 * Dockerfile even when the base image digest is the same and its build
 * fetches Debian's security updates again. A release from before the OS
 * updates (26.11.19 and older) gets them right after `FROM … AS app`.
 */
export function markOsUpdates(dockerfile: string, id: string): string {
  if (!/^[a-f0-9]+$/.test(id)) throw new Error(`Not a hotfix id: "${id}"`);
  const arg = /^ARG OS_UPDATES=\S*$/m;
  if (arg.test(dockerfile)) {
    return dockerfile.replace(arg, `ARG OS_UPDATES=sec-${id}`);
  }
  const app = /^FROM \S+ AS app\n/m;
  if (!app.test(dockerfile)) {
    throw new Error('The Dockerfile has no stage "app".');
  }
  return dockerfile.replace(app, (from) => `${from}${OS_UPDATES(id)}\n`);
}

/** The German fragment for „Neuigkeiten“: no package names, no internals. */
export function fragment(): string {
  return [
    '---',
    'art: behoben',
    '---',
    '',
    'Sicherheitsupdate: eine bekannte Lücke in einer verwendeten Komponente ist geschlossen.',
    '',
  ].join('\n');
}

function apply(file: string, digest: string | undefined): number {
  const p = JSON.parse(readFileSync(file, 'utf8')) as Plan;
  if (!p.id) throw new Error('The plan is empty: nothing to apply.');
  if (p.packages.length > 0) {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as PackageJson;
    const pinned = pinPackages(pkg, p.packages);
    writeFileSync('package.json', `${JSON.stringify(pinned, null, 2)}\n`);
  }
  if (p.base) {
    if (!digest)
      throw new Error('The plan needs the digest of the base image.');
    const docker = readFileSync('Dockerfile', 'utf8');
    writeFileSync('Dockerfile', markOsUpdates(pinBase(docker, digest), p.id));
  }
  mkdirSync('changes', { recursive: true });
  writeFileSync(`changes/sicherheit-${p.id}.md`, fragment());
  return 0;
}

function main(): number {
  const [command, file, digest] = process.argv.slice(2);
  if (command === 'plan' && file) {
    const report = JSON.parse(readFileSync(file, 'utf8')) as TrivyReport;
    console.log(JSON.stringify(plan(report), null, 2));
    return 0;
  }
  if (command === 'apply' && file) return apply(file, digest);
  if (command === 'verify' && file) {
    const p = JSON.parse(readFileSync(file, 'utf8')) as Plan;
    const left = stillVulnerable(
      readFileSync('pnpm-lock.yaml', 'utf8'),
      p.packages,
    );
    if (left.length > 0) {
      console.error(`pnpm-lock.yaml still holds: ${left.join(', ')}`);
      return 1;
    }
    return 0;
  }
  console.error(
    'Usage: security-hotfix.ts plan <trivy.json> | apply <plan.json> [base-digest] | verify <plan.json>',
  );
  return 1;
}

if (import.meta.main) {
  try {
    process.exitCode = main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
