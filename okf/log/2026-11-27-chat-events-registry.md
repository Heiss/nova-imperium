---
type: log-entry
date: 2026-11-27T17:30
kind: Code
issues: [426]
---

#426 part 6 built with the owner's decisions of 2026-11-26 (192a, 193b) and the coordinator's choices of 2026-11-27 [V]: the kinds of event of the guild chat register themselves like the rights of the guild ranks. `src/core/chat-events/membership.ts`, `rank.ts` and `attack.ts` export `chatEvents`, entries of key, order and the sentence of the kind, moved unchanged out of `chatEventText`; the sentences get the names already resolved as plain text, so the files import nothing and no cycle with `guild-chat.ts` arises. `scripts/gen-features.ts` writes `chat-events/events.gen.ts`; `src/core/guild-chat.ts` derives `CHAT_EVENTS` and `ChatEventKind`, stops the start at a key or an order defined twice, and `chatEventText` names no kind. The list, `isChatEvent` and the sentence of every kind with and without names, attackers and arrival were compared before and after, byte for byte, in 450 cases; the existing tests run unchanged. The CHECK of `guild_chat.kind` stays in the migrations (192a): a new test migrates an in-memory database, reads the CHECK of the column and fails, naming both lists, when its kinds and „message“ with `CHAT_EVENTS` differ, so a new kind needs a new migration (shown with a kind added for the test only).
