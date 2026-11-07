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

Migration 7 adds an optional text body to queued push notifications, so server
announcements keep their text until delivery. Round number and reward switches
are stored as integer keys in the existing settings table.

Migration 8 stores passkey public keys and counters, and short-lived single-use
WebAuthn challenges. Registration challenges are bound to the authenticated
session. Account recovery removes previously registered passkeys.

Account deletion runs in one transaction. Foreign-key cascades clear owned game,
session, reward and push data. The deletion also removes led guilds and their
memberships, linked audit and inbox records, invitations for the account address
and active registration challenges. Incoming fleets belonging to other players
turn back. Existing external backups are managed by the operator.
