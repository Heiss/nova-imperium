---
type: feature
title: Guild log
description: A page with the actions of a guild's management, for the members with the right „Protokoll lesen“; texts only as „geändert“, deleted at every new round, at most 500 entries per guild. Decided 2026-11-25, not built.
---

# Guild log

The owner's decisions of 2026-11-25 (O32), from the talk about the
[Data exchange and realtime](/architecture/realtime.md). Not built yet.

* **[E]** Purpose: the Leitung, and whoever it lets, sees who changed what
  in the guild, as the admin does in the event log of the server.
* **[E]** A page of its own, like the event log of the admin, not in the
  [Guild chat](/features/guild-chat.md).
* **[E]** A new right of the ranks, „Protokoll lesen“; the Leitung holds it
  as every right ([Guild ranks](/features/guild-ranks.md)).
* **[E]** What it records, with who and when: the profile changed; a rank
  created, renamed, its rights changed, moved, deleted or made the default;
  the rank of a member changed; an application accepted or refused; a
  member removed. One save of a form is one entry.
* **[E]** Texts only as „geändert“, never the old or the new text.
* **[E]** Deleted at every new round, like the chat; at most 500 entries
  per guild.
* **[E]** The events of the chat (joining, leaving, a new rank, an attack)
  stay in the chat as they are.
