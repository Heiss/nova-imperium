// The 20 migrations from before the IDs (#213), each imported here, so its
// file is checked on its own: its ID is its file name, its number its old
// place, and its SQL never changes (SHA-256 of the SQL of main, checked
// against main by script on 2026-11-16, like the checksums of Flyway).
// Static imports also tie each file to this test for Stryker.
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import * as m01 from './migrations/legacy/20261106T2104-first-schema.ts';
import * as m02 from './migrations/legacy/20261107T0911-account-tokens.ts';
import * as m03 from './migrations/legacy/20261107T0924-guilds.ts';
import * as m04 from './migrations/legacy/20261107T0945-push.ts';
import * as m05 from './migrations/legacy/20261107T1403-achievements.ts';
import * as m06 from './migrations/legacy/20261107T1417-admin-audit.ts';
import * as m07 from './migrations/legacy/20261107T1556-announcement-text.ts';
import * as m08 from './migrations/legacy/20261107T1556-passkeys.ts';
import * as m09 from './migrations/legacy/20261108T1207-colonization.ts';
import * as m10 from './migrations/legacy/20261112T1613-explanation-texts.ts';
import * as m11 from './migrations/legacy/20261112T1652-research-planet.ts';
import * as m12 from './migrations/legacy/20261112T2219-error-log.ts';
import * as m13 from './migrations/legacy/20261113T0006-deploy-mission.ts';
import * as m14 from './migrations/legacy/20261113T1126-planet-fields.ts';
import * as m15 from './migrations/legacy/20261113T2315-places.ts';
import * as m16 from './migrations/legacy/20261114T1315-harvest-mission.ts';
import * as m17 from './migrations/legacy/20261114T1638-push-kinds.ts';
import * as m18 from './migrations/legacy/20261114T1809-gift-fleet.ts';
import * as m19 from './migrations/legacy/20261114T1856-guild-ranks.ts';
import * as m20 from './migrations/legacy/20261115T0952-guild-chat.ts';
import { MIGRATIONS } from './schema.ts';

const FILES = [
  [
    m01,
    '20261106T2104-first-schema',
    '5154d73b202ffe5e80a3abc3add77edae1e00817f07d098ab2a917617c07bf4a',
  ],
  [
    m02,
    '20261107T0911-account-tokens',
    'f92581ffaf57cc99eac3733cba3e88e809c9f43a58758d2bbd763ea63ecfe95c',
  ],
  [
    m03,
    '20261107T0924-guilds',
    'ddc9f99004aa66f3f18d9aedfd82a869055d531bcf4b661f506579f4b319541a',
  ],
  [
    m04,
    '20261107T0945-push',
    '3cd77d5c66f032ba44da8c636b6e1181a88f939cf7a86c6204c5af2ec78f42cd',
  ],
  [
    m05,
    '20261107T1403-achievements',
    'd7ef23682215a1448ec993b6269624323bfec402a06a49a353df7a53475f4449',
  ],
  [
    m06,
    '20261107T1417-admin-audit',
    '83f7428f4917effd4310dda2414fb4988941648752a7f47b94b2a2ae8c23be7e',
  ],
  [
    m07,
    '20261107T1556-announcement-text',
    '90bf9058083abfec822effba313c40f131b5c6a7ebe387ccce5533bd56f7da05',
  ],
  [
    m08,
    '20261107T1556-passkeys',
    'c853a20341b5ccf6b75445b75c6a605b3d6997ac8b7f9d62683ab1e1eaf5864d',
  ],
  [
    m09,
    '20261108T1207-colonization',
    '5e3403124dcbcad58da593fb25db53a845c7f395422229523cd53d0e97ab2103',
  ],
  [
    m10,
    '20261112T1613-explanation-texts',
    'd86a213fb2da0a34e5bd743148644ac69c440be200b371f5d03674ec07b06d2d',
  ],
  [
    m11,
    '20261112T1652-research-planet',
    '573b9d6e134163c2b4b38a1d46b9f6947070f1a049e0133471e1374f3bc0845d',
  ],
  [
    m12,
    '20261112T2219-error-log',
    'a8761d9904a596d46f872b7282c5858dcf3e31d5315fdfde61ec8b43ec6484f5',
  ],
  [
    m13,
    '20261113T0006-deploy-mission',
    '3eff899cb048b6bc9e1737eaed302f3b0fa3a1048feb7219012744bd20d4b0e6',
  ],
  [
    m14,
    '20261113T1126-planet-fields',
    '6ac599130561b8f3f925be8084e7a93a86f2ff6c962507bcb9dfe6af231ab505',
  ],
  [
    m15,
    '20261113T2315-places',
    'ea6f338a14d7017a96db4e33136ba6f991c947c62e48c7f1b1b7ccca58e719b8',
  ],
  [
    m16,
    '20261114T1315-harvest-mission',
    '18e1885843cfbd7dc557506e170b3ed821fdfcce502f96c70edda5e94ad86597',
  ],
  [
    m17,
    '20261114T1638-push-kinds',
    '2f37afb7421bc79262cef57a2eab19b6d9560da6a3adf4baa3fa18d1b2d8045d',
  ],
  [
    m18,
    '20261114T1809-gift-fleet',
    '2976f00b2b46c92cd9d8308097ae5a170f13b3c6446da7eb8e95f12edc086e89',
  ],
  [
    m19,
    '20261114T1856-guild-ranks',
    '6726628747525df5f2e77a917246156c07cb7cb23818ae1d370edbefaac3f433',
  ],
  [
    m20,
    '20261115T0952-guild-chat',
    '6084a05c5e6293b3d49829b2eccd9edcdfeb0caf4f94af5284c86a624d991f93',
  ],
] as const;

const sha256 = (text: string): string =>
  createHash('sha256').update(text).digest('hex');

describe('the legacy migration files', () => {
  it.each(
    FILES.map(([file, id, hash], i) => ({ file, id, hash, number: i + 1 })),
  )('keep migration $number, $id', ({ file, id, hash, number }) => {
    expect(file.id).toBe(id);
    expect(file.number).toBe(number);
    expect(sha256(file.sql)).toBe(hash);
    expect(MIGRATIONS[number - 1]).toEqual({ id, number, sql: file.sql });
  });
});
