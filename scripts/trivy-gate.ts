// The Trivy gate of the CI (owner, 2026-11-12). Trivy writes JSON reports
// with only the blocking severities and only holes that have a fix; this
// script decides.
//
//   node scripts/trivy-gate.ts <image.json>              every hole blocks
//        (release pull requests, hotfixes, pushes)
//   node scripts/trivy-gate.ts <image.json> <base.json>  only holes the
//        base branch's image does not have block (other pull requests), so
//        two pull requests that each fix one of two holes do not block
//        each other
import { readFileSync } from 'node:fs';

interface Vulnerability {
  VulnerabilityID: string;
  PkgName: string;
  PkgPath?: string;
  InstalledVersion?: string;
  FixedVersion?: string;
  Severity?: string;
}
export interface Report {
  Results?:
    { Target: string; Vulnerabilities?: Vulnerability[] | null }[] | null;
}

export interface Hole {
  key: string;
  line: string;
}

/** Every hole with a fix in a report, keyed by id, package and place. */
export function holes(report: Report): Hole[] {
  const found: Hole[] = [];
  for (const result of report.Results ?? []) {
    for (const v of result.Vulnerabilities ?? []) {
      if (!v.FixedVersion) continue;
      const place = v.PkgPath || result.Target;
      found.push({
        key: `${v.VulnerabilityID} ${v.PkgName} ${place}`,
        line: `${v.Severity ?? '?'} ${v.VulnerabilityID}: ${v.PkgName} ${v.InstalledVersion ?? '?'} → ${v.FixedVersion} (${place})`,
      });
    }
  }
  return found;
}

/** The holes that block: all of them, or those the base does not have. */
export function blocking(image: Report, base?: Report): Hole[] {
  const known = new Set(base ? holes(base).map((h) => h.key) : []);
  return holes(image).filter((h) => !known.has(h.key));
}

function main(): number {
  const [imageFile, baseFile] = process.argv.slice(2);
  if (!imageFile) {
    console.error('Usage: trivy-gate.ts <image.json> [base.json]');
    return 1;
  }
  const read = (file: string) =>
    JSON.parse(readFileSync(file, 'utf8')) as Report;
  const base = baseFile ? read(baseFile) : undefined;
  const block = blocking(read(imageFile), base);
  const known = base ? holes(read(imageFile)).length - block.length : 0;
  if (known > 0) {
    console.log(
      `${known} hole(s) are in the base branch too and do not block this pull request.`,
    );
  }
  if (block.length === 0) {
    console.log('No blocking hole.');
    return 0;
  }
  console.error(
    base ? 'Holes this pull request brings in:' : 'Holes in the image:',
  );
  for (const h of block) console.error(`- ${h.line}`);
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
