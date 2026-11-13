// The facade over the repositories (#117): every method of the former single
// store hands its arguments to one repository method and returns its result.
import { describe, expect, it, vi } from 'vitest';
import { openDatabase } from './database.ts';
import type { Repositories } from './repos/index.ts';
import { Store } from './store.ts';

type Case = [
  facade: keyof Store,
  repo: keyof Repositories,
  method: string,
  returns: boolean,
];

const CASES: Case[] = [
  ['universe', 'admin', 'universe', true],
  ['saveUniverse', 'admin', 'saveUniverse', false],
  ['usedSize', 'planets', 'usedSize', true],
  ['user', 'players', 'get', true],
  ['userByName', 'players', 'byName', true],
  ['userByEmail', 'players', 'byEmail', true],
  ['users', 'players', 'all', true],
  ['saveUser', 'players', 'save', false],
  ['planet', 'planets', 'get', true],
  ['planetOfUser', 'planets', 'home', true],
  ['playerPlanets', 'planets', 'ofOwner', true],
  ['planets', 'planets', 'all', true],
  ['savePlanet', 'planets', 'save', false],
  ['deleteAllPlanets', 'planets', 'deleteAll', false],
  ['fleet', 'fleets', 'get', true],
  ['fleets', 'fleets', 'all', true],
  ['fleetCount', 'fleets', 'count', true],
  ['dueFleets', 'fleets', 'due', true],
  ['saveFleet', 'fleets', 'save', false],
  ['deleteFleet', 'fleets', 'delete', false],
  ['deleteAllFleets', 'fleets', 'deleteAll', false],
  ['addReport', 'reports', 'add', false],
  ['reports', 'reports', 'ofPlayer', true],
  ['deleteReport', 'reports', 'delete', false],
  ['deleteReports', 'reports', 'deleteAll', false],
  ['addSession', 'players', 'addSession', false],
  ['sessionUser', 'players', 'sessionUser', true],
  ['deleteSession', 'players', 'deleteSession', false],
  ['purgeSessions', 'players', 'purgeSessions', true],
  ['addInvitation', 'invitations', 'add', false],
  ['invitationByToken', 'invitations', 'byToken', true],
  ['openInvitations', 'invitations', 'open', true],
  ['revokeInvitations', 'invitations', 'revoke', true],
  ['useInvitation', 'invitations', 'use', false],
];

describe('store facade', () => {
  it.each(CASES)('%s calls %s.%s', (facade, repo, method, returns) => {
    const store = new Store(openDatabase(':memory:'));
    const result = { from: method };
    const target = store.repos[repo] as unknown as Record<
      string,
      () => unknown
    >;
    const spy = vi.spyOn(target, method).mockReturnValue(result);
    const call = store[facade] as (...args: unknown[]) => unknown;
    const args = ['a1', 'a2', 'a3'].slice(0, call.length);
    const back = call.apply(store, args);
    expect(spy).toHaveBeenCalledExactlyOnceWith(...args);
    expect(back).toBe(returns ? result : undefined);
  });
});
