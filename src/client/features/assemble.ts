// The tables of main.ts (#322): its own frame handlers plus those of every
// listed feature, for the `data-act` names and for the ids of the forms, and
// the hook after a render. A
// name defined twice stops the start with the two places named, so no feature
// silently replaces another's handler by the order of a spread.
import type { ClientCtx, ClientFeature, Handler } from './contract.ts';

/** The modules as the generated list gives them: `[name, clientFeature]`. */
export type Listed = readonly (readonly [string, ClientFeature])[];

/** The frame's `table` and what each module adds, each name once. */
function merge<H>(
  kind: string,
  frame: Readonly<Record<string, H>>,
  added: readonly (readonly [string, Record<string, H>])[],
): Record<string, H> {
  const table: Record<string, H> = { ...frame };
  const owner = new Map(Object.keys(frame).map((name) => [name, 'main.ts']));
  for (const [file, handlers] of added)
    for (const [name, handler] of Object.entries(handlers)) {
      if (owner.has(name))
        throw new Error(
          `${kind} "${name}" is defined in ${owner.get(name)} and in features/${file}.ts.`,
        );
      owner.set(name, `features/${file}.ts`);
      table[name] = handler;
    }
  return table;
}

/** The frame handlers and those of all `features`, each name once. */
export function assembleActs(
  frame: Readonly<Record<string, Handler>>,
  features: Listed,
  ctx: ClientCtx,
): Record<string, Handler> {
  return merge(
    'data-act',
    frame,
    features.map(([file, feature]) => [file, feature.acts(ctx)]),
  );
}

/** The form handlers of the frame and of all `features`, each form id once. */
export function assembleForms(
  frame: Readonly<Record<string, () => unknown>>,
  features: Listed,
  ctx: ClientCtx,
): Record<string, () => unknown> {
  return merge(
    'form',
    frame,
    features.map(([file, feature]) => [file, feature.forms?.(ctx) ?? {}]),
  );
}

/** Runs the `afterRender` of every module, in the order of the list. */
export function runAfterRender(features: Listed): void {
  for (const [, feature] of features) feature.afterRender?.();
}
