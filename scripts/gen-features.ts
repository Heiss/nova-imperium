// The index of the feature folders (okf/architecture/patterns.md, sections 10
// and 11; owner, 2026-11-13, #112). The server runs without a bundler
// (node src/server/main.ts), so there is no glob import: this script writes
// src/features/index.gen.ts and src/features/index.server.gen.ts, which are
// not checked in (.gitignore), from the folders it finds:
//
//   src/features/<key>/entry.ts                     an entry of the catalog
//   src/features/<key>/texts.de.ts                  its display texts (#113)
//   src/features/missions/<m>/rules.ts              a mission (#116)
//   src/features/missions/<m>/texts.de.ts           its name
//   src/features/missions/<m>/arrive.server.ts      its arrival, server only
//   src/features/<key>/lexicon.de.ts                what the article of the
//   src/features/missions/<m>/lexicon.de.ts         entry or mission adds in
//                                                   the Lexicanum (#285)
//
// The core sees the features only through index.gen.ts
// (.dependency-cruiser.cjs). The *.server.ts parts are not in it: the index
// is used by the browser too. They are listed in index.server.gen.ts
// (`MISSION_SERVERS`), which only src/server imports (owner, 2026-11-14).
// The lexicon parts are listed in lexicon.gen.ts (`LEXICON`,
// `MISSION_LEXICON`), which
// only the Lexicanum imports, so they load with its own chunk (#285, #242).
//
// The settings of a round (#283, #310): every file of src/core that exports
// `roundSettings` is listed in src/core/round-settings.gen.ts
// (`ROUND_ENTRIES`), which only src/core/round.ts imports, so a feature adds
// its settings in its own file and no shared list names it.
//
// The client features (#322): every file of src/client/features that exports
// `clientFeature` is listed in src/client/features/index.gen.ts
// (`CLIENT_FEATURES`), which only src/client/main.ts imports, so a feature
// adds its handlers in its own file and main.ts names none.
//
// The server features (#326): every file of src/server that exports
// `serverFeature` is listed in src/server/features.gen.ts (`SERVER_FEATURES`),
// which only src/server/game/dispatch.ts and state.ts import, so a feature
// adds its actions and its part of the state in its own file and neither
// names it.
//
// The repositories (#317): every file of src/server/db/repos that exports
// `repository` is listed in src/server/db/repos/repositories.gen.ts
// (`REPOSITORIES`), which only repos/index.ts imports, so a repository
// registers itself and no shared list names it; the type `Repositories` is
// derived from the list.
//
// The client views (#317): every file of src/client/views that exports
// `clientViews` is listed in src/client/views/views.gen.ts (`CLIENT_VIEWS`),
// which only views/mount.ts and views/index.ts import, so a view registers
// itself (key, mount function, menu entry) and no shared list names it.
//
// The boxes of „Optionen“ (#378): every file of src/client/views/options that
// exports `optionBoxes` is listed in src/client/views/options/boxes.gen.ts
// (`OPTION_BOXES`), which only views/options/boxes.ts imports, so a feature
// adds its box (key, order, section, component, data) in its own files and
// neither Options.svelte nor logic/options.ts names it.
//
// The pages of the Lexicanum (#426): every file of src/core/lexicon/pages that
// exports `lexiconPage` (its page and its place on the start page) is listed in
// src/core/lexicon/pages/pages.gen.ts (`LEXICON_PAGES`), which only
// pages/index.ts imports, so a page registers itself and no shared list names
// it; index.ts sorts the pages by their order.
//
// The round reset (#317): every file of src/server that exports `roundReset`
// (what a new round empties and what it keeps) is listed in
// src/server/round-reset.gen.ts (`ROUND_RESETS`), which only
// src/server/game/admin.ts imports.
//
// The inputs of the actions (#317): every file of src/core/actions that exports
// `actionInputs` is listed in src/core/actions.gen.ts (`ACTION_INPUTS`), which
// only src/core/action-types.ts imports; the type `ActionMap` is derived from
// the list, so the browser and the server check every action against it.
//
// The shapes of the state (#317): every file of src/core/state that exports the
// type `StateShape` (the keys one part of the state holds and their types) is
// listed in src/core/state.gen.ts, which only src/core/state.ts imports; the
// type of the state the browser gets is derived from it, and the server checks
// what each part builds against its shape.
//
//   node scripts/gen-features.ts
//        writes the indexes when they changed; package.json chains it
//        before start, test, typecheck, build and check (D2): no pre*
//        scripts and no tool hooks
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { runCli } from './cli.ts';

