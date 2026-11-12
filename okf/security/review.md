---
type: Review
title: Security measures
description: What protects accounts, data and the browser in this setup, and what is still open.
tags: [security, review]
status: draft
generated: { by: claude-code/web, at: 2026-11-06T21:00:00Z }
---

# In place

| Area | Measure | Marker |
|---|---|---|
| Accounts | Registration only by invitation; admins only by operator command | [E] |
| Passwords | scrypt with a random salt per player, compared in constant time (kept from version 1); 6 to 200 characters | [E] kept, [V] maximum |
| Sessions | 32 random bytes in an `HttpOnly`, `SameSite=Lax` cookie, `Secure` with an https address; only the SHA-256 is stored; expiry `NOVA_SESSION_DAYS` | [V] |
| Invitations | single-use, expiring, hashed, in the URL fragment | [E]/[V] |
| Cross-site requests | posts must be JSON and come from `NOVA_PUBLIC_URL` (`Origin`) | [V] |
| Brute force | rate limit per client address on login, registration, invitation check | [E] kept from version 1, configurable |
| Client address | only Caddy's `X-Real-IP` with `NOVA_TRUST_PROXY=1`; Caddy reads `X-Forwarded-For` only from trusted proxies | [V] |
| Browser | CSP `default-src 'none'`, scripts and styles only from the own host, no inline code; `X-Frame-Options DENY`, `nosniff`, `no-referrer`, COOP, CORP, permissions policy | [E] Caddy like muffelblog, [V] values |
| Output | every text of players goes through HTML escaping in the client | [E] kept |
| Input | body limit 64 KB, JSON objects only, numbers clamped, names cleaned of control characters | [E] kept |
| Files | static files only below the client folder | [E] kept |
| Database | prepared statements only; foreign keys; transactions | [V] |
| Error log | Server errors, browser errors and problem reports are scrubbed before storing (no passwords, tokens, login codes, email addresses; never request bodies); browser errors only from signed-in players, 20 per minute and 200 per day, reports 5 per hour; list and ZIP download for admins only, audited as admin reads; kept 30 days (issue #126, [Error log](/features/error-log.md)) | [E], [V] rules |
| Secrets | from files (`NAME_FILE`), both ways set = no start; nothing secret in the repository (gitleaks in CI) | [E] |
| Containers | non-root, read-only root, no capabilities, `no-new-privileges`, only Caddy published on 127.0.0.1 | [V] |
| Supply chain | lockfile, `pnpm audit` (high blocks), Renovate with 3 days of waiting, CodeQL, Trivy, pinned CI images | [E] like muffelblog |

# Open

* **[U]** No HSTS from the game: it belongs to the reverse proxy that knows
  about HTTPS (as decided in muffelblog), documented in `docs/operations.md`.
* The minimum password length stays at 6 like version 1; a longer minimum is
  an open point.
* No account lock-out per name, only the limit per address.
