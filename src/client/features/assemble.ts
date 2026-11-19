// The table of the `data-act` handlers of main.ts (#322): its own frame
// handlers plus those of every listed feature. A name defined twice stops the
// start with the two places named, so no feature silently replaces another's
// handler by the order of a spread.
import type { ClientCtx, ClientFeature, Handler } from './contract.ts';

/** The modules as the generated list gives them: `[name, clientFeature]`. */
export type Listed = readonly (readonly [string, ClientFeature])[];

/** The frame handlers and those of all `features`, each name once. */
export function assembleActs(
  frame: Readonly<Record<string, Handler>>,
  features: Listed,
  ctx: ClientCtx,
): Record<string, Handler> {
  const table: Record<string, Handler> = { ...frame };
  const owner = new Map(Object.keys(frame).map((name) => [name, 'main.ts']));
  for (const [file, feature] of features)
    for (const [name, handler] of Object.entries(feature.acts(ctx))) {
      if (owner.has(name))
        throw new Error(
          `data-act "${name}" is defined in ${owner.get(name)} and in features/${file}.ts.`,
        );
      owner.set(name, `features/${file}.ts`);
      table[name] = handler;
    }
  return table;
}
