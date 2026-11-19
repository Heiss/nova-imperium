// The points of the highscore (#78, #288): buildings, defense and the total
// count one point per this many resources spent; fleet and research count
// pieces and levels. The server and the Lexicanum read the same number.

/** The resources that make one point of buildings, defense and the total. */
export const POINT_COST = 1000;

/** The points of the resources spent: one per `POINT_COST`, rounded down. */
export const pointsOf = (spent: number): number =>
  Math.floor(spent / POINT_COST);
