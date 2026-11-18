import type { AchievementState } from '../../core/achievements.ts';
import type { Inactivity, PlanetActivity } from '../../core/activity.ts';
import type { RoundRules } from '../../core/round.ts';
// The state the server sends (GET /api/state).
import type { DebrisField } from '../../core/debris.ts';
import type { GateView } from '../../core/jump-gate.ts';
import type { LabSite } from '../../core/research.ts';
import type { ExplainMode } from '../../core/explain.ts';
import type { GuildRight } from '../../core/guild-ranks.ts';
import type { ChatEventKind } from '../../core/guild-chat.ts';
import type { PushTopic } from '../../core/push.ts';
import type { UniverseSpec } from '../../core/universe.ts';
import type {
  Coords,
  Fleet,
  Levels,
  Planet,
  ResearchQueue,
  Universe,
} from '../../core/types.ts';

interface Me {
  id: string;
  name: string;
  research: Levels;
  rq: ResearchQueue | null;
  probes: number;
  /** Display option of the explanation texts (issue #63). */
  explain: ExplainMode;
  /** The push kinds the player switched off, for all devices (#192). */
  pushOff: PushTopic[];
  readAt: number;
  admin: boolean;
  /** When the vacation mode started (#223); null outside of it. */
  vacation: number | null;
}

export type ClientFleet = Pick<
  Fleet,
  | 'id'
  | 'owner'
  | 'fromC'
  | 'toC'
  | 'to'
  | 'mission'
  | 'state'
  | 'arr'
  | 'ships'
> &
  Partial<Pick<Fleet, 'ret' | 'cargo' | 'dep' | 'gift'>>;

export interface Report {
  id: string;
  time: number;
  type: 'info' | 'spy' | 'battle' | 'survey';
  title: string;
  [k: string]: unknown;
}

export interface GalaxyPlanet extends Coords {
  id: string;
  /** A moon is listed like a planet (#53). */
  kind: Planet['kind'];
  name: string;
  temp: number;
  owner: string;
  /** The public activity while it shows one (#229). */
  activity?: PlanetActivity;
}

export interface Players {
  [id: string]: {
    name: string;
    /** The total, also for the noob protection. */
    points: number;
    /** The other categories of the highscore (#78); the server always sends them. */
    scores?: {
      buildings: number;
      research: number;
      fleet: number;
      defense: number;
    };
    /** `inactive` while the account shows its inactivity (#229). */
    inactive?: Inactivity;
    /** Whether the player is in vacation mode (#223). */
    vacation?: boolean;
  };
}

export interface AdminState {
  specs: UniverseSpec[];
  /** The „Endzeit“ (#161): the saved flight time and whether it is used up this round. */
  endzeit: { minutes: number; done: boolean };
}

export interface GameState {
  round: RoundRules;
  now: number;
  cfg: Universe;
  me: Me;
  planet: Planet | null;
  homePlanet?: string | null;
  /** The main planet (#221): the chosen one, else the first planet. */
  mainPlanet?: string | null;
  /** The end of the lock of the last switch while it holds (#221). */
  mainLock?: number | null;
  /** The labs of all own planets, for the research network (issue #49). */
  labs: LabSite[];
  fleets: ClientFleet[];
  reports: Report[];
  players: Players;
  galaxy: GalaxyPlanet[];
  /** Every Trümmerfeld, for every player (#45). */
  debris: DebrisField[];
  /** The own Warp-Tore with their readiness (#230). */
  gates?: GateView[];
  /** The positions locked after an abandonment, with the end of the lock (#224). */
  locks?: (Coords & { until: number })[];
  admin: AdminState | null;
  achievements?: AchievementState;
  /** None while guilds are off in the round (#191). */
  guilds?: GuildState | null;
}

interface GuildMember {
  id: string;
  name: string;
  points: number;
}

export interface Guild {
  id: string;
  tag: string;
  name: string;
  html: string;
  members: GuildMember[];
  score: number;
  average: number;
}

export interface GuildRank {
  id: string;
  name: string;
  rights: GuildRight[];
}

/** The ranks of the own guild (#163); only its members get them. */
export interface GuildRanks {
  /** The Leitung. */
  lead: string;
  /** The own rank. */
  rank: string | null;
  /** The own rights. */
  rights: GuildRight[];
  /** The rank new members get. */
  default: string | null;
  /** Highest first; the first is the Leitung. */
  list: GuildRank[];
  /** The rank of every member. */
  members: Record<string, string | null>;
}

export interface GuildState {
  directory: Guild[];
  own: { id: string; status: 'member' | 'pending' } | null;
  /** For every member; the applications only for a rank with the right. */
  management: {
    id: string;
    description: string;
    pending: Pick<GuildMember, 'id' | 'name'>[];
  } | null;
  ranks?: GuildRanks | null;
  /** The chat of the own guild (#169); none without a chat right. */
  chat?: GuildChat | null;
}

/** A message or an event of the guild chat (#169). */
export interface GuildChatMessage {
  id: number;
  time: number;
  /** A message of a member, or an event of the server (D3, D4). */
  kind: 'message' | ChatEventKind;
  /**
   * The writer of a message, none for a former member or a deleted account
   * („ehemaliges Mitglied“); the member of an event, none once deleted.
   */
  name: string | null;
  /** The message; the new rank or the target of an event, else empty. */
  text: string;
  /** The attacker of an attack, none once deleted. */
  attacker?: string | null;
  /** The arrival of an attack. */
  arrival?: number;
  /** Whether the own rank may delete it; never an event. */
  delete: boolean;
}

/** The chat as the own rank sees it: the messages only with „Chat lesen“. */
export interface GuildChat {
  read: boolean;
  write: boolean;
  messages: GuildChatMessage[];
  /** Whether something is new since the last visit: the mark on „Gilden“. */
  unread: boolean;
}
