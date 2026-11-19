// One repository per aggregate (#117, okf/architecture/patterns.md section 8).
// A repository never opens a transaction: the caller's `tx` is the unit of
// work, for an action the one of `runAction`.
import type { Db } from '../database.ts';
import { SqliteAdmin, type Admin } from './admin.ts';
import { SqliteDebris, type DebrisFields } from './debris.ts';
import { SqliteFleets, type Fleets } from './fleets.ts';
import { SqliteFriends, type Friends } from './friends.ts';
import { SqliteGuilds, type Guilds } from './guilds.ts';
import { SqliteInvitations, type Invitations } from './invitations.ts';
import { SqliteLastTargets, type LastTargets } from './last-targets.ts';
import { SqliteMarket, type MarketStore } from './market.ts';
import { SqlitePlanets, type Planets } from './planets.ts';
import { SqlitePlayers, type Players } from './players.ts';
import { SqlitePlaytime, type Playtime } from './playtime.ts';
import { SqliteReports, type Reports } from './reports.ts';
import { SqliteSurveys, type Surveys } from './surveys.ts';

export interface Repositories {
  players: Players;
  planets: Planets;
  fleets: Fleets;
  reports: Reports;
  guilds: Guilds;
  invitations: Invitations;
  admin: Admin;
  /** The Trümmerfelder (#45), places of their own (#119). */
  debris: DebrisFields;
  /** The values of surveyed free positions (#190). */
  surveys: Surveys;
  /** The buddy list (#227). */
  friends: Friends;
  /** The prices and the daily amounts of the marketplace (#171). */
  market: MarketStore;
  /** The last hostile targets of a player (#292). */
  targets: LastTargets;
  /** The accepted intervals of the estimated play time (#232). */
  playtime: Playtime;
}

export const repositories = (db: Db): Repositories => ({
  players: new SqlitePlayers(db),
  planets: new SqlitePlanets(db),
  fleets: new SqliteFleets(db),
  reports: new SqliteReports(db),
  guilds: new SqliteGuilds(db),
  invitations: new SqliteInvitations(db),
  admin: new SqliteAdmin(db),
  debris: new SqliteDebris(db),
  surveys: new SqliteSurveys(db),
  friends: new SqliteFriends(db),
  market: new SqliteMarket(db),
  targets: new SqliteLastTargets(db),
  playtime: new SqlitePlaytime(db),
});
