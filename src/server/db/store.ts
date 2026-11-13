// A thin facade over the repositories (#117): the method names of the former
// single store, for the store, migration and E2E-seed tests and to build the
// context of the server and the CLI. Game code uses the repositories through
// `Ctx` (okf/architecture/patterns.md section 8).
import type { Fleet, Planet, Universe } from '../../core/types.ts';
import type { UsedSize } from '../../core/universe.ts';
import type { Db } from './database.ts';
import { repositories, type Repositories } from './repos/index.ts';
import type { Invitation } from './repos/invitations.ts';
import type { User } from './repos/players.ts';
import type { Report } from './repos/reports.ts';

export class Store {
  readonly db: Db;
  readonly repos: Repositories;
  constructor(db: Db) {
    this.db = db;
    this.repos = repositories(db);
  }

  /** Reserve the writer before reads, so a concurrent commit cannot stale the snapshot. */
  tx<T>(fn: () => T): T {
    return this.db.transaction(fn).immediate();
  }

  // ----- settings -----

  universe(): Universe {
    return this.repos.admin.universe();
  }

  saveUniverse(u: Universe): void {
    this.repos.admin.saveUniverse(u);
  }

  usedSize(): UsedSize {
    return this.repos.planets.usedSize();
  }

  // ----- users -----

  user(id: string): User | null {
    return this.repos.players.get(id);
  }

  userByName(name: string): User | null {
    return this.repos.players.byName(name);
  }

  userByEmail(email: string): User | null {
    return this.repos.players.byEmail(email);
  }

  users(): User[] {
    return this.repos.players.all();
  }

  saveUser(u: User): void {
    this.repos.players.save(u);
  }

  // ----- planets -----

  planet(id: string): Planet | null {
    return this.repos.planets.get(id);
  }

  /** The home planet: the oldest planet of the player. */
  planetOfUser(uid: string): Planet | null {
    return this.repos.planets.home(uid);
  }

  playerPlanets(uid: string): Planet[] {
    return this.repos.planets.ofOwner(uid);
  }

  planets(): Planet[] {
    return this.repos.planets.all();
  }

  savePlanet(p: Planet): void {
    this.repos.planets.save(p);
  }

  deleteAllPlanets(): void {
    this.repos.planets.deleteAll();
  }

  // ----- fleets -----

  fleet(id: string): Fleet | null {
    return this.repos.fleets.get(id);
  }

  fleets(): Fleet[] {
    return this.repos.fleets.all();
  }

  fleetCount(owner: string): number {
    return this.repos.fleets.count(owner);
  }

  /** Fleets whose next event (arrival or return) is due, the earliest first. */
  dueFleets(now: number): Fleet[] {
    return this.repos.fleets.due(now);
  }

  saveFleet(f: Fleet): void {
    this.repos.fleets.save(f);
  }

  deleteFleet(id: string): void {
    this.repos.fleets.delete(id);
  }

  deleteAllFleets(): void {
    this.repos.fleets.deleteAll();
  }

  // ----- reports -----

  addReport(uid: string, report: Report, keep: number): void {
    this.repos.reports.add(uid, report, keep);
  }

  /** The newest report first (the order in which they were written). */
  reports(uid: string): Report[] {
    return this.repos.reports.ofPlayer(uid);
  }

  deleteReport(uid: string, id: string): void {
    this.repos.reports.delete(uid, id);
  }

  deleteReports(uid: string): void {
    this.repos.reports.deleteAll(uid);
  }

  // ----- sessions -----

  addSession(tokenHash: string, uid: string, expires: number): void {
    this.repos.players.addSession(tokenHash, uid, expires);
  }

  sessionUser(tokenHash: string, now: number): string | null {
    return this.repos.players.sessionUser(tokenHash, now);
  }

  deleteSession(tokenHash: string): void {
    this.repos.players.deleteSession(tokenHash);
  }

  purgeSessions(now: number): number {
    return this.repos.players.purgeSessions(now);
  }

  // ----- invitations -----

  addInvitation(i: Invitation): void {
    this.repos.invitations.add(i);
  }

  invitationByToken(tokenHash: string): Invitation | null {
    return this.repos.invitations.byToken(tokenHash);
  }

  /** Invitations that can still be used, the newest first. */
  openInvitations(now: number): Invitation[] {
    return this.repos.invitations.open(now);
  }

  /** Revokes the open invitations of an address (or one by id). */
  revokeInvitations(
    where: { email?: string; id?: string },
    now: number,
  ): number {
    return this.repos.invitations.revoke(where, now);
  }

  useInvitation(id: string, now: number): void {
    this.repos.invitations.use(id, now);
  }
}
