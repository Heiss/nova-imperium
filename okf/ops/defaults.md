---
type: Policy
title: Defaults stay inside
description: A fresh instance is closed and talks to nobody until the owner configures it.
tags: [defaults, privacy, outbound]
status: draft
generated: { by: claude-code/web, at: 2026-11-06T21:00:00Z }
---

# Decisions

* **[E]** As in muffelblog, the default of every setting is the one that keeps
  the instance to itself.
* **[E]** Registration is closed: only invited addresses can register.
* **[E]** Mail is off until `SMTP_HOST` is set; the demo sends to the local
  Mailpit.

# Known cases

* **[V]** The port listens on `127.0.0.1` (`NOVA_BIND`); the server alone
  listens on `127.0.0.1` unless the image sets `0.0.0.0` inside the network.
* **[V]** `NOVA_TRUST_PROXY` is off; only `compose.yaml` switches it on,
  because there only Caddy reaches the server.
* The browser loads nothing from other hosts: scripts, styles, the favicon
  and the art come from the game itself (the CSP enforces it).
