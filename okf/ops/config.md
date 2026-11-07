---
type: Policy
title: Configuration
description: Environment variables, secret files and the fail-closed rule.
tags: [configuration, environment-variables, secrets]
status: draft
generated: { by: claude-code/web, at: 2026-11-06T21:00:00Z }
---

# Decisions

* **[E]** Settings come from `.env` through environment variables; important
  values can come from secret files (`NAME_FILE`, Docker secrets).
* **[E]** Both `NAME` and `NAME_FILE` set: the server does not start.
* **[E]** SMTP settings are environment variables, the password a secret file.
* **[E]** Universe values are not environment variables; the admin sets them
  in the game (see [Admin](/features/admin.md)).

# Rules (as in muffelblog)

* **[V]** An invalid value stops the start, every error is named at once with
  the variable and its range; nothing falls back to the default silently.
  An empty variable counts as unset (Compose passes unset ones like that).
* **[V]** Names follow `NOVA_<NAME>`; SMTP and the sender keep the common
  names `SMTP_*` and `MAIL_FROM` (as in muffelblog).
* The source of truth is `src/server/config.ts`; the table is
  `docs/configuration.md`, a test keeps code, table, `.env.example` and
  `compose.yaml` in line.

# Variables

See `docs/configuration.md`. Numeric values with their defaults: session days
30, invitation days 7, rate limit 20 attempts per 10 minutes (the values of
version 1), port 8080.

`NOVA_PASSWORD_MIN_LENGTH` defaults to 15 characters and accepts 8 to 200.
It applies at registration, password change and password reset. The server
reads it at startup. Existing passwords remain usable.
