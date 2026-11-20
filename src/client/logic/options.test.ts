// The page „Optionen“ as data (#118, bundle 5): what the component Options
// renders. The markup is compared with the view before in
// src/test/options-reference.test.ts.
import { afterEach, describe, expect, it } from 'vitest';
import { ERROR_FIELDS } from '../../core/error-log.ts';
import type { RoundRules } from '../../core/round.ts';
import type { V } from '../views/common.ts';
import { deleteAccountText, optionsPage } from './options.ts';
import { archive, forgetArchive } from './round-archive.ts';

const NOW = Date.UTC(2026, 10, 19, 12, 0);

const view = (over: Record<string, unknown> = {}): V =>
  ({
    s: {
      me: { id: 'u_me', probes: 4, explain: 'hidden', levelTable: 'always' },
      round: { number: 2, mainLock: 7, vacationHours: 24, guilds: true },
      galaxy: [],
    },
    ui: { view: 'help', animations: true },
    now: NOW,
    ...over,
  }) as unknown as V;

afterEach(() => forgetArchive());

describe('the page „Optionen“', () => {
  it('holds the choices of the player', () => {
    const page = optionsPage(view());
    expect(page.probes).toBe(4);
    expect(page.explain.find((c) => c.selected)?.value).toBe('hidden');
    expect(page.levels.find((c) => c.selected)?.value).toBe('always');
    expect(page.animations).toBe(true);
  });

  it('shows one probe for a player without a number of them', () => {
    const v = view();
    for (const probes of [0, undefined]) {
      v.s.me.probes = probes as never;
      expect(optionsPage(v).probes).toBe(1);
    }
  });

  it('names the minimum duration of the vacation mode of the round', () => {
    const v = view();
    v.s.round.vacationHours = 1;
    expect(optionsPage(v).vacation).toContain('nach 1 Stunde.');
  });

  it('shows the archive that was read for this account and round only', () => {
    expect(optionsPage(view()).archive.body).toEqual({ kind: 'loading' });
    Object.assign(archive, {
      user: 'u_me',
      round: 2,
      entries: [],
      history: [],
    });
    expect(optionsPage(view()).archive.body).toEqual({
      kind: 'list',
      rounds: [],
      history: [],
    });
    const other = view();
    other.s.me.id = 'u_other';
    expect(optionsPage(other).archive.body).toEqual({ kind: 'loading' });
  });

  it('shows the push kinds on a server with Web Push only, the pending choice first', () => {
    expect(optionsPage(view()).pushKinds).toBeNull();
    const v = view({
      ui: { view: 'help', webPush: true, pushChoice: ['news'] },
    });
    v.s.me.pushOff = [];
    const off = optionsPage(v).pushKinds!.filter((k) => !k.checked);
    expect(off.map((k) => k.topic)).toEqual(['news']);
  });

  it('prepares the form „Problem melden“ with the page, the version and the last request', () => {
    const page = optionsPage(
      view({
        ui: {
          view: 'help',
          news: { version: '1.2.3' },
          lastRequestId: 'r_9',
        },
      }),
    );
    expect(page.report).toEqual({
      page: 'help',
      version: '1.2.3',
      requestId: 'r_9',
      context: 'Seite: help · Version: 1.2.3 · Letzter Vorgang: r_9',
      max: ERROR_FIELDS.report,
    });
    expect(optionsPage(view()).report).toMatchObject({
      version: '',
      requestId: '',
      context: 'Seite: help · Version: unbekannt · Letzter Vorgang: –',
    });
  });

  it('links „Dieses Universum“ of the Lexicanum (#288, B4)', () => {
    expect(optionsPage(view()).universe).toEqual({
      article: 'rule-universe',
      href: '?view=lexicanum&a=rule-universe',
    });
  });

  it('passes the minimum length of a password on', () => {
    expect(optionsPage(view()).passwordMinLength).toBeUndefined();
    expect(
      optionsPage(view({ ui: { view: 'help', passwordMinLength: 12 } }))
        .passwordMinLength,
    ).toBe(12);
  });
});

describe('the sentence of „Account löschen“ (#191)', () => {
  it('names the guild only in a round with guilds', () => {
    expect(deleteAccountText({ guilds: true } as RoundRules)).toBe(
      'Dein Konto und deine Spielstände werden dauerhaft gelöscht. Leitest du eine Gilde, wird sie aufgelöst.',
    );
    expect(deleteAccountText({ guilds: false } as RoundRules)).toBe(
      'Dein Konto und deine Spielstände werden dauerhaft gelöscht.',
    );
  });
});
