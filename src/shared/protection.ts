// Noob protection, used by the server and the galaxy view: a player with less
// than a fifth of your points can be neither attacked nor spied on by you.
export const isProtected = (myPoints: number, theirPoints: number): boolean =>
  theirPoints * 5 < myPoints;
