// The keys of the main planet in the state (#221, #317).
export type StateShape = {
  homePlanet: string | null;
  /** The main planet (#221): the chosen one, else the first planet. */
  mainPlanet: string | null;
  /** The end of the lock of the last switch while it holds (#221). */
  mainLock: number | null;
};
