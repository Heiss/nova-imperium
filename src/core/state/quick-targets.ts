// The key of the Schnellwahl in the state (#292, #317).
export type StateShape = {
  /**
   * The places the Schnellwahl of the fleet form lists besides the own ones
   * (#292): the main planets of the friends and of the guild members and the
   * last hostile targets, by place id.
   */
  quick: { friends: string[]; guild: string[]; last: string[] };
};
