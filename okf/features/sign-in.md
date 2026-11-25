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
* **[E]** The texts of the owner (125a): 1 the mail, 2 the link in another
  browser, 3 the hint „Wir haben dir einen Code per E-Mail geschickt.“ and
  the button „Code erneut senden“, 4 the box „Authenticator-App“, 5 the
  sign-in step of the app, 6 its field on the reset page, 7 the admin's
  button and question.
* **[E]** The code is the second factor; the mail carries the code and a
  link that signs in only the browser in which the sign-in was started (95a),
  with text 1 of the owner. **[E]** The cookie `nova_login` is the one path
  for the link and the typed code; the client no longer sends a challenge,
  and a reload of the code step keeps the sign-in (129a). **[V]** The cookie
  is HttpOnly, SameSite=Lax, Secure on https, Path=/api/login, Max-Age 600,
  and holds `challenge.1` or `challenge.0`: the wish „angemeldet bleiben“ of
  the login form, so the link, which opens a new tab, keeps it too. The link
  is `{publicUrl}/#code={code}`, the code in the fragment, which the page
  takes out of the address at once and sends with `link: true`. A link
  without the cookie answers text 2 of the owner; **[E]** a link whose code
  does not fit the live sign-in of the cookie answers „Dieser Link gehört zu
  einer älteren Anmeldung. Gib den Code aus der neuesten E-Mail ein.“ (130b);
  **[V]** an expired or used sign-in answers „Der Anmeldecode ist ungültig
  oder abgelaufen.“ like a typed code, and every wrong code counts as a
  failed attempt. Success clears the cookie. `GET /api/login/pending` lets a
  reload show the code step again; „Zurück zum Login“ from the code step
  ends the sign-in (`POST /api/login/cancel`: the challenge is deleted and
  the cookie cleared).
* **[E]** The start error names the way out (128a): „NOVA_EMAIL_LOGIN_CODES is
  on by default and requires SMTP_HOST and the mail settings; set
  NOVA_EMAIL_LOGIN_CODES=0 to sign in without a mail code.“, with
  `docs/operations.md` and `.env.example`; no release-notes mechanism and
  nothing in the news of the game for operators.
* **[E]** An authenticator app (TOTP) is a further second factor (97b); with
  it set up the mail code is off for the account (102a); a lost
  authenticator is reset only by the admin (103c); „Passwort vergessen“ with
  an authenticator asks for its code too (104). **[E]** The secret is stored
  plain in the database, like the VAPID key, never in the journal, the audit
  log, the error log, an export or the state (127a). **[V]** Own RFC 6238 on
  node:crypto (SHA-1, 6 digits, 30 s, ±1 step, five attempts, a used step
  refused again); the QR code by `qrcode-generator` on the client after the
  supply-chain check, pinned exactly.
* **[V]** Built so far (2026-11-25): `totp.ts` (RFC 6238, tested with the
  vectors of RFC 4226 appendix D and RFC 6238 appendix B), the table `totp`
  of migration 20261125T2000-totp (secret, confirmed, created, last step,
  attempts; gone with the account, kept across rounds), `authenticator.ts`
  and the routes `POST /api/totp/setup|confirm|remove`,
  `POST /api/password/reset/check`, `POST /api/admin/totp-reset`.
  * Setup: „Einrichten“ gives the otpauth address and the secret once; the
    first code confirms it within ten minutes, five wrong codes end it; a
    second setup while one is set up is refused.
  * Sign-in (102a): with an app the password asks for its code on the same
    challenge and cookie as the mail code, with no mail code in it, so
    neither a mail nor „Code erneut senden“ exists for it; the answer is
    `{ app: true }` and the step „Code aus der Authenticator-App“ with
    „Anmelden“ (text 5), also after a reload. A code is taken once: its time
    step must come after the last one taken.
  * Removal: the password („Das bisherige Passwort ist falsch.“) and a code.
  * Reset (104): `reset/check` tells the page of the link to show the field
    „Code aus der Authenticator-App“ (text 6); the link alone sets no
    password, a wrong code counts against the link (five), a password that
    would be refused takes no code, the app stays.
  * Admin (103c): the record of the player says whether an app is set up;
    „Authenticator-App zurücksetzen“ with the question of text 7, audited as
    `admin.write` / `totpReset`.
  * The state says `me.totp` yes or no; the secret is in no audit entry,
    error entry or state (tested).
* **[E]** The texts of the box and the notes (owner, 2026-11-25, 137a): the
  setup field „Code aus der Authenticator-App“ with the button „Einrichten“;
  the secret as text after „Schlüssel zur manuellen Eingabe:“; a wrong code
  of the app, also after too many, „Der Code der Authenticator-App ist
  ungültig.“; the notes „Authenticator-App eingerichtet.“, „Authenticator-App
  entfernt.“ and „Authenticator-App von {Name} zurückgesetzt.“; while set up
  the box shows „Eingerichtet.“ next to „Entfernen“. **[V]** The box stands
  in „Konto“ between „Passwort ändern“ and „Passkeys“; the removal asks with
  the labels „Passwort“ and „Code aus der Authenticator-App“. The QR code is
  drawn as SVG from the modules of `qrcode-generator` 2.0.4 (MIT, one
  maintainer, no dependencies, a signature of the registry but no npm
  provenance attestation; pinned exactly), not as HTML of the library.
* **[E]** The changelog fragment of #401 (owner, 2026-11-25, 136a), art
  geändert, in `changes/anmeldung-zweiter-faktor.md`.
* **[E]** `src/server/http/login-code.ts` is a security file of
  `mutation-standard.json` (coordinator, 2026-11-25).