export const FEATURES_DIR = 'src/features';
export const INDEX_FILE = 'index.gen.ts';
export const SERVER_INDEX_FILE = 'index.server.gen.ts';
export const LEXICON_INDEX_FILE = 'lexicon.gen.ts';
/** Where the settings of a round are (#310), and the list of them. */
export const CORE_DIR = 'src/core';
export const ROUND_SETTINGS_FILE = 'round-settings.gen.ts';
/** The fixed name under which a file exports its settings of a round. */
const ROUND_EXPORT = /^export const roundSettings\b/m;
/** Where the client features are (#322), and the list of them. */
export const CLIENT_DIR = 'src/client/features';
export const CLIENT_FEATURES_FILE = 'index.gen.ts';
/** The fixed name under which a file exports a client feature. */
const CLIENT_EXPORT = /^export const clientFeature\b/m;
/** Where the server features are (#326), and the list of them. */
export const SERVER_DIR = 'src/server';
export const SERVER_FEATURES_FILE = 'features.gen.ts';
/** The fixed name under which a file exports a server feature. */
const SERVER_EXPORT = /^export const serverFeature\b/m;
/** Where the repositories are (#317), and the list of them. */
export const REPOS_DIR = 'src/server/db/repos';
export const REPOSITORIES_FILE = 'repositories.gen.ts';
/** The fixed name under which a file exports its repository. */
const REPOSITORY_EXPORT = /^export const repository\b/m;
/** Where the client views are (#317), and the list of them. */
export const VIEWS_DIR = 'src/client/views';
export const CLIENT_VIEWS_FILE = 'views.gen.ts';
/** The fixed name under which a file exports its views. */
const VIEWS_EXPORT = /^export const clientViews\b/m;
/** Where the boxes of „Optionen“ are (#378), and the list of them. */
export const OPTION_BOXES_DIR = 'src/client/views/options';
export const OPTION_BOXES_FILE = 'boxes.gen.ts';
/** The fixed name under which a file exports its boxes of „Optionen“. */
const OPTION_BOXES_EXPORT = /^export const optionBoxes\b/m;
/** Where the pages of the Lexicanum are (#426), and the list of them. */
export const LEXICON_PAGES_DIR = 'src/core/lexicon/pages';
export const LEXICON_PAGES_FILE = 'pages.gen.ts';
/** The fixed name under which a file exports its page of the Lexicanum. */
const LEXICON_PAGE_EXPORT = /^export const lexiconPage\b/m;
/** The list of the round resets (#317) is in the server folder, next to the server features. */
export const ROUND_RESET_FILE = 'round-reset.gen.ts';
/** The fixed name under which a file exports what a new round empties or keeps. */
const ROUND_RESET_EXPORT = /^export const roundReset\b/m;
/** Where the inputs of the actions are (#317), and the list of them. */
export const ACTIONS_DIR = 'src/core';
export const ACTION_INPUTS_FILE = 'actions.gen.ts';
/** The fixed name under which a file declares the inputs of its actions. */
const ACTION_INPUTS_EXPORT = /^export const actionInputs\b/m;
/** The list of the shapes of the state (#317) is in the core folder, next to the inputs of the actions. */
export const STATE_SHAPES_FILE = 'state.gen.ts';
/** The fixed name under which a file declares the shape of its part of the state. */
const STATE_SHAPE_EXPORT = /^export type StateShape\b/m;
/** The optional part of an entry folder for the Lexicanum (#285). */
const LEXICON_FILE = 'lexicon.de.ts';
const MISSIONS = 'missions';
const KEY = /^[a-z][a-zA-Z0-9]*$/;
/** Every entry folder holds its rules and its texts (#113). */
const ENTRY_FILES = ['entry.ts', 'texts.de.ts'] as const;
/** Every mission folder holds its rules, its name and its arrival (#116). */
const MISSION_FILES = ['rules.ts', 'texts.de.ts', 'arrive.server.ts'] as const;

