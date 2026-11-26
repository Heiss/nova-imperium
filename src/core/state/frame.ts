// The keys of the state every player gets that belong to no feature (#317):
// the types of what `stateFor` builds in src/server/game/state.ts. The browser
// derives its `GameState` from the shapes of all parts (src/core/state.ts).
import type { Inactivity, PlanetActivity } from '../activity.ts';
import type { ShownProtection } from '../galaxy-shown.ts';
import type { DebrisField } from '../debris.ts';
import type { ExplainMode } from '../explain.ts';
import type { SeenShips } from '../fleet-recognition.ts';
import type { LevelMode } from '../level-overview.ts';
import type { PushTopic } from '../push.ts';
import type { LabSite } from '../research.ts';
import type { RoundRules } from '../round.ts';
import type {
  Coords,
  Fleet,
  Levels,
  Planet,
  ResearchQueue,
  Universe,
} from '../types.ts';

/** The own account (`meOf`). */
interface Me {
  id: string;
  name: string;
  research: Levels;
  rq: ResearchQueue | null;
  probes: number;
  /** Display option of the explanation texts (issue #63). */
  explain: ExplainMode;
  /** Display option of the level overview (#187). */
  levelTable: LevelMode;
  /** The push kinds the player switched off, for all devices (#192). */
  pushOff: PushTopic[];
  readAt: number;
  admin: boolean;
  /** When the vacation mode started (#223); null outside of it. */
  vacation: number | null;
}

export type ClientFleet = Pick<
  Fleet,
  'id' | 'owner' | 'fromC' | 'toC' | 'to' | 'mission' | 'state' | 'arr'
> &
  Partial<
    Pick<Fleet, 'ships' | 'ret' | 'cargo' | 'dep' | 'gift' | 'hold' | 'union'>
  > &
  /** Of a foreign fleet the server sends only what the Auspex-Lehre recognizes (#228). */
  Omit<SeenShips, 'ships'>;

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

export type StateShape = {
  round: RoundRules;
  now: number;
  cfg: Universe;
  me: Me;
  planet: Planet | null;
  /** The labs of all own planets, for the research network (issue #49). */
  labs: LabSite[];
  fleets: ClientFleet[];
  reports: Report[];
  players: Players;
  /** When the points and categories of `players` were computed: „Stand“ (#405). */
  scoresAt: number;
  galaxy: GalaxyPlanet[];
  /**
   * The owners of the system the Sternenkarte shows that the noob protection
   * covers, by exact points (151a); only while the request names the system.
   */
  protectedOwners?: ShownProtection;
  /** Every Trümmerfeld, for every player (#45). */
  debris: DebrisField[];
};
