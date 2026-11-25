// „Optionen“, the data of the box of the kinds of push messages (#192), shown
// only on a server with Web Push.
import { type PushKind, pushKinds, shownPushOff } from '../push-options.ts';
import type { OptionsState } from './state.ts';

/** The part of the page the box shows. */
export interface PushPart {
  /** The checkboxes of the push kinds; none on a server without Web Push. */
  pushKinds: PushKind[] | null;
}

/** The push kinds at the view state, the pending choice first. */
export const pushPart = ({ s, ui }: OptionsState): PushPart => ({
  pushKinds: pushKinds(
    ui.webPush,
    shownPushOff(ui, s.me.pushOff),
    s.round.guilds,
  ),
});

/** The box is shown on a server with Web Push only. */
export const pushShown = (page: PushPart): boolean => page.pushKinds !== null;
