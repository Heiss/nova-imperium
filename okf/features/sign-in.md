---
type: feature
title: Sign-in with a second factor
description: A sign-in is a passkey, or name and password with a second factor; the mail code is on by default, comes at once and can be sent again after 30 s; a link in the mail and an authenticator app (TOTP) follow (#401).
---

# Sign-in with a second factor

Issue #401, asked for by the owner on 2026-11-25 after a sign-in on a new
device without a code (`NOVA_EMAIL_LOGIN_CODES` was not set; the Compose file
gave `0`). Own pull request after #395 (98a).

## Decisions (owner, 2026-11-25)

* **[E]** A sign-in is a passkey, or name and password with a second factor.
* **[E]** `NOVA_EMAIL_LOGIN_CODES` stays; its default is on (94b). **[V]**
  `config.ts` reads an unset value as `1`, `compose.yaml` passes `1` when
  `.env` has none, and `.env.example` says `1`. The server refuses to start
  with the code on and no SMTP, as before; `0` turns it off. The servers of
  the tests without SMTP set `0` (`e2e/env.ts`, `start.test.ts`); the Docker
  smoke and upgrade tests sign in with the code from Mailpit
  (`docker/signin.sh`).
* **[E]** The server answers at once and sends the mail in the background;
  after 30 s the code form offers „Code erneut senden“; a mail that failed
  shows only in the admin's error log (101b). **[V]** `POST /api/login`
  answers with the challenge before the mail is sent; a failed mail is
  recorded as a server error of the action `mail` with the player.
  `POST /api/login/resend` with the challenge sends a new code on the same
  challenge: the old code is void, the ten minutes start again, the failed
  attempts of the challenge stay (five in all). A new code is sent once in
  30 s, counted from the last one; an earlier ask answers `ok` and sends
  nothing, as the button only comes after 30 s. An unknown, used, expired or
  used-up challenge is refused like a wrong code. The client shows the
  button 30 s after the code form opened and again 30 s after each ask.
* **[E]** The texts of the owner (125a), of which this step builds the hint
  „Wir haben dir einen Code per E-Mail geschickt.“ and the button „Code
  erneut senden“ (text 3).
* **[E]** The code is the second factor; the mail carries the code and a
  link that signs in only the browser in which the sign-in was started (95a).
  **[U]** How the browser is bound: proposal to the owner, 2026-11-25.
* **[E]** An authenticator app (TOTP) is a further second factor (97b); with
  it set up the mail code is off for the account (102a); a lost
  authenticator is reset only by the admin (103c); „Passwort vergessen“ with
  an authenticator asks for its code too (104). **[U]** The algorithm, the
  QR code and the storage of the secret: proposals to the owner, 2026-11-25.