/** The folders of the index: the keys of the entries and of the missions. */
export interface Features {
  entries: string[];
  missions: string[];
}

/** The sorted subfolders of a folder that each hold all `files`; none if it is missing. */
function folders(
  dir: string,
  files: readonly string[],
  skip?: string,
): string[] {
  if (!existsSync(dir)) return [];
  const keys = readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== skip)
    .map((d) => d.name)
    .sort();
  for (const key of keys) {
    if (!KEY.test(key))
      throw new Error(
        `${dir}/${key}: a feature folder is named by its key (${KEY.source}).`,
      );
    for (const file of files)
      if (!existsSync(join(dir, key, file)))
        throw new Error(`${dir}/${key} has no ${file}.`);
  }
  return keys;
}

/** The entries and missions in a features folder. */
export function scan(dir: string): Features {
  return {
    entries: folders(dir, ENTRY_FILES, MISSIONS),
    missions: folders(join(dir, MISSIONS), MISSION_FILES),
  };
}

// A list of [key, module] pairs, not an object: knip sees a module passed on
// as a whole and does not report its exports as unused.
function list(name: string, keys: string[], prefix: string): string {
  if (keys.length === 0) return `export const ${name} = [] as const;\n`;
  const rows = keys.map((k) => `  ['${k}', ${prefix}_${k}],\n`).join('');
  return `export const ${name} = [\n${rows}] as const;\n`;
}

const HEADER =
  '// Generated by scripts/gen-features.ts; not checked in, do not edit.\n';

/**
 * The source of the index: per entry folder an import of its rules and of its
 * texts, per mission one of its rules and of its name, and one pair in each
 * list, sorted by key.
 */
export function render({ entries, missions }: Features): string {
  const imports = [
    ...entries.map((k) => `import * as entry_${k} from './${k}/entry.ts';\n`),
    ...entries.map(
      (k) => `import * as texts_${k} from './${k}/texts.de.ts';\n`,
    ),
    ...missions.map(
      (m) => `import * as mission_${m} from './${MISSIONS}/${m}/rules.ts';\n`,
    ),
    ...missions.map(
      (m) =>
        `import * as mission_texts_${m} from './${MISSIONS}/${m}/texts.de.ts';\n`,
    ),
  ].join('');
  return [
    HEADER,
    ...(imports ? [imports] : []),
    list('ENTRIES', entries, 'entry'),
    list('TEXTS', entries, 'texts'),
    list('MISSIONS', missions, 'mission'),
    list('MISSION_TEXTS', missions, 'mission_texts'),
  ].join('\n');
}

/** The source of the server index: per mission an import of its arrival. */
export function renderServer({ missions }: Features): string {
  const imports = missions
    .map(
      (m) =>
        `import * as server_${m} from './${MISSIONS}/${m}/arrive.server.ts';\n`,
    )
    .join('');
  return [
    HEADER,
    ...(imports ? [imports] : []),
    list('MISSION_SERVERS', missions, 'server'),
  ].join('\n');
}

/**
 * The source of the lexicon index: per entry folder and per mission folder
 * with a lexicon part an import of it, listed by key (#285).
 */
