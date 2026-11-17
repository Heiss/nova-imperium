// What the button „Ja, neue Runde“ of the dialog „Neue Runde“ sends, out of
// main.ts (ratchet #242): the reward boxes, the guild switch (#191), the
// lock of the main planet (#221) and the refund factor and time of a
// demolition (#202, X1). The server checks every value.
import { demolitionRoundChoice } from './demolition.ts';

/** The choices of the dialog; `val` reads an input, `checked` a box. */
export const roundReset = (
  val: (sel: string) => string,
  checked: (sel: string) => boolean,
) => ({
  rewards: {
    achievements: checked('#round-achievements'),
    daily: checked('#round-daily'),
  },
  guilds: checked('#round-guilds'),
  mainLock: Number(val('#round-main-lock')),
  demolition: demolitionRoundChoice(val),
});
