// What the dialog „Neue Runde“ sends with „Ja, neue Runde“: the rewards,
// the guild switch (#191), the lock of the main planet (#221) and the
// thresholds of the activity markers (#229). The server checks them.
import { activityNumbers } from './activity.ts';

/** The choices of the dialog; `val` reads an input, `checked` a box. */
export const roundChoices = (
  val: (sel: string) => string,
  checked: (sel: string) => boolean,
) => ({
  rewards: {
    achievements: checked('#round-achievements'),
    daily: checked('#round-daily'),
  },
  guilds: checked('#round-guilds'),
  mainLock: Number(val('#round-main-lock')),
  activity: activityNumbers(val),
});
