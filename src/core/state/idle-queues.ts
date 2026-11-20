// The key of the idle planets in the state (#189, #317).
export type StateShape = {
  /**
   * The ids of the other own planets and moons without a running building
   * (#189, D5), for the card „Bereit“; the browser words them from `galaxy`.
   */
  idle: string[];
};
