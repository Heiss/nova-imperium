// The class of every action for the count of „Spielaktionen“ of the own
// activity (#335, okf/features/own-activity.md, „The play actions from the
// journal“). The table gives each action exactly one class; a new action
// without a class is a type error, and `action-kind.test.ts` checks the table
// against the declared actions.
import type { ActionName } from './actions.ts';

/**
 * - `change`: the action changes something; counted.
 * - `click`: a read the player starts on purpose by a click; counted.
 * - `view`: a read a view makes by itself; not counted.
 * - `auto`: a write the page sends by itself (the player does not start it on
 *   purpose); not counted.
 */
export type ActionKind = 'change' | 'click' | 'view' | 'auto';

export const ACTION_KIND = {
  abandon: 'change',
  build: 'change',
  cancelBuild: 'change',
  research: 'change',
  cancelResearch: 'change',
  order: 'change',
  cancelOrder: 'change',
  pct: 'change',
  rename: 'change',
  options: 'change',
  delrep: 'change',
  delall: 'change',
  claimAchievement: 'change',
  claimDailyReward: 'change',
  settings: 'change',
  reset: 'change',
  demolish: 'change',
  endzeit: 'change',
  send: 'change',
  recall: 'change',
  requestFriend: 'change',
  answerFriend: 'change',
  cancelFriend: 'change',
  removeFriend: 'change',
  sendGuildChat: 'change',
  deleteGuildChat: 'change',
  createGuildRank: 'change',
  renameGuildRank: 'change',
  setGuildRankRights: 'change',
  moveGuildRank: 'change',
  deleteGuildRank: 'change',
  setGuildDefaultRank: 'change',
  assignGuildRank: 'change',
  dissolveGuild: 'change',
  createGuild: 'change',
  updateGuild: 'change',
  applyToGuild: 'change',
  reviewGuildApplication: 'change',
  leaveGuild: 'change',
  manageGuildMember: 'change',
  jump: 'change',
  mainPlanet: 'change',
  trade: 'change',
  missile: 'change',
  tearDownMissiles: 'change',
  pushOptions: 'change',
  closeRound: 'change',
  deleteRound: 'change',
  openUnion: 'change',
  inviteUnion: 'change',
  startVacation: 'change',
  endVacation: 'change',
  sendPrivateMessage: 'change',
  deletePrivateMessage: 'change',
  deletePrivateConversation: 'change',
  reportPrivateMessage: 'change',
  blockPlayer: 'change',
  unblockPlayer: 'change',
  privateMessageOptions: 'change',
  // Deliberate reads: opened by a click.
  roundReport: 'click',
  roundRewind: 'click',
  roundParticipant: 'click',
  scan: 'click',
  openPrivateConversation: 'click',
  olderPrivateMessages: 'click',
  sentPrivateMessages: 'click',
  // Reads a view makes by itself.
  roundArchive: 'view',
  roundHistory: 'view',
  // Writes the page sends by itself: the reports are marked read after
  // „Nachrichten“ is drawn, the mark of the guild chat is cleared on its own,
  // an opened private conversation marks its messages read after a moment.
  read: 'auto',
  readPrivateMessages: 'auto',
  seeGuildChat: 'auto',
} as const satisfies Record<ActionName, ActionKind>;

/** True when `name` is a known action of a class that counts as a play action. */
export function countsAsPlayAction(name: string): boolean {
  if (!Object.hasOwn(ACTION_KIND, name)) return false;
  const kind: ActionKind = ACTION_KIND[name as ActionName];
  return kind === 'change' || kind === 'click';
}
