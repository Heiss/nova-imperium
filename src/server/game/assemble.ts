// The tables of dispatch.ts and state.ts (#326): the actions and the parts of
// the state of the frame plus those of every listed server feature. A name, a
// key or an order number defined twice stops the start with both files named,
// so no feature silently replaces another by the order of a spread.
import { claim } from '../claim.ts';
import type { Action } from './actions.ts';
import type { ServerFeature, StatePart } from './feature.ts';

/** The modules as the generated list gives them: `[path in src/server, serverFeature]`. */
export type Listed = readonly (readonly [string, ServerFeature])[];

const FRAME_ACTIONS = 'src/server/game/dispatch.ts';
const FRAME_STATE = 'src/server/game/state.ts';

const fileOf = (name: string): string => `src/server/${name}.ts`;

/** All actions with the names of the guild actions and of the admin actions. */
export interface ActionTables {
  actions: Record<string, Action>;
  guild: ReadonlySet<string>;
  admin: ReadonlySet<string>;
}

/** The actions of the frame and of all `features`, each name once. */
export function assembleActions(
  frame: Readonly<Record<string, Action>>,
  features: Listed,
): ActionTables {
  const actions: Record<string, Action> = { ...frame };
  const owners = new Map(
    Object.keys(frame).map((name) => [name, FRAME_ACTIONS]),
  );
  const guild = new Set<string>();
  const admin = new Set<string>();
  for (const [name, feature] of features) {
    const groups = [
      [feature.actions, undefined],
      [feature.guildActions, guild],
      [feature.adminActions, admin],
    ] as const;
    for (const [table, group] of groups)
      for (const [type, action] of Object.entries(table ?? {})) {
        claim('action', owners, type, fileOf(name));
        actions[type] = action;
        group?.add(type);
      }
  }
  return { actions, guild, admin };
}

/** The parts of the frame and of all `features` by ascending order, each key and number once. */
export function assembleState(
  frame: readonly StatePart[],
  features: Listed,
): readonly StatePart[] {
  const parts: (readonly [string, StatePart])[] = [
    ...frame.map((part) => [FRAME_STATE, part] as const),
    ...features.flatMap(([name, feature]) =>
      feature.state ? [[fileOf(name), feature.state] as const] : [],
    ),
  ];
  const keys = new Map<string, string>();
  const orders = new Map<string, string>();
  for (const [file, part] of parts) {
    claim('state order', orders, String(part.order), file);
    for (const key of part.keys) claim('state key', keys, key, file);
  }
  return parts.map(([, part]) => part).sort((a, b) => a.order - b.order);
}
