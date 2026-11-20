// The input of the actions of the ranks of a guild and its dissolving (#317); see ../actions.ts.
import { type Attr, input } from '../action-input.ts';

export const actionInputs = {
  createGuildRank: input<{ name: string }>(),
  renameGuildRank: input<{ rank: Attr; name: string }>(),
  setGuildRankRights: input<{ rank: Attr; rights: string[] }>(),
  moveGuildRank: input<{ rank: Attr; up: boolean }>(),
  deleteGuildRank: input<{ rank: Attr }>(),
  setGuildDefaultRank: input<{ rank: Attr }>(),
  assignGuildRank: input<{ uid: Attr; rank: string }>(),
  dissolveGuild: input<{ tag: string }>(),
};
