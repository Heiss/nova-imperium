// Pins what the clean-up of #326 must not change: which actions exist and to
// which group each belongs (plain, guild, admin), and the order of the keys of
// the state a player gets. Every action and every key of the state is written
// out; a new action or key is added here on purpose, so a move of a table or
// of a part of the state cannot drop one or reorder the JSON unnoticed.
import { describe, expect, it } from 'vitest';
import { addPlanet, addUser, testCtx } from '../test-helpers.ts';
import { ACTIONS, ADMIN_ACTIONS, GUILD_ACTIONS } from './dispatch.ts';
import { stateFor } from './state.ts';

const PLAIN = [
  'abandon',
  'answerFriend',
  'build',
  'cancelBuild',
  'cancelFriend',
  'cancelOrder',
  'cancelResearch',
  'claimAchievement',
  'claimDailyReward',
  'delall',
  'delrep',
  'demolish',
  'endVacation',
  'inviteUnion',
  'jump',
  'mainPlanet',
  'missile',
  'openUnion',
  'options',
  'order',
  'pct',
  'pushOptions',
  'read',
  'recall',
  'removeFriend',
  'rename',
  'requestFriend',
  'research',
  'scan',
  'send',
  'startVacation',
  'trade',
];
const GUILD = [
  'applyToGuild',
  'assignGuildRank',
  'createGuild',
  'createGuildRank',
  'deleteGuildChat',
  'deleteGuildRank',
  'dissolveGuild',
  'leaveGuild',
  'manageGuildMember',
  'moveGuildRank',
  'renameGuildRank',
  'reviewGuildApplication',
  'seeGuildChat',
  'sendGuildChat',
  'setGuildDefaultRank',
  'setGuildRankRights',
  'updateGuild',
];
const ADMIN = ['endzeit', 'reset', 'settings'];

const FULL_KEYS = [
  'round',
  'now',
  'cfg',
  'me',
  'planet',
  'homePlanet',
  'mainPlanet',
  'mainLock',
  'labs',
  'gates',
  'fleets',
  'reports',
  'guilds',
  'friends',
  'achievements',
  'players',
  'galaxy',
  'debris',
  'locks',
  'market',
  'admin',
  'quick',
  'unions',
];
// The lock screen of the vacation mode (#223) has its own, shorter shape.
const LOCKED_KEYS = [
  'round',
  'now',
  'cfg',
  'me',
  'planet',
  'labs',
  'fleets',
  'reports',
  'players',
  'galaxy',
  'debris',
  'admin',
];

describe('the actions and the state before and after the clean-up (#326)', () => {
  it('has these actions, each in one group', () => {
    const group = (type: string) =>
      ADMIN_ACTIONS.has(type)
        ? 'admin'
        : GUILD_ACTIONS.has(type)
          ? 'guild'
          : 'plain';
    const of = (g: string) =>
      Object.keys(ACTIONS)
        .filter((type) => group(type) === g)
        .sort();
    expect(of('plain')).toEqual(PLAIN);
    expect(of('guild')).toEqual(GUILD);
    expect(of('admin')).toEqual(ADMIN);
    expect([...GUILD_ACTIONS].sort()).toEqual(GUILD);
    expect([...ADMIN_ACTIONS].sort()).toEqual(ADMIN);
  });

  it('sends the keys of the state in this order, for a player and for the admin', () => {
    const ctx = testCtx();
    const anna = addUser(ctx, 'Anna');
    const admin = addUser(ctx, 'Admin', { admin: true });
    addPlanet(ctx, anna.id);
    addPlanet(ctx, admin.id, { s: 2 });
    expect(Object.keys(stateFor(ctx, anna))).toEqual(FULL_KEYS);
    expect(Object.keys(stateFor(ctx, admin))).toEqual(FULL_KEYS);
  });

  it('sends the keys of the state in this order, for a player without a planet', () => {
    const ctx = testCtx();
    expect(Object.keys(stateFor(ctx, addUser(ctx, 'Cora')))).toEqual(FULL_KEYS);
  });

  it('sends the keys of the lock screen in this order during the vacation mode', () => {
    const ctx = testCtx();
    const vac = addUser(ctx, 'Vera', { vacation: 5 });
    addPlanet(ctx, vac.id);
    expect(Object.keys(stateFor(ctx, vac))).toEqual(LOCKED_KEYS);
  });
});
