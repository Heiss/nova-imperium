// The state the server sends (GET /api/state). It is not written here: the
// shapes of its parts are declared in src/core/state/ and `GameState` is
// derived from them (src/core/state.ts, #317), so the server checks what it
// builds against the type the browser reads.
export type { GameState } from '../../core/state.ts';
export type { AdminState } from '../../core/state/admin.ts';
export type {
  ClientFleet,
  GalaxyPlanet,
  Players,
  Report,
} from '../../core/state/frame.ts';
export type {
  Guild,
  GuildChat,
  GuildChatMessage,
  GuildRank,
  GuildRanks,
  GuildState,
} from '../../core/state/guilds.ts';
export type { UnionState } from '../../core/state/union.ts';
