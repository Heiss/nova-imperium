---
type: log-entry
date: 2026-11-25T20:00
kind: Feature
issues: [401]
---

The mail code of the sign-in is on by default and its form comes at once (#401, owner, 2026-11-25, 94b, 101b). `NOVA_EMAIL_LOGIN_CODES` unset now means on, in `config.ts`, `compose.yaml` and `.env.example`; a server without SMTP needs `0`. The code mail goes in the background, a failed one shows only in the admin's error log, and after 30 s the code form offers „Code erneut senden“, which sends a new code on the same challenge. The Docker smoke and upgrade tests sign in with the code from Mailpit. The mail carries the link of text 1; the browser that began the sign-in keeps it in the HttpOnly cookie `nova_login`, the one path for the link and the typed code, so a reload keeps the code step (129a). A link in another browser says where to enter the code, a link of an older sign-in says to take the newest mail (130b). A server without SMTP names `NOVA_EMAIL_LOGIN_CODES=0` in its start error (128a). An account with an authenticator app is asked for its code instead of a mail code, whatever the setting says; a reset link asks for it too, and the admin resets a lost app in the player record. The code of the app follows RFC 6238 and is taken once. The box „Authenticator-App“ in „Optionen“ → „Konto“ sets it up with a QR code and removes it with the password and a code; the QR code comes from `qrcode-generator` 2.0.4, pinned exactly, which has no npm provenance attestation.
