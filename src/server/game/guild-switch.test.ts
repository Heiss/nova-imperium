// Guilds (with the chat of #169) on or off per round (#191): one switch,
// set only when the admin starts a new round; while it is off the server
// refuses every guild action and sends no guild data.
import { describe, expect, it } from 'vitest';
import type { AuditEntry } from '../audit.ts';
import { addPlanet, addUser, testCtx, type TestCtx } from '../test-helpers.ts';
import { universe } from './context.ts';
import { ACTIONS, GUILD_ACTIONS, runAction } from './dispatch.ts';
import { GUILDS_OFF, guildsOn, requireGuilds, roundRules } from './round.ts';
import { stateFor } from './state.ts';

/** Every guild action of the game, written out so a new one must be added here. */
const ALL_GUILD_ACTIONS = [
  'createGuild',
  'updateGuild',
  'applyToGuild',
  'reviewGuildApplication',
  'leaveGuild',
  'manageGuildMember',
  'createGuildRank',
  'renameGuildRank',
  'setGuildRankRights',
  'moveGuildRank',
  'deleteGuildRank',
  'setGuildDefaultRank',
  'assignGuildRank',
  'dissolveGuild',
  // The guild chat (#169).
  'sendGuildChat',
  'deleteGuildChat',
  // The visit of the chat for the red mark (#169, owner, 2026-11-15).
  'seeGuildChat',
];

const GUILD_TABLES = [
  'guilds',
  'guild_members',
  'guild_ranks',
  'guild_rank_rights',
  'guild_chat',
];

const rows = (ctx: TestCtx) =>
  Object.fromEntries(
    GUILD_TABLES.map((t) => [t, ctx.db.prepare(`SELECT * FROM ${t}`).all()]),
  );

/** An admin, a guild with a second rank, a member and an applicant. */
function world() {
  const ctx = testCtx();
  const admin = addUser(ctx, 'Admin', { admin: true });
  const lead = addUser(ctx, 'Anna');
  const member = addUser(ctx, 'Bert');
  const applicant = addUser(ctx, 'Cora');
  for (const u of [admin, lead, member, applicant]) addPlanet(ctx, u.id);
  runAction(ctx, lead.id, {
    type: 'createGuild',
    name: 'Outer Rim',
    tag: 'OR',
  });
  const id = ctx.guilds.membership(lead.id)!.guild_id;
  runAction(ctx, member.id, { type: 'applyToGuild', id });
  runAction(ctx, lead.id, {
    type: 'reviewGuildApplication',
    uid: member.id,
    accept: true,
  });
  runAction(ctx, lead.id, { type: 'createGuildRank', name: 'Offizier' });
  const rank = ctx.guilds.ranks(id).find((r) => r.name === 'Offizier')!.id;
  runAction(ctx, lead.id, {
    type: 'setGuildRankRights',
    rank,
    rights: ['remove'],
  });
  runAction(ctx, applicant.id, { type: 'applyToGuild', id });
  runAction(ctx, member.id, { type: 'sendGuildChat', text: 'Hallo' });
  // The first entry is the event of Bert joining (#169 D4).
  const message = ctx.guilds.chat(id).find((m) => m.kind === 'message')!.id;
  return { ctx, admin, lead, member, applicant, id, rank, message };
}

/** What a guild action would send, so only the switch can refuse it. */
function payload(
  type: string,
  w: ReturnType<typeof world>,
): Record<string, unknown> {
  const data: Record<string, Record<string, unknown>> = {
    createGuild: { name: 'Neue Gilde', tag: 'NG' },
    updateGuild: { name: 'Outer Rim', tag: 'OR', description: 'neu' },
    applyToGuild: { id: w.id },
    reviewGuildApplication: { uid: w.applicant.id, accept: true },
    manageGuildMember: { uid: w.member.id, transfer: false },
    createGuildRank: { name: 'Hauptmann' },
    renameGuildRank: { rank: w.rank, name: 'Hauptmann' },
    setGuildRankRights: { rank: w.rank, rights: ['profile'] },
    moveGuildRank: { rank: w.rank, up: false },
    deleteGuildRank: { rank: w.rank },
    setGuildDefaultRank: { rank: w.rank },
    assignGuildRank: { uid: w.member.id, rank: w.rank },
    dissolveGuild: { tag: 'OR' },
    sendGuildChat: { text: 'Noch da?' },
    deleteGuildChat: { id: w.message },
    seeGuildChat: { id: w.message },
  };
  return { type, ...data[type] };
}

