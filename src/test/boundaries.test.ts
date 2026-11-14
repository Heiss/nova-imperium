// The boundary rules of .dependency-cruiser.cjs (okf/architecture/patterns.md,
// section 11; #112), checked on a small project in a temporary folder: each
// deliberate violation fails, the allowed imports pass.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { cruise, type ICruiseResult } from 'dependency-cruiser';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const config = createRequire(import.meta.url)('../../.dependency-cruiser.cjs');

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'nova-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

/** Writes the files, each importing the listed ones by their path in src. */
function project(files: Record<string, string[]>): void {
  for (const [file, imports] of Object.entries(files)) {
    const at = path.join(dir, file);
    mkdirSync(path.dirname(at), { recursive: true });
    const lines = imports.map((target) => {
      let rel = path.relative(path.dirname(file), target);
      if (!rel.startsWith('.')) rel = `./${rel}`;
      return `import '${rel}';\n`;
    });
    writeFileSync(at, `${lines.join('')}export const x = 1;\n`);
  }
}

/** The violations as "rule: from -> to", for the files written by project(). */
async function violations(files: Record<string, string[]>): Promise<string[]> {
  project(files);
  const { output } = await cruise(['src'], {
    baseDir: dir,
    validate: true,
    ruleSet: { forbidden: config.forbidden },
    tsPreCompilationDeps: true,
  });
  return (output as ICruiseResult).summary.violations
    .map((v) => `${v.rule.name}: ${v.from} -> ${v.to}`)
    .sort();
}

const CORE = 'src/core/economy.ts';
const INDEX = 'src/features/index.gen.ts';

describe('the boundaries of the feature folders (#112)', () => {
  it('lets a feature import the core and its own files', async () => {
    expect(
      await violations({
        [CORE]: [],
        'src/features/sat/entry.ts': [CORE, 'src/features/sat/power.ts'],
        'src/features/sat/power.ts': [CORE],
        'src/features/missions/spy/rules.ts': [CORE],
      }),
    ).toEqual([]);
  });

  it('forbids a feature to import another feature or the index', async () => {
    expect(
      await violations({
        'src/features/sat/entry.ts': ['src/features/metal/entry.ts'],
        'src/features/metal/entry.ts': [],
        'src/features/missions/spy/rules.ts': [
          'src/features/missions/attack/rules.ts',
          'src/features/metal/entry.ts',
        ],
        'src/features/missions/attack/rules.ts': [],
        'src/features/probe/entry.ts': [
          'src/features/missions/attack/rules.ts',
          INDEX,
        ],
        [INDEX]: [],
      }),
    ).toEqual([
      'feature-not-feature: src/features/missions/spy/rules.ts -> src/features/metal/entry.ts',
      'feature-not-feature: src/features/missions/spy/rules.ts -> src/features/missions/attack/rules.ts',
      'feature-not-feature: src/features/probe/entry.ts -> src/features/index.gen.ts',
      'feature-not-feature: src/features/probe/entry.ts -> src/features/missions/attack/rules.ts',
      'feature-not-feature: src/features/sat/entry.ts -> src/features/metal/entry.ts',
    ]);
  });

  it('lets the core see the features only through the generated index', async () => {
    expect(
      await violations({
        'src/core/catalog.ts': [INDEX],
        'src/core/settle.ts': ['src/features/sat/entry.ts'],
        [INDEX]: ['src/features/sat/entry.ts'],
        'src/features/sat/entry.ts': [],
      }),
    ).toEqual([
      'core-sees-features-through-index: src/core/settle.ts -> src/features/sat/entry.ts',
    ]);
  });

  it('keeps the *.server.ts parts on the server', async () => {
    const part = 'src/features/missions/spy/arrive.server.ts';
    expect(
      await violations({
        [part]: ['src/server/game/context.ts'],
        'src/server/game/context.ts': [],
        'src/server/game/arrival.ts': [part],
        'src/features/missions/spy/log.server.ts': [part],
        'src/features/sat/produce.server.ts': [],
        'src/features/missions/spy/arrive.server.test.ts': [part],
        'src/features/missions/spy/rules.ts': [part],
        'src/core/battle.ts': [part],
        'src/client/main.ts': ['src/features/sat/produce.server.ts'],
      }),
    ).toEqual([
      'core-sees-features-through-index: src/core/battle.ts -> src/features/missions/spy/arrive.server.ts',
      'server-parts-on-server: src/client/main.ts -> src/features/sat/produce.server.ts',
      'server-parts-on-server: src/core/battle.ts -> src/features/missions/spy/arrive.server.ts',
      'server-parts-on-server: src/features/missions/spy/rules.ts -> src/features/missions/spy/arrive.server.ts',
    ]);
  });

  it('keeps the index of the server parts on the server (#116)', async () => {
    const SERVERS = 'src/features/index.server.gen.ts';
    const part = 'src/features/missions/spy/arrive.server.ts';
    expect(
      await violations({
        [SERVERS]: [part],
        [part]: [],
        'src/server/game/arrival.ts': [SERVERS],
        'src/server/game/arrival.test.ts': [SERVERS],
        'src/core/missions.ts': [SERVERS],
        'src/client/main.ts': [SERVERS],
        'src/features/missions/spy/spy.test.ts': [SERVERS],
        'src/features/missions/spy/log.server.ts': [SERVERS],
      }),
    ).toEqual([
      'core-sees-features-through-index: src/core/missions.ts -> src/features/index.server.gen.ts',
      'feature-not-feature: src/features/missions/spy/log.server.ts -> src/features/index.server.gen.ts',
      'feature-not-feature: src/features/missions/spy/spy.test.ts -> src/features/index.server.gen.ts',
      'server-index-on-server: src/client/main.ts -> src/features/index.server.gen.ts',
      'server-index-on-server: src/core/missions.ts -> src/features/index.server.gen.ts',
      'server-index-on-server: src/features/missions/spy/log.server.ts -> src/features/index.server.gen.ts',
      'server-index-on-server: src/features/missions/spy/spy.test.ts -> src/features/index.server.gen.ts',
    ]);
  });

  it('keeps the other files of a feature free of server and browser code', async () => {
    expect(
      await violations({
        'src/features/sat/entry.ts': ['src/server/game/context.ts'],
        'src/features/sat/view.ts': ['src/client/main.ts'],
        'src/features/sat/produce.server.ts': ['src/server/game/context.ts'],
        'src/features/sat/sat.test.ts': ['src/server/game/context.ts'],
        'src/features/sat/load.server.ts': ['src/client/main.ts'],
        'src/server/game/context.ts': [],
        'src/client/main.ts': [],
      }),
    ).toEqual([
      'feature-stays-pure: src/features/sat/entry.ts -> src/server/game/context.ts',
      'feature-stays-pure: src/features/sat/view.ts -> src/client/main.ts',
      'server-not-client: src/features/sat/load.server.ts -> src/client/main.ts',
    ]);
  });

  it('keeps the rules that were there before', async () => {
    expect(
      await violations({
        'src/core/economy.ts': ['src/server/db/store.ts'],
        'src/client/main.ts': ['src/server/db/store.ts'],
        'src/server/db/store.ts': [],
        'src/server/web-push.ts': ['src/client/sw.ts'],
        'src/client/sw.ts': [],
      }),
    ).toEqual([
      'client-not-server: src/client/main.ts -> src/server/db/store.ts',
      'core-stays-pure: src/core/economy.ts -> src/server/db/store.ts',
      'server-not-client: src/server/web-push.ts -> src/client/sw.ts',
    ]);
  });
});
