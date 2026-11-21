---
type: log-entry
date: 2026-11-21T09:00
kind: Code
issues: [214]
---

#214, the guild group (the earlier branch `claude/checks-guild` was never merged and is built again on the collecting branch): the check of each of the 14 guild actions and the three of the chat is one pure function that returns the code of its first refusal in the order of the server, so they follow section 7 of [Design patterns](/architecture/patterns.md): the new `core/guild-checks.ts` (with the rank rules of `core/guild-ranks.ts` as parts) and `sendChatError`, `deleteChatError`, `seeChatError` in `core/guild-chat.ts`. The server words the codes from tables with the messages unchanged; the guild page (`client/logic/guilds.ts`) asks the same checks for its member and rank controls and offers exactly what it did. The refusals and their order were pinned on the server first (`guild-order.test.ts`, green before and after the move). No behaviour changes; F16 and F17 stay as they are (see [Checks of the server actions](/architecture/action-checks.md), [Guild ranks](/features/guild-ranks.md), [Guild chat](/features/guild-chat.md)).