export function renderLexicon(
  dir: string,
  { entries, missions }: Features,
): string {
  const keys = entries.filter((k) => existsSync(join(dir, k, LEXICON_FILE)));
  const flights = missions.filter((m) =>
    existsSync(join(dir, MISSIONS, m, LEXICON_FILE)),
  );
  const imports = [
    ...keys.map(
      (k) => `import * as lexicon_${k} from './${k}/${LEXICON_FILE}';\n`,
    ),
    ...flights.map(
      (m) =>
        `import * as mission_lexicon_${m} from './${MISSIONS}/${m}/${LEXICON_FILE}';\n`,
    ),
  ].join('');
  return [
    HEADER,
    ...(imports ? [imports] : []),
    list('LEXICON', keys, 'lexicon'),
    list('MISSION_LEXICON', flights, 'mission_lexicon'),
  ].join('\n');
}

/** Writes the index of a features folder when it changed; true if it did. */
export function generate(dir: string): boolean {
  return write(join(dir, INDEX_FILE), render(scan(dir)));
}

/** Writes the server index of a features folder when it changed; true if it did. */
export function generateServer(dir: string): boolean {
  return write(join(dir, SERVER_INDEX_FILE), renderServer(scan(dir)));
}

/** Writes the lexicon index of a features folder when it changed; true if it did. */
export function generateLexicon(dir: string): boolean {
  return write(join(dir, LEXICON_INDEX_FILE), renderLexicon(dir, scan(dir)));
}

/** The files of a core folder that export `roundSettings` (#310). */
export const scanRoundSettings = (dir: string): string[] =>
  scanExporting(dir, ROUND_EXPORT);

/** The files of the client folder that export `clientFeature` (#322). */
export const scanClientFeatures = (dir: string): string[] =>
  scanExporting(dir, CLIENT_EXPORT);

/** The files of the server folder that export `serverFeature` (#326). */
export const scanServerFeatures = (dir: string): string[] =>
  scanExporting(dir, SERVER_EXPORT);

/**
 * The files of a folder that export a fixed name (`pattern`), sorted, with
 * `/` in the path: not a test, not a generated file.
 */
function scanExporting(dir: string, pattern: RegExp): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter(
      (e) =>
        e.isFile() &&
        e.name.endsWith('.ts') &&
        !e.name.endsWith('.test.ts') &&
        !e.name.endsWith('.gen.ts'),
    )
    .map((e) => relative(dir, join(e.parentPath, e.name)).split(sep).join('/'))
    .filter((file) => pattern.test(readFileSync(join(dir, file), 'utf8')))
    .sort();
}

/**
 * The source of the list of the settings: one import of the settings and of
 * their heading per file (#357), one spread per file, and one section per file
 * with its heading, which the admin panel shows the settings under.
 */
export function renderRoundSettings(files: string[]): string {
  const id = (file: string) =>
    file.replace(/\.ts$/, '').replace(/[^a-zA-Z0-9]/g, '_');
  const imports = files
    .map(
      (f) =>
        `import { roundHeading as heading_${id(f)}, roundSettings as settings_${id(f)} } from './${f}';\n`,
    )
    .join('');
  const rows = files.map((f) => `  ...settings_${id(f)},\n`).join('');
  const sections = files
    .map(
      (f) => `  { heading: heading_${id(f)}, settings: settings_${id(f)} },\n`,
    )
    .join('');
  return [
    HEADER,
    ...(imports ? [imports] : []),
    files.length === 0
      ? 'export const ROUND_ENTRIES = [] as const;\n'
      : `export const ROUND_ENTRIES = [\n${rows}] as const;\n`,
    files.length === 0
      ? 'export const ROUND_SECTIONS = [] as const;\n'
      : `export const ROUND_SECTIONS = [\n${sections}] as const;\n`,
  ].join('\n');
}

