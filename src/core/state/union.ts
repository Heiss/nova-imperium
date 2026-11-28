// The key of the attack unions in the state (#225, #317).
import type { Coords, Levels } from '../types.ts';

/** An attack union as the server sends it to a player in it or invited to it (#225); the ships stay hidden. */
export interface UnionState {
  /** The ID of the union, which is the ID of its leader's fleet. */
  id: string;
  /** The player who leads it, by id. */
  leader: string;
  /** The place the union flies to. */
  to: string;
  toC: Coords;
  /** When all its fleets arrive. */
  arr: number;
  /** When the leader's fleet starts by itself, while it is planned (#478). */
  start?: number;
  /**
   * For the leader only, while his start is planned (#478): the planet it
   * starts from and the ships it holds back there.
   */
  held?: { from: string; ships: Levels };
  /** Its fleets with their owners, the leader's first. */
  fleets: { id: string; owner: string }[];
  /** The players invited who have not joined. */
  invited: string[];
}

export type StateShape = {
  /** The attack unions the player leads, flies in or is invited to (#225). */
  unions: UnionState[];
};
