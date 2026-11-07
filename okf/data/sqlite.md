---
type: Concept
title: SQLite storage
description: Database schema, migrations, transactions, and backups.
---

# SQLite storage

The server stores game state and accounts in `nova.sqlite` in the configured
data directory. The schema covers accounts, sessions and invitations, planets,
fleets, reports, universe settings, account security tokens, suspensions and
audit data.

On startup, the database enables foreign keys and uses WAL mode for on-disk
databases. Migrations are applied in order in a transaction, with the current
schema version recorded in SQLite's `user_version`. Store operations can group
related updates in a transaction.

In Docker Compose, the named data volume persists the database across container
replacements. Follow the [backup and restore procedure](../../docs/operations.md#backup-and-restore)
before upgrades.


## Admin data

Migration 6 adds these tables:

| Table | Data |
| --- | --- |
| `audit_events` | Chronological audit entries with an actor, action, outcome, target, request ID and operation-specific metadata. |
| `player_activity` | Last observed interaction and estimated active milliseconds per player and UTC day. |
| `suspensions` | Player suspension reason and optional expiration. |

Successful audited changes and their entries commit together. Rejected or
failed changes can leave an audit entry after the game-state transaction rolls
back. The hourly sweep removes events and activity data older than 30 days.
Backups of the SQLite database include the data present at backup time.

See [Admin](/features/admin.md) for the access rules and measurement method.
