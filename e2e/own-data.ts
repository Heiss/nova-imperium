// Tests own their data (#302): every test gets its own players, its own area
// of the universe and its own guild tags from here, so no test meets what
// another one left behind, in whatever order the tests run. What is handed out
// goes to the ledger (e2e/ledger.ts), which the seed command checks.
import { randomInt } from 'node:crypto';
import { test } from '@playwright/test';
import {
  type Area,
  areaAt,
  nextArea,
  readLedger,
  record,
  systemOf,
} from './ledger.ts';

/** The first slot of a home planet; the game places them on 4 to 12 only. */
const FIRST_HOME_SLOT = 4;
const LAST_HOME_SLOT = 12;

/** What the running test has been handed. */
interface Own {
  owner: string;
  area: Area | null;
  homes: number;
}

const owned = new Map<string, Own>();

/** The running test; a name that tells which one in every message. */
function current(): Own {
  const info = test.info();
  const key = `${info.testId}#${info.repeatEachIndex}#${info.retry}`;
  let own = owned.get(key);
  if (!own) {
    own = {
      owner: `${info.project.name}: ${info.titlePath.join(' › ')}`,
      area: null,
      homes: 0,
    };
    owned.set(key, own);
  }
  return own;
}

/** The running test, or none while the files load. */
function ownerOrNone(): string {
  try {
    return current().owner;
  } catch {
    return '';
  }
}

/**
 * The area of the running test: a block of systems that no other test gets.
 * Every position a test uses lies in it (the seed command refuses others).
 */
export function ownArea(): Area & {
  /** The system `i` of the area; 0 is the home system. */
  system: (i: number) => { g: number; s: number };
} {
  const own = current();
  if (!own.area) {
    own.area = areaAt(nextArea());
    record({ kind: 'area', owner: own.owner, ...own.area });
  }
  const area = own.area;
  return { ...area, system: (i) => systemOf(area, i) };
}

/** The next free home slot in the home system of the running test. */
export function nextHome(): { g: number; s: number; p: number } {
  const own = current();
  const { g, s } = ownArea();
  const p = FIRST_HOME_SLOT + own.homes++;
  if (p > LAST_HOME_SLOT)
    throw new Error(
      `A test has room for ${LAST_HOME_SLOT - FIRST_HOME_SLOT + 1} home planets in its area, got ${own.homes}.`,
    );
  return { g, s, p };
}

/** The owner of a handed-out name, or null when none was handed out. */
const ownerOfName = (name: string): string | null =>
  readLedger().find((e) => e.kind === 'name' && e.name === name)?.owner ?? null;

/** Whether the name was handed out to the running test. */
export const isOwnName = (name: string): boolean =>
  ownerOfName(name) === current().owner;

/** The names handed out to the running test. */
export const ownNames = (): string[] => {
  const { owner } = current();
  return readLedger().flatMap((e) =>
    e.kind === 'name' && e.owner === owner ? [e.name] : [],
  );
};

const BASE36 = '0123456789abcdefghijklmnopqrstuvwxyz';

/** `length` random characters of the alphabet. */
const randomText = (length: number, alphabet = BASE36): string =>
  Array.from({ length }, () => alphabet[randomInt(alphabet.length)]).join('');

/**
 * A name no other test has: the base (at most 14 characters) and 6 random
 * characters, at most 20 in all, the most a player may have. Every name is
 * recorded, so the seed command knows it and no test meets another's. The
 * characters come from `alphabet` (base-36 by default), for a test that
 * needs a name of wide letters.
 */
export function uniqueName(base: string, alphabet = BASE36): string {
  const taken = new Set(
    readLedger().flatMap((e) => (e.kind === 'name' ? [e.name] : [])),
  );
  for (;;) {
    const name = `${base.slice(0, 14)}${randomText(6, alphabet)}`;
    if (taken.has(name)) continue;
    record({ kind: 'name', name, owner: ownerOrNone() });
    return name;
  }
}

/**
 * A guild tag no other test has: the prefix in capitals and random capitals
 * and digits, at most 8 characters in all (the server takes 2 to 8 letters or
 * digits, and refuses a second guild with the same tag or name).
 */
export function guildTag(prefix: string): string {
  const taken = new Set(
    readLedger().flatMap((e) => (e.kind === 'guild' ? [e.tag] : [])),
  );
  const head = prefix.toUpperCase().slice(0, 2);
  for (;;) {
    const tag = `${head}${randomText(8 - head.length, `${BASE36.toUpperCase()}`)}`;
    if (taken.has(tag)) continue;
    record({ kind: 'guild', tag, owner: ownerOrNone() });
    return tag;
  }
}
