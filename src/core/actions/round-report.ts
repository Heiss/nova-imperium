// The input of the actions of the archive of the rounds (#317); see ../actions.ts.
import { input, type None } from '../action-input.ts';

export const actionInputs = {
  roundArchive: input<None>(),
  roundHistory: input<None>(),
  roundReport: input<{ round: number }>(),
  roundRewind: input<{ round: number }>(),
  roundParticipant: input<{ round: number; seat: number }>(),
};
