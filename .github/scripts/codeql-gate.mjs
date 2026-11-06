// Fails when CodeQL found a problem of security severity "high" or above
// (security-severity >= 7.0) or a result of level "error".
//   node .github/scripts/codeql-gate.mjs <folder with .sarif files>
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const dir = process.argv[2] ?? 'sarif';
let blocking = 0;
for (const file of readdirSync(dir).filter((f) => f.endsWith('.sarif'))) {
  const sarif = JSON.parse(readFileSync(path.join(dir, file), 'utf8'));
  for (const run of sarif.runs ?? []) {
    const rules = new Map();
    for (const tool of [run.tool?.driver, ...(run.tool?.extensions ?? [])])
      for (const rule of tool?.rules ?? []) rules.set(rule.id, rule);
    for (const result of run.results ?? []) {
      const rule = rules.get(result.ruleId);
      const severity = Number(rule?.properties?.['security-severity'] ?? 0);
      const level = result.level ?? rule?.defaultConfiguration?.level;
      if (severity < 7 && level !== 'error') continue;
      blocking++;
      const where = result.locations?.[0]?.physicalLocation;
      console.log(
        `${result.ruleId} (severity ${severity || level}): ${where?.artifactLocation?.uri}:${where?.region?.startLine} ${result.message?.text ?? ''}`,
      );
    }
  }
}
console.log(`${blocking} blocking CodeQL finding(s)`);
process.exit(blocking > 0 ? 1 : 0);
