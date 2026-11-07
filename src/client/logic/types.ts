import type { AchievementState } from '../../shared/achievements.ts';
// The state the server sends (GET /api/state).
import type { UniverseSpec } from '../../shared/universe.ts';
import type {
  Coords,
  Fleet,
  Levels,
  Planet,
  Queue,
  Universe,
} from '../../shared/types.ts';

export interface Me {
  id: string;
  name: string;
  research: Levels;
  rq: Queue | null;
  probes: number;
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

export interface GalaxyPlanet extends Coords {
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
  invitations: {
    id: string;
    email: string;
    created: number;
    expires: number;
  }[];
}

export interface GameState {
  now: number;
  cfg: Universe;
  me: Me;
  planet: Planet | null;
  fleets: ClientFleet[];
  reports: Report[];
  players: Players;
  galaxy: GalaxyPlanet[];
  admin: AdminState | null;
  achievements?: AchievementState;
  guilds?: GuildState;
}

export interface GuildMember {
  id: string;
  name: string;
  points: number;
}

export interface Guild {
  id: string;
  tag: string;
  name: string;
  founder: string;
  html: string;
  members: GuildMember[];
  score: number;
  average: number;
}

export interface GuildState {
  directory: Guild[];
  own: { id: string; status: 'member' | 'pending' } | null;
  management: {
    id: string;
    description: string;
    pending: Pick<GuildMember, 'id' | 'name'>[];
  } | null;
}
