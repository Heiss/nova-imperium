import type { AchievementState, RoundRules } from '../../core/achievements.ts';
// The state the server sends (GET /api/state).
import type { LabSite } from '../../core/research.ts';
import type { ExplainMode } from '../../core/explain.ts';
import type { GuildRight } from '../../core/guild-ranks.ts';
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
  readAt: number;
  admin: boolean;
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
  Partial<Pick<Fleet, 'ret' | 'cargo' | 'dep'>>;

export interface Report {
  id: string;
  time: number;
  type: 'info' | 'spy' | 'battle';
  title: string;
  [k: string]: unknown;
}

interface GalaxyPlanet extends Coords {
  id: string;
  name: string;
  temp: number;
  owner: string;
}

export interface Players {
  [id: string]: { name: string; points: number };
}

export interface AdminState {
  specs: UniverseSpec[];
}

export interface GameState {
  round: RoundRules;
  now: number;
  cfg: Universe;
  me: Me;
  planet: Planet | null;
  homePlanet?: string | null;
  /** The labs of all own planets, for the research network (issue #49). */
  labs: LabSite[];
  fleets: ClientFleet[];
  reports: Report[];
  players: Players;
  galaxy: GalaxyPlanet[];
  admin: AdminState | null;
  achievements?: AchievementState;
  guilds?: GuildState;
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
}