describe('the guild switch (#191)', () => {
  it('lists every guild action of the game, and only those', () => {
    expect([...GUILD_ACTIONS].sort()).toEqual([...ALL_GUILD_ACTIONS].sort());
    for (const type of Object.keys(ACTIONS))
      expect(GUILD_ACTIONS.has(type), type).toBe(/guild/i.test(type));
  });

  it('is on in an existing universe, as before', () => {
    const ctx = testCtx();
    expect(roundRules(ctx)).toEqual({
      number: 1,
      achievements: true,
      daily: true,
      guilds: true,
      mainLock: 7,
      abandonLock: 24,
      activityRecent: 15,
      activityMinutes: 59,
      inactiveDays: 7,
      longInactiveDays: 28,
      recognitionTotal: 2,
      recognitionTypes: 4,
      recognitionCounts: 8,
      demolitionRefund: 50,
      demolitionTime: 50,
    });
    expect(guildsOn(ctx)).toBe(true);
    expect(() => requireGuilds(ctx)).not.toThrow();
  });

  it('is off only when the stored switch is 0', () => {
    const ctx = testCtx();
    ctx.admin.putSettings([['roundGuilds', 0]]);
    expect(guildsOn(ctx)).toBe(false);
    expect(() => requireGuilds(ctx)).toThrow(GUILDS_OFF);
    ctx.admin.putSettings([['roundGuilds', 1]]);
    expect(guildsOn(ctx)).toBe(true);
  });

  it('refuses with the German message of the owner', () => {
    expect(GUILDS_OFF).toBe('Gilden sind in dieser Runde abgeschaltet.');
  });

  it('a new round with guilds off deletes every guild and stores the switch', () => {
    const w = world();
    const { ctx, admin } = w;
    const event = {} as AuditEntry;
    expect(
      runAction(ctx, admin.id, { type: 'reset', guilds: false }, event),
    ).toBe(
      'Neue Runde gestartet – alle Spieler haben einen frischen Planeten.',
    );
    expect(roundRules(ctx)).toEqual({
      number: 2,
      achievements: true,
      daily: true,
      guilds: false,
      mainLock: 7,
      abandonLock: 24,
      activityRecent: 15,
      activityMinutes: 59,
      inactiveDays: 7,
      longInactiveDays: 28,
      recognitionTotal: 2,
      recognitionTypes: 4,
      recognitionCounts: 8,
      demolitionRefund: 50,
      demolitionTime: 50,
    });
    for (const t of GUILD_TABLES)
      expect(ctx.db.prepare(`SELECT COUNT(*) FROM ${t}`).pluck().get(), t).toBe(
        0,
      );
    expect(ctx.admin.setting('roundGuilds')).toBe(0);
    // The accounts stay and every player has a fresh planet.
    expect(ctx.players.all()).toHaveLength(4);
    for (const u of ctx.players.all())
      expect(ctx.planets.home(u.id)).toBeDefined();
    // The round-reset audit entry holds the choice, like the reward boxes.
    expect(event.detail).toEqual({
      before: {
        number: 1,
        achievements: true,
        daily: true,
        guilds: true,
        mainLock: 7,
        abandonLock: 24,
        activityRecent: 15,
        activityMinutes: 59,
        inactiveDays: 7,
        longInactiveDays: 28,
        recognitionTotal: 2,
        recognitionTypes: 4,
        recognitionCounts: 8,
        demolitionRefund: 50,
        demolitionTime: 50,
      },
      after: {
        number: 2,
        achievements: true,
        daily: true,
        guilds: false,
        mainLock: 7,
        abandonLock: 24,
        activityRecent: 15,
        activityMinutes: 59,
        inactiveDays: 7,
        longInactiveDays: 28,
        recognitionTotal: 2,
        recognitionTypes: 4,
        recognitionCounts: 8,
        demolitionRefund: 50,
        demolitionTime: 50,
      },
    });
  });

  it('a new round with guilds on keeps the guilds, as today, and deletes the chats (#169 D6)', () => {
    const w = world();
    const before = rows(w.ctx);
    // The event of Bert joining and his message (#169).
    expect(before.guild_chat).toHaveLength(2);
    runAction(w.ctx, w.admin.id, { type: 'reset', guilds: true });
    expect(roundRules(w.ctx).guilds).toBe(true);
    expect(w.ctx.admin.setting('roundGuilds')).toBe(1);
    expect(rows(w.ctx)).toEqual({ ...before, guild_chat: [] });
    runAction(w.ctx, w.lead.id, payload('updateGuild', w));
    expect(w.ctx.guilds.get(w.id)?.description).toBe('neu');
  });

  it('a new round without a choice keeps the current one', () => {
    const w = world();
    runAction(w.ctx, w.admin.id, { type: 'reset', guilds: false });
    runAction(w.ctx, w.admin.id, {
      type: 'reset',
      rewards: { achievements: true, daily: true },
    });
    expect(roundRules(w.ctx)).toMatchObject({ number: 3, guilds: false });
    runAction(w.ctx, w.admin.id, { type: 'reset', guilds: true });
    runAction(w.ctx, w.admin.id, { type: 'reset' });
    expect(roundRules(w.ctx)).toMatchObject({ number: 5, guilds: true });
  });

  it('refuses a choice that is not yes or no, and changes nothing', () => {
    const w = world();
    const before = rows(w.ctx);
    for (const guilds of ['false', 0, null, {}])
      expect(() =>
        runAction(w.ctx, w.admin.id, { type: 'reset', guilds }),
      ).toThrow('Bitte auswählen, ob Gilden in der neuen Runde an sind.');
    expect(roundRules(w.ctx)).toMatchObject({ number: 1, guilds: true });
    expect(w.ctx.admin.setting('roundGuilds')).toBeUndefined();
    expect(rows(w.ctx)).toEqual(before);
  });

  it('only the admin starts a round with guilds off', () => {
    const w = world();
    const before = rows(w.ctx);
    expect(() =>
      runAction(w.ctx, w.lead.id, { type: 'reset', guilds: false }),
    ).toThrow('Nur der Admin darf das.');
    expect(guildsOn(w.ctx)).toBe(true);
    expect(rows(w.ctx)).toEqual(before);
  });

  it('cannot be switched in the universe settings, only at a new round', () => {
    const ctx = testCtx();
    const admin = addUser(ctx, 'Admin', { admin: true });
    runAction(ctx, admin.id, { type: 'reset', guilds: false });
    runAction(ctx, admin.id, {
      type: 'settings',
      settings: { ...universe(ctx), roundGuilds: 1, guilds: true },
    });
    expect(guildsOn(ctx)).toBe(false);
  });

  it('refuses every guild action while off, on the server, and changes nothing', () => {
    const w = world();
    // The switch off with guild data present: the server must not rely on
    // the deletion at the round start alone.
    w.ctx.admin.putSettings([['roundGuilds', 0]]);
    const before = rows(w.ctx);
    const actors = [w.lead, w.member, w.applicant, w.admin];
    for (const type of ALL_GUILD_ACTIONS)
      for (const u of actors)
        expect(
          () => runAction(w.ctx, u.id, payload(type, w)),
          `${type} by ${u.name}`,
        ).toThrow(GUILDS_OFF);
    expect(rows(w.ctx)).toEqual(before);
  });

  it('each guild action works again in a round with guilds on', () => {
    const w = world();
    w.ctx.admin.putSettings([['roundGuilds', 0]]);
    w.ctx.admin.putSettings([['roundGuilds', 1]]);
    expect(runAction(w.ctx, w.lead.id, payload('createGuildRank', w))).toBe(
      'Rang angelegt.',
    );
    expect(
      runAction(w.ctx, w.lead.id, payload('reviewGuildApplication', w)),
    ).toBe('Bewerbung angenommen.');
  });

  it('a round with guilds off: guild actions refused, others work', () => {
    const w = world();
    runAction(w.ctx, w.admin.id, { type: 'reset', guilds: false });
    for (const type of ALL_GUILD_ACTIONS)
      expect(() => runAction(w.ctx, w.lead.id, payload(type, w)), type).toThrow(
        GUILDS_OFF,
      );
    expect(w.ctx.guilds.all()).toEqual([]);
    expect(runAction(w.ctx, w.lead.id, { type: 'options', probes: 3 })).toBe(
      'Gespeichert.',
    );
  });

  it('refuses a player who is not signed in before the switch', () => {
    const ctx = testCtx();
    ctx.admin.putSettings([['roundGuilds', 0]]);
    expect(() =>
      runAction(ctx, 'nobody', { type: 'createGuild', name: 'Xyz', tag: 'XY' }),
    ).toThrow('Bitte einloggen.');
  });

  it('sends no guild data and the round rules while off', () => {
    const w = world();
    expect(stateFor(w.ctx, w.lead).guilds).not.toBeNull();
    expect(stateFor(w.ctx, w.lead).round).toMatchObject({ guilds: true });
    w.ctx.admin.putSettings([['roundGuilds', 0]]);
    const state = stateFor(w.ctx, w.lead);
    expect(state.guilds).toBeNull();
    expect(state.round).toMatchObject({ guilds: false });
  });
});
