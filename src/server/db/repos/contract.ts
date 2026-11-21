// The contract of a repository module (okf/architecture/patterns.md, section
// 15; #317). A module in this folder exports its repository under the fixed
// name `repository`; the list of all of them is generated
// (scripts/gen-features.ts, repositories.gen.ts), so index.ts names none and
// a new repository edits no shared place.
import type { Db } from '../database.ts';

/**
 * What a module exports as `repository`: the key under which the repository
 * is on `Ctx` (`ctx.market`) and the function that builds it on a connection.
 * The return type of `make` is the type of `ctx.<key>`: write it out (the
 * interface, not the class).
 */
export interface RepositoryModule {
  readonly key: string;
  readonly make: (db: Db) => unknown;
}
