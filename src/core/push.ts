// The kinds of Web Push a player switches on and off in the options (issue
// #192). The switches belong to the account and apply to all of its devices;
// whether a device gets pushes at all stays its own opt-in. Every kind is on
// unless the player switched it off, so a new kind is on for everyone.

/**
 * The kinds, in the order of the options, taken from every place that sends
 * a push ([E], owner, 2026-11-14, #192). `guild-events` and `guild-chat` belong to
 * the guild chat (#169); nothing sends them yet.
 */
export const PUSH_TOPICS = [
  'buildings',
  'research',
  'shipyard',
  'fleet',
  'attacked',
  'spied',
  'delivery',
  'announcement',
  'news',
  'guild-events',
  'guild-chat',
] as const;
export type PushTopic = (typeof PUSH_TOPICS)[number];

export const isPushTopic = (x: unknown): x is PushTopic =>
  (PUSH_TOPICS as readonly unknown[]).includes(x);
