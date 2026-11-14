// One repository per aggregate (#117, okf/architecture/patterns.md section 8).
// A repository never opens a transaction: the caller's `tx` is the unit of
// work, for an action the one of `runAction`.
import type { Db } from '../database.ts';
import { SqliteAdmin, type Admin } from './admin.ts';
import { SqliteDebris, type DebrisFields } from './debris.ts';
import { SqliteFleets, type Fleets } from './fleets.ts';
import { SqliteGuilds, type Guilds } from './guilds.ts';
import { SqliteInvitations, type Invitations } from './invitations.ts';
import { SqlitePlanets, type Planets } from './planets.ts';
import { SqlitePlayers, type Players } from './players.ts';
import { SqliteReports, type Reports } from './reports.ts';

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
});
