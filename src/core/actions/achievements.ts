// The input of the actions of the achievements (#317); see ../actions.ts.
import { type Attr, input, type None } from '../action-input.ts';

export const actionInputs = {
  claimAchievement: input<{ id: Attr }>(),
  claimDailyReward: input<None>(),
};
