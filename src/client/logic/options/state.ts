// What the boxes of „Optionen“ read of the view state (#378): the state, the
// time and the part of the interface state they show, so their data stays
// pure logic and needs nothing of the views.
import type { NewsData } from '../news.ts';
import type { PushChoice } from '../push-options.ts';
import type { HoldChoice } from './holding.ts';
import type { GameState } from '../types.ts';

/** The view state as the data of a box reads it. */
export interface OptionsState {
  s: GameState;
  now: number;
  ui: PushChoice &
    HoldChoice & {
      view: string;
      animations: boolean;
      passwordMinLength?: number;
      webPush?: boolean;
      lastRequestId?: string | null;
      news: Pick<NewsData, 'version'> | null;
    };
}
