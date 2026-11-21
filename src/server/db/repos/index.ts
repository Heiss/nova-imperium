// One repository per aggregate (#117, okf/architecture/patterns.md sections 8
// and 15). A repository never opens a transaction: the caller's `tx` is the
// unit of work, for an action the one of `runAction`.
//
// No repository is named here (#317): each module of this folder exports its
// own under the fixed name `repository` (key and `make`, see contract.ts), the
// list is generated (repositories.gen.ts), and the type `Repositories` is
// derived from it: `ctx.market` keeps the type `make` returns.
import { claim } from '../../claim.ts';
import type { Db } from '../database.ts';
import type { RepositoryModule } from './contract.ts';
import { REPOSITORIES } from './repositories.gen.ts';

/** The modules as the generated list gives them: `[path in this folder, repository]`. */
export type Listed = readonly (readonly [string, RepositoryModule])[];

type Entry = (typeof REPOSITORIES)[number];

/** Every repository by its key, typed by what its `make` returns. */
export type Repositories = {
  [E in Entry as E[1]['key']]: ReturnType<E[1]['make']>;
};

const fileOf = (name: string): string => `src/server/db/repos/${name}.ts`;

/** The repositories of all `modules` on one connection, each key once. */
export function assembleRepositories(
  db: Db,
  modules: Listed,
): Record<string, unknown> {
  const repos: Record<string, unknown> = {};
  const owners = new Map<string, string>();
  for (const [name, { key, make }] of modules) {
    claim('repository', owners, key, fileOf(name));
    repos[key] = make(db);
  }
  return repos;
}

export const repositories = (db: Db): Repositories =>
  assembleRepositories(db, REPOSITORIES) as Repositories;
