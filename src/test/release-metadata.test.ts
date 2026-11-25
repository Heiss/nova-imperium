// The readers of the metadata files of a release (#387, owner, 2026-11-24,
// 77a). A release pull request changes only VERSION, CHANGELOG.md and
// changes/, and the push run of its merge takes over the results of the
// commit before it (scripts/already-tested.ts): only the files that read
// the metadata could give another result on the release commit. This guard
// lists every file of the code, the tests, the scripts, the image and the
// workflows that names one of them, with what it does with it; a new one
// fails until it is listed, so whoever adds a reader decides whether the
// takeover still holds (the night runs everything again).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { METADATA, isMetadata } from '../../scripts/already-tested.ts';

/** Every file that names a metadata file, and what it does with it. */
const READERS: Record<string, string> = {
  '.github/workflows/ci.yml':
    'refuses other files in a release pull request; a fragment check',
  '.github/workflows/release-pr.yml': 'builds the release pull request',
  '.github/workflows/release.yml':
    'the image and the notes of a tag, after the release',
  '.github/workflows/tag.yml': 'tags a commit that changed VERSION',
  '.github/workflows/next-image.yml':
    'writes the short commit into VERSION of the image „next“',
  Dockerfile: 'copies CHANGELOG.md and VERSION into the image',
  'e2e/news-maintenance.spec.ts':
    '„Neuigkeiten“ against CHANGELOG.md (runs every night)',
  'scripts/already-tested.ts': 'the list of the metadata files itself',
  'scripts/changelog.ts': 'writes the section and VERSION, checks fragments',
  'scripts/release-pr.sh': 'builds the release pull request',
  'scripts/release.sh': 'tags the version in VERSION',
  'scripts/security-hotfix.ts': 'writes the fragment of a security hotfix',
  'src/client/logic/news.ts': 'a comment: the news come from the server',
  'src/server/http/app.ts': 'a comment: the news route',
  'src/server/news.test.ts': 'the news parser on fixed texts',
  'src/server/news.ts': 'reads CHANGELOG.md and VERSION at the start',
  'src/server/server.ts': 'a comment: the files of the image',
  'src/test/already-tested.test.ts': 'the takeover of the parent',
  'src/test/changelog.test.ts': 'the fragment and release commands',
  'src/test/ci-release.test.ts': 'the metadata-only release pull request',
  'src/test/mutation-changes.test.ts': 'a fragment is no mutated file',
  'src/test/hotfix-back.test.ts':
    'the merge-back of a hotfix: VERSION as a conflict and after a squash',
  'src/test/release-guards.test.ts':
    'the release head: VERSION against tags and other release branches',
  'src/test/release-pr.test.ts': 'the release pull request script',
  'src/test/release-tag.test.ts': 'the tag of a version a hotfix took first',
};

const ROOTS = [
  'src',
  'e2e',
  'scripts',
  'docker',
  'Dockerfile',
  '.github/workflows',
];
const NAMES = /\bVERSION\b|CHANGELOG\.md|\bchanges\//;
const SELF = 'src/test/release-metadata.test.ts';

/** Every file below <root>, or <root> itself. */
function filesOf(root: string): string[] {
  if (!statSync(root, { throwIfNoEntry: false })) return [];
  if (statSync(root).isFile()) return [root];
  return readdirSync(root, { recursive: true, encoding: 'utf8' })
    .map((f) => path.join(root, f))
    .filter((f) => statSync(f).isFile());
}

describe('the readers of the metadata files of a release (#387)', () => {
  it('are the listed ones: a new reader decides whether the push of a release may take over the commit before', () => {
    const found = ROOTS.flatMap(filesOf)
      .filter((f) => f !== SELF && NAMES.test(readFileSync(f, 'utf8')))
      .sort();
    expect(found).toEqual(Object.keys(READERS).sort());
  });

  it('are the files the takeover leaves out, and no other', () => {
    expect(METADATA).toEqual(['VERSION', 'CHANGELOG.md', 'changes/']);
    expect(isMetadata('changes/x.md')).toBe(true);
    expect(isMetadata('src/server/news.ts')).toBe(false);
  });
});
