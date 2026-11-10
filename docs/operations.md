# Operations

## Reverse proxy

Our Caddy serves plain HTTP on `127.0.0.1:8080` and sets the security headers
(strict Content-Security-Policy). Your proxy adds HTTPS and forwards everything.
It must pass the client address in `X-Forwarded-For`; Caddy believes it only
from `NOVA_TRUSTED_PROXIES` (default: private address ranges).

Caddy as the proxy on the host:

```caddyfile
nova.example.org {
	reverse_proxy 127.0.0.1:8080
}
```

nginx:

```nginx
server {
    listen 443 ssl;
    server_name nova.example.org;
    # ssl_certificate ...; ssl_certificate_key ...;
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

These two snippets were written from the documentation of Caddy and nginx and
not run against a real installation (see `okf/open-points.md`).

Set HSTS in your proxy if you want it; the game does not set it, because only
the proxy knows that HTTPS is in place.

## Operator commands

```bash
docker compose exec app nova invite friend@example.org   # invitation (prints the link)
docker compose exec app nova admin Name                   # make admin
docker compose exec app nova unadmin Name                 # take admin away
docker compose exec app nova admins                       # list admins
```

## Logs and health

```bash
docker compose ps
docker compose logs -f app
```

`GET /healthz` answers `{"ok":true}` when the server and its database work;
Docker uses it as the health check of `app`.

## Backup and restore

The database is the file `nova.sqlite` (with `-wal` and `-shm`) in the volume
`nova-imperium_data`. A consistent copy, with the game stopped for a moment:

```bash
docker compose stop app
docker run --rm -v nova-imperium_data:/data -v "$PWD":/backup alpine \
  tar czf /backup/nova-data-$(date +%F).tgz -C /data .
docker compose start app
```

Restore into the same volume:

```bash
docker compose stop app
docker run --rm -v nova-imperium_data:/data -v "$PWD":/backup alpine \
  sh -c 'rm -rf /data/* && tar xzf /backup/nova-data-YYYY-MM-DD.tgz -C /data && chown -R 1000:1000 /data'
docker compose start app
```

Keep `.env` and `secrets/` in your own backup as well; they are not in Git.

## Automatic releases

Install the release GitHub App on this repository with Contents read and write.
Set the Actions secret `RELEASE_APP_PRIVATE_KEY` to its PEM key, then set the
Actions variable `RELEASE_APP_ID` to enable automatic tagging. The workflow
runs after successful push CI on `main` and tags that exact commit if it is
still the tip of `main`. A newer commit needs its own successful CI run.
The App's tag push triggers the image release workflow, which independently
verifies successful CI for that commit before building or publishing.
Tags use `YY.M.MICRO` in Europe/Berlin, starting at 0 each month.

To restrict tag creation to the release App, grant only that App bypass access
in the tag ruleset and activate the ruleset after verifying automatic tagging.

## Updates

Images are published for release tags with successful CI (`ghcr.io/heiss/nova-imperium`,
CalVer like `26.11.0`). Pin a version in `.env` and pull it:

```bash
# NOVA_VERSION=26.11.0 in .env
docker compose pull
docker compose up -d
```

A rollback is the previous tag. Database migrations run at the start and are
not undone by an older image (an older image refuses a newer database instead
of damaging it). Before it migrates an existing database, the server writes a
consistent copy with the old schema version next to it, for example
`nova.sqlite.v8.bak`, and keeps the newest three. A migration runs in one
transaction: if it fails, the server does not start, the database stays
unchanged and the error names the backup. To roll back after a migration,
stop the app, put the backup in place and start the previous tag:

```bash
docker compose stop app
docker run --rm -v nova-imperium_data:/data alpine sh -c \
  'cp /data/nova.sqlite.v8.bak /data/nova.sqlite && rm -f /data/nova.sqlite-wal /data/nova.sqlite-shm && chown 1000:1000 /data/nova.sqlite'
# NOVA_VERSION=<previous tag> in .env
docker compose up -d
```

The automatic copy lives in the same volume; keep your own backup (above)
against the loss of the volume.

## Account security

Players can change their password in **Hilfe & Optionen**. With SMTP configured,
**Passwort vergessen?** sends a single-use link to the registered address. The
link expires after 30 minutes. A password change or reset signs out all sessions.

Set `NOVA_EMAIL_LOGIN_CODES=1` after verifying SMTP delivery to require a
six-digit email code at sign-in. Codes expire after ten minutes and allow five
attempts. Confirm that every player has an address before enabling this option. Configure
SMTP with TLS for production. Email codes are an additional
check, and email access is also the recovery channel.

## Browser notifications

With an HTTPS public URL, set `NOVA_WEB_PUSH=1` and restart the app. Each
player opts in under **Hilfe & Optionen** on each device. On iOS, open the
installed Home Screen app before enabling notifications. The server needs
outbound HTTPS to the browser's push provider. Back up the SQLite volume
to preserve the server's push identity and device subscriptions.

## Hardening that is in place

- The game runs as uid 1000, not root; both containers have a read-only root
  file system, no Linux capabilities (Caddy only `NET_BIND_SERVICE`) and
  `no-new-privileges`.
- Only Caddy has a published port, bound to `127.0.0.1` by default.
- Content-Security-Policy without inline scripts or styles; no foreign sources.
- Passwords hashed with scrypt (N=32768, r=8, p=3) and a random 128-bit salt; session and invitation tokens are random and
  only their SHA-256 is stored; the invitation token travels in the URL
  fragment, so it is never sent to a server or logged.
- Cross-site requests are refused (JSON only, `Origin` must match).
- Rate limit on login, registration and invitation checks.

## Admin diagnostics and audit data

The admin panel records administrative reads of invitations, player activity,
player details, stored orders and the audit log itself. Audit entries identify
the account, the operation, the target or search scope, and the outcome. Operator
commands run outside web accounts and are recorded as operator actions. Role
changes record the old and new role. Web moderation requires a reason and can
end sessions, suspend a player indefinitely or for up to 720 hours, or lift a
suspension. Existing sessions stay invalid after a suspension ends.

The event view shows account and game actions, battles and admin actions. An
unexpected HTTP error includes a request ID that can be looked up in both the
event view and server logs. Stored order due times reflect the database. For
lazily settled buildings, research and shipyard orders, a due entry can be normal
until the planet or player state is next persisted.

Active minutes are estimated from clicks and key interactions in the visible
game. Only intervals between received interaction samples up to five minutes
apart are counted. Automatic state polls and a tab left open contribute no
samples. Statistics use UTC days. Activity totals and successful actions cover
today and the six preceding UTC days. The activity view highlights five rejected
logins on an account within an hour or 30 game-action requests within a minute
for manual review.

The server retains the audit log and daily activity data for 30 days and
purges old entries in its hourly cleanup. Collection starts after the update.
Audit entries omit passwords, invitation and session tokens, and raw request
bodies. Anyone with direct access to the database or its backups can read or
change the stored audit data.

The login screen's “Login auf diesem Gerät speichern” option makes the session
cookie persistent for the configured session lifetime after authentication.
Without it, the browser receives a session cookie. Signing out or starting a
new login still uses the configured authentication flow.

An administrator can send a server announcement from the corresponding admin
tab. All existing accounts receive it in the game inbox. With Web Push enabled,
subscribed devices receive the announcement text as a browser notification.

Passkeys are available in **Hilfe & Optionen** on HTTPS and localhost. Adding a
passkey requires the current password. A verified passkey can sign in without an
email code. The configured public URL determines the WebAuthn origin and host,
so users must register a new passkey after switching to a different host.
Password recovery revokes the account's registered passkeys.
