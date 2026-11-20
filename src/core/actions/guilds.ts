// The input of the actions of the guilds (#317); see ../actions.ts.
import { type Attr, input, type None } from '../action-input.ts';

/** The tag, the name and the description of a guild. */
interface GuildProfile {
  tag: string;
  name: string;
  description: string;
}

export const actionInputs = {
  createGuild: input<GuildProfile>(),
  updateGuild: input<GuildProfile>(),
  applyToGuild: input<{ id: Attr }>(),
  reviewGuildApplication: input<{ uid: Attr; accept: boolean }>(),
  leaveGuild: input<None>(),
  manageGuildMember: input<{ uid: Attr; transfer: boolean; rank?: string }>(),
};