/** Writes the list of the settings of a round when it changed; true if it did. */
export function generateRoundSettings(dir: string): boolean {
  return write(
    join(dir, ROUND_SETTINGS_FILE),
    renderRoundSettings(scanRoundSettings(dir)),
  );
}

/**
 * The source of a list of features: one import of `exported` per file and
 * one `[name, feature]` pair in `list`, sorted by file name; the name is the
 * path without `.ts`.
 */
function renderFeatureList(
  files: string[],
  exported: string,
  list: string,
): string {
  const bare = (file: string) => file.replace(/\.ts$/, '');
  const name = (file: string) =>
    `feature_${bare(file).replace(/[^a-zA-Z0-9]/g, '_')}`;
  const imports = files
    .map((f) => `import { ${exported} as ${name(f)} } from './${f}';\n`)
    .join('');
  const rows = files.map((f) => `  ['${bare(f)}', ${name(f)}],\n`).join('');
  return [
    HEADER,
    ...(imports ? [imports] : []),
    files.length === 0
      ? `export const ${list} = [] as const;\n`
      : `export const ${list} = [\n${rows}] as const;\n`,
  ].join('\n');
}

/** The source of the list of the client features (#322). */
export const renderClientFeatures = (files: string[]): string =>
  renderFeatureList(files, 'clientFeature', 'CLIENT_FEATURES');

/** Writes the list of the client features when it changed; true if it did. */
export function generateClientFeatures(dir: string): boolean {
  return write(
    join(dir, CLIENT_FEATURES_FILE),
    renderClientFeatures(scanClientFeatures(dir)),
  );
}

/** The source of the list of the server features (#326). */
export const renderServerFeatures = (files: string[]): string =>
  renderFeatureList(files, 'serverFeature', 'SERVER_FEATURES');

/** Writes the list of the server features when it changed; true if it did. */
export function generateServerFeatures(dir: string): boolean {
  return write(
    join(dir, SERVER_FEATURES_FILE),
    renderServerFeatures(scanServerFeatures(dir)),
  );
}

/** The files of the repository folder that export `repository` (#317). */
export const scanRepositories = (dir: string): string[] =>
  scanExporting(dir, REPOSITORY_EXPORT);

/** The source of the list of the repositories (#317). */
export const renderRepositories = (files: string[]): string =>
  renderFeatureList(files, 'repository', 'REPOSITORIES');

/** Writes the list of the repositories when it changed; true if it did. */
export function generateRepositories(dir: string): boolean {
  return write(
    join(dir, REPOSITORIES_FILE),
    renderRepositories(scanRepositories(dir)),
  );
}

/** The files of the views folder that export `clientViews` (#317). */
export const scanClientViews = (dir: string): string[] =>
  scanExporting(dir, VIEWS_EXPORT);

/** The source of the list of the client views (#317). */
export const renderClientViews = (files: string[]): string =>
  renderFeatureList(files, 'clientViews', 'CLIENT_VIEWS');

/** Writes the list of the client views when it changed; true if it did. */
export function generateClientViews(dir: string): boolean {
  return write(
    join(dir, CLIENT_VIEWS_FILE),
    renderClientViews(scanClientViews(dir)),
  );
}

/** The files of the folder of the boxes of „Optionen“ that export `optionBoxes` (#378). */
export const scanOptionBoxes = (dir: string): string[] =>
  scanExporting(dir, OPTION_BOXES_EXPORT);

/** The source of the list of the boxes of „Optionen“ (#378). */
export const renderOptionBoxes = (files: string[]): string =>
  renderFeatureList(files, 'optionBoxes', 'OPTION_BOXES');

/** Writes the list of the boxes of „Optionen“ when it changed; true if it did. */
export function generateOptionBoxes(dir: string): boolean {
  return write(
    join(dir, OPTION_BOXES_FILE),
    renderOptionBoxes(scanOptionBoxes(dir)),
  );
}

