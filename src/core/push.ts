// The kinds of Web Push a player switches on and off in the options (issue
// #192). The switches belong to the account and apply to all of its devices;
// whether a device gets pushes at all stays its own opt-in. Every kind is on
// unless the player switched it off, so a new kind is on for everyone.

import { ownedOnce } from './owned-once.ts';
import { PUSH_TOPIC_LISTS } from './push-topics/topics.gen.ts';

/** What a file of src/core/push-topics declares for a kind (#426). */
interface TopicEntry {
  key: string;
  /** The place in the options: the kinds go by ascending order. */
  order: number;
  /** The German name of the kind in the options. */
  label: string;
  /** A kind of the guild chat, hidden while guilds are off. */
  guild?: boolean;
}

/** The modules as the generated list gives them: `[name in the folder, pushTopics]`. */
type ListedTopics = readonly (readonly [string, readonly TopicEntry[]])[];

/**
 * The kinds of all modules by ascending order, each key and order once; a
 * key or an order defined twice stops the start with both files named.
 */
export function assembleTopics(listed: ListedTopics): readonly TopicEntry[] {
  const once = ownedOnce('Push kind');
  const entries = listed.flatMap(([name, topics]) =>
    topics.map((topic) => ({ file: `src/core/push-topics/${name}.ts`, topic })),
  );
  for (const { file, topic } of entries) {
    if (!Number.isFinite(topic.order))
      throw new Error(`Push kind ${topic.key} in ${file} has no order.`);
    once('key', topic.key, file);
    once('order', String(topic.order), file);
  }
  return entries.map((e) => e.topic).sort((a, b) => a.order - b.order);
}

export type PushTopic = (typeof PUSH_TOPIC_LISTS)[number][1][number]['key'];

const TOPICS = assembleTopics(PUSH_TOPIC_LISTS);

/**
 * The kinds, in the order of the options, taken from every place that sends
 * a push ([E], owner, 2026-11-14, #192). Each registers itself in a file of
 * src/core/push-topics (#426): `guild-events` and `guild-chat` belong to the
 * guild chat (#169), `private-messages` to the private messages (#226,
 * owner, 2026-11-21).
 */
export const PUSH_TOPICS: readonly PushTopic[] = TOPICS.map(
  (t) => t.key as PushTopic,
);

/**
 * The kinds of the guild chat (#169): hidden in the options while guilds
 * are off in the round (owner, 2026-11-15).
 */
export const GUILD_PUSH_TOPICS: readonly PushTopic[] = TOPICS.filter(
  (t) => t.guild === true,
).map((t) => t.key as PushTopic);

/** The names of the kinds ([E], owner, 2026-11-14), from their entries. */
export const pushTopicLabel = (topic: PushTopic): string =>
  TOPICS.find((t) => t.key === topic)!.label;

export const isPushTopic = (x: unknown): x is PushTopic =>
  (PUSH_TOPICS as readonly unknown[]).includes(x);
