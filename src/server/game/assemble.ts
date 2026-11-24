// The tables of dispatch.ts and state.ts (#326): the actions and the parts of
// the state of the frame plus those of every listed server feature. A name, a
// key or an order number defined twice stops the start with both files named,
// so no feature silently replaces another by the order of a spread.
import { claim } from '../claim.ts';
import type { Action } from './actions.ts';
import type { Gate, Handlers, ServerFeature, StatePart } from './feature.ts';

/** The modules as the generated list gives them: `[path in src/server, serverFeature]`. */
export type Listed = readonly (readonly [string, ServerFeature])[];

const FRAME_ACTIONS = 'src/server/game/dispatch.ts';
const FRAME_STATE = 'src/server/game/state.ts';

const fileOf = (name: string): string => `src/server/${name}.ts`;

/** All actions, the switches of those of a feature that can be off, and the names of the admin actions. */
export interface ActionTables {
  actions: Record<string, Action>;
  /** A Map: the name of an action comes from the browser (CodeQL on #395). */
  gates: ReadonlyMap<string, Gate>;
  admin: ReadonlySet<string>;
}

/** The switch of a feature that can be off, if it is one; `enabled` without `off` stops the start. */
function gateOf(name: string, feature: ServerFeature): Gate | undefined {
  if (!feature.enabled) return undefined;
  if (!feature.off)
    throw new Error(`${fileOf(name)} has enabled but no refusal (off).`);
  return { enabled: feature.enabled, off: feature.off };
}

/** The actions of the frame and of all `features`, each name once. */
export function assembleActions(
  frame: Handlers,
  features: Listed,
): ActionTables {
  const actions = { ...frame } as unknown as Record<string, Action>;
  const owners = new Map(
    Object.keys(frame).map((name) => [name, FRAME_ACTIONS]),
  );
  const gates = new Map<string, Gate>();
  const admin = new Set<string>();
  for (const [name, feature] of features) {
    const gate = gateOf(name, feature);
    const groups = [
      [feature.actions, undefined],
      [feature.adminActions, admin],
    ] as const;
    for (const [table, group] of groups)
      for (const [type, action] of Object.entries(table ?? {})) {
        claim('action', owners, type, fileOf(name));
        // The table is by name: the input of each handler was checked against
        // the map of its name (feature.ts), here the type is erased.
        actions[type] = action as unknown as Action;
        group?.add(type);
        if (gate) gates.set(type, gate);
      }
  }
  return { actions, gates, admin };
}

/** The parts of the frame and of all `features` by ascending order, each key and number once. */
export function assembleState(
  frame: readonly StatePart[],
  features: Listed,
): readonly StatePart[] {
  const parts: (readonly [string, StatePart])[] = [
    ...frame.map((part) => [FRAME_STATE, part] as const),
    ...features.flatMap(([name, feature]) =>
      feature.state
        ? [[fileOf(name), switched(feature.state, feature.enabled)] as const]
        : [],
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

/** The part of a feature that can be off: every key null while it is off in the round (#374). */
function switched(
  part: StatePart,
  enabled: ServerFeature['enabled'],
): StatePart {
  if (!enabled) return part;
  const off = Object.fromEntries(part.keys.map((key) => [key, null]));
  return {
    ...part,
    build: (ctx, u, view) =>
      enabled(view.round) ? part.build(ctx, u, view) : { ...off },
  };
}

/** The actions whose switch refuses with `off`: those of the features behind one switch. */
export const gatedBy = (
  gates: ReadonlyMap<string, Gate>,
  off: string,
): ReadonlySet<string> =>
  new Set([...gates].filter(([, gate]) => gate.off === off).map(([t]) => t));
