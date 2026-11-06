---
type: Specification
title: Invitations
description: Registration only by invitation; invitation by mail or copied link; tokens and their protection.
tags: [invitations, registration, mail, smtp]
status: draft
generated: { by: claude-code/web, at: 2026-11-06T21:00:00Z }
---

# Decisions

* **[E]** Nobody registers without an invitation. The invitation code of
  version 1 is gone.
* **[E]** The admin enters an e-mail address in the admin panel; an
  invitation mail with a link goes out through SMTP (nodemailer). The SMTP
  settings are environment variables, the password a secret file.
* **[E]** The link is valid once and for 7 days (`NOVA_INVITE_DAYS`), bound to
  the address: the account gets that address, it cannot be changed at the
  registration.
* **[E]** The admin can also copy the link, for example when no mail arrives
  or no SMTP is set up. The admin sees the open invitations and can revoke
  them.

# Details (proposals)

* **[V]** The token is 32 random bytes; only its SHA-256 is stored. So the
  link is shown only right after it is created; a lost link means a new
  invitation.
* **[V]** The token travels in the fragment (`/#invite=…`): browsers never
  send it to a server or in a `Referer`, and the page removes it from the
  address bar at once.
* **[V]** A new invitation for an address revokes its open one. An address
  that already has an account cannot be invited.
* **[V]** If the mail fails, the invitation stays valid and the admin gets
  the link with a message; the failure is logged.
* **[V]** The operator command `nova invite <address>` creates the first
  invitation of a fresh instance (there is no admin yet who could invite).
* **[V]** The check of a token and the registration are rate-limited like
  the login.

# Tests

Unit tests for tokens, expiry, revocation, address binding; HTTP tests for the
API with a mailer double; E2E for link, single use, fragment removal and the
copy path; the Compose smoke test sends a real mail to Mailpit and registers
with its link.
