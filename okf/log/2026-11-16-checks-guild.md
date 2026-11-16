---
type: log-entry
date: 2026-11-16T22:55
kind: Code
issues: [214]
---

#214, the guild pull request: the check of each of the 14 guild actions and the three of the chat is one pure function that returns codes in the order of the server, so they follow section 7 of [Design patterns](/architecture/patterns.md): the new `core/guild-checks.ts` (`createGuildError`, `updateGuildError`, `applyError`, `reviewError`, `leaveError`, `manageMemberError`, `createRankError`, `renameRankError`, `rightsError`, `moveRankError`, `deleteRankError`, `defaultRankError`, `assignRankError`, `dissolveError`, with the rank rules of `core/guild-ranks.ts` as their parts; a security file, mutation floor 100) and `sendChatError`, `deleteChatError`, `seeChatError` in `core/guild-chat.ts`; the server words the codes from tables with the messages unchanged, and the guild view asks the same checks for the member and rank controls, which show exactly what they did; no finding of the guild is one O18 (c) unifies, so F16 and F17 stay as they are; nothing visible changes, label `kein-changelog`; unit and property tests per check, the old messages and their order checked on the server, the controls of each rank checked in the view, both also against the code before (see [Checks of the server actions](/architecture/action-checks.md), [Guild ranks](/features/guild-ranks.md), [Guild chat](/features/guild-chat.md)).
