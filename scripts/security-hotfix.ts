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
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

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

/** Compares two versions numerically, part by part ("1.10.0" > "1.9.2"). */
export function compareVersions(a: string, b: string): number {
  const parts = (v: string) =>
    v
      .replace(/^v/, '')
      .split(/[.+-]/)
      .map((p) => (/^\d+$/.test(p) ? Number(p) : p));
  const pa = parts(a);
  const pb = parts(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x === y) continue;
    if (typeof x === 'number' && typeof y === 'number') return x - y;
    return String(x) < String(y) ? -1 : 1;
  }
  return 0;
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

/** GitHub's rating (GHSA) for npm packages, Trivy's rating otherwise. */
export function severityOf(v: TrivyVulnerability): string {
  const ghsa = v.VendorSeverity?.ghsa;
  return ghsa === undefined ? v.Severity : (VENDOR[ghsa] ?? v.Severity);
}

/** One hole as a finding, or null when it does not start a hotfix. */
function toFinding(result: TrivyResult, v: TrivyVulnerability): Finding | null {
  const severity = severityOf(v);
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
 * A direct dependency gets the fixed version (package.json pins exact
 * versions); any other package an override for every older version.
 */
export function pinPackages(
  pkg: PackageJson,
  fixes: readonly PackageFix[],
): PackageJson {
  const next: PackageJson = structuredClone(pkg);
  for (const fix of fixes) {
    if (next.dependencies && fix.name in next.dependencies) {
      next.dependencies[fix.name] = fix.version;
    } else {
      next.pnpm ??= {};
      next.pnpm.overrides ??= {};
      next.pnpm.overrides[`${fix.name}@<${fix.version}`] = fix.version;
    }
  }
  return next;
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
    writeFileSync('Dockerfile', pinBase(docker, digest));
  }
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
  console.error(
    'Usage: security-hotfix.ts plan <trivy.json> | apply <plan.json> [base-digest]',
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
