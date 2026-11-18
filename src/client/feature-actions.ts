// The data-act handlers of the features that keep them out of main.ts
// (ratchet #242): a feature with buttons and forms of its own adds its
// handlers in a module of its own and lists it here, so main.ts does not grow
// with it.
import { abandonActs } from './abandon-actions.ts';
import { marketActs } from './market-actions.ts';
import { roundActs } from './round-actions.ts';

/** What the actions need from main.ts. */
interface Deps {
  act: (type: string, data?: object) => Promise<boolean>;
  modal: (html: string) => void;
}

/** The handlers of „Kolonie aufgeben“, „Neue Runde“ and the marketplace. */
export const featureActs = (deps: Deps): Record<string, () => void> => ({
  ...abandonActs(deps),
  ...roundActs(deps),
  ...marketActs(deps),
});
