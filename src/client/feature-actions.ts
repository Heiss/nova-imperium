// The data-act handlers of the features that keep them out of main.ts
// (ratchet #242): a feature with buttons and forms of its own adds its
// handlers in a module of its own and lists it here, so main.ts does not grow
// with it.
import { abandonActs } from './abandon-actions.ts';
import { marketActs } from './market-actions.ts';
import { roundActs } from './round-actions.ts';
import { socialActs } from './social-actions.ts';

/** The data of the element a handler was called for. */
type Data = Record<string, string | undefined>;

/** What the actions need from main.ts. */
interface Deps {
  act: (type: string, data?: object) => Promise<boolean>;
  modal: (html: string) => void;
}

/** The handlers of „Kolonie aufgeben“, „Neue Runde“, the marketplace and the buddy list. */
export const featureActs = (
  deps: Deps,
): Record<string, (d: Data) => unknown> => ({
  ...abandonActs(deps),
  ...roundActs(deps),
  ...marketActs(deps),
  ...socialActs(deps),
});
