---
type: log-entry
date: 2026-11-25T20:00
kind: Feature
issues: [401]
---

The mail code of the sign-in is on by default and its form comes at once (#401, owner, 2026-11-25, 94b, 101b). `NOVA_EMAIL_LOGIN_CODES` unset now means on, in `config.ts`, `compose.yaml` and `.env.example`; a server without SMTP needs `0`. The code mail goes in the background, a failed one shows only in the admin's error log, and after 30 s the code form offers „Code erneut senden“, which sends a new code on the same challenge. The Docker smoke and upgrade tests sign in with the code from Mailpit. The link in the mail and the authenticator app follow.
