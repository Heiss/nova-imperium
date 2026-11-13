// The names of the missions (owner, 2026-11-12, #131), keyed by the stored
// mission id. Data only, German like the interface; catalog.ts builds
// `MISSION` from it. The display texts of the catalog entries live in
// src/features/<key>/texts.de.ts (#113); the mission names move into the
// mission folders with #116 (owner, 2026-11-13).
//
// Display texts are not mutation-tested: Stryker leaves this file out
// (stryker.config.json), because every text was a static mutant that
// reloaded all tests. Their exactness is guarded by the catalog and naming
// tests (catalog.test.ts, src/test/naming.test.ts, texts.test.ts).

export const MISSION_TEXT = {
  attack: 'Sturmangriff',
  transport: 'Versorgungsflug',
  spy: 'Auspex-Erkundung',
  colonize: 'Landnahme',
  deploy: 'Verlegung',
} as const;