/** The files of the folder of the Lexicanum pages that export `lexiconPage` (#426). */
export const scanLexiconPages = (dir: string): string[] =>
  scanExporting(dir, LEXICON_PAGE_EXPORT);

/** The source of the list of the pages of the Lexicanum (#426). */
export const renderLexiconPages = (files: string[]): string =>
  renderFeatureList(files, 'lexiconPage', 'LEXICON_PAGES');

/** Writes the list of the pages of the Lexicanum when it changed; true if it did. */
export function generateLexiconPages(dir: string): boolean {
  return write(
    join(dir, LEXICON_PAGES_FILE),
    renderLexiconPages(scanLexiconPages(dir)),
  );
}

/** The files of the server folder that export `roundReset` (#317). */
export const scanRoundResets = (dir: string): string[] =>
  scanExporting(dir, ROUND_RESET_EXPORT);

/** The source of the list of the round resets (#317). */
export const renderRoundResets = (files: string[]): string =>
  renderFeatureList(files, 'roundReset', 'ROUND_RESETS');

/** Writes the list of the round resets when it changed; true if it did. */
export function generateRoundResets(dir: string): boolean {
  return write(
    join(dir, ROUND_RESET_FILE),
    renderRoundResets(scanRoundResets(dir)),
  );
}

/** The files of the core folder that export `actionInputs` (#317). */
export const scanActionInputs = (dir: string): string[] =>
  scanExporting(dir, ACTION_INPUTS_EXPORT);

/** The source of the list of the inputs of the actions (#317). */
export const renderActionInputs = (files: string[]): string =>
  renderFeatureList(files, 'actionInputs', 'ACTION_INPUTS');

/** Writes the list of the inputs of the actions when it changed; true if it did. */
export function generateActionInputs(dir: string): boolean {
  return write(
    join(dir, ACTION_INPUTS_FILE),
    renderActionInputs(scanActionInputs(dir)),
  );
}

/** The files of the core folder that export the type `StateShape` (#317). */
export const scanStateShapes = (dir: string): string[] =>
  scanExporting(dir, STATE_SHAPE_EXPORT);

/** The source of the type of the whole state: the shapes of all parts together (#317). */
export function renderStateShapes(files: string[]): string {
  const name = (file: string) =>
    `shape_${file.replace(/\.ts$/, '').replace(/[^a-zA-Z0-9]/g, '_')}`;
  const imports = files
    .map((f) => `import type { StateShape as ${name(f)} } from './${f}';\n`)
    .join('');
  return [
    HEADER,
    ...(imports ? [imports] : []),
    `export type FullState = ${files.length ? files.map(name).join(' & ') : 'unknown'};\n`,
  ].join('\n');
}

/** Writes the type of the whole state when it changed; true if it did. */
export function generateStateShapes(dir: string): boolean {
  return write(
    join(dir, STATE_SHAPES_FILE),
    renderStateShapes(scanStateShapes(dir)),
  );
}

function write(file: string, source: string): boolean {
  const dir = dirname(file);
  if (existsSync(file) && readFileSync(file, 'utf8') === source) return false;
  mkdirSync(dir, { recursive: true });
  // Written next to it and renamed: two starts at once never read half a file.
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, source);
  renameSync(tmp, file);
  return true;
}

if (import.meta.main)
  runCli(() => {
    generate(FEATURES_DIR);
    generateServer(FEATURES_DIR);
    generateLexicon(FEATURES_DIR);
    generateRoundSettings(CORE_DIR);
    generateClientFeatures(CLIENT_DIR);
    generateServerFeatures(SERVER_DIR);
    generateRepositories(REPOS_DIR);
    generateRoundResets(SERVER_DIR);
    generateClientViews(VIEWS_DIR);
    generateOptionBoxes(OPTION_BOXES_DIR);
    generateLexiconPages(LEXICON_PAGES_DIR);
    generateActionInputs(ACTIONS_DIR);
    generateStateShapes(ACTIONS_DIR);
    return 0;
  });
