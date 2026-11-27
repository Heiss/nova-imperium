---
type: log-entry
date: 2026-11-27T11:10
kind: Code
issues: [426, 430]
---

#426 part 2 built with the owner's decisions of 2026-11-26 (192a, 193b) and the coordinator's choice b of 2026-11-27 [V]: the push kinds register themselves like the pages of the Lexicanum (#430). Each file of `src/core/push-topics/` (`queues.ts`, `fleet.ts`, `announcements.ts`, `guild-chat.ts`, `private-messages.ts`) exports `pushTopics`, entries of key, order, the German name and, for the two kinds of the guild chat, `guild`; `scripts/gen-features.ts` writes `push-topics/topics.gen.ts`, and `src/core/push.ts` derives `PUSH_TOPICS`, `GUILD_PUSH_TOPICS`, the type `PushTopic` and the name of a kind from it, and stops the start at a key or an order defined twice. The names were moved unchanged out of `src/client/logic/push-options.ts`, which names no kind any more. The orders 10 to 120 keep the order of the options: the lists, the checkboxes and their markup were compared before and after, byte for byte, with and without guilds.
