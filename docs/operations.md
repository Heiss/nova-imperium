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

## Updates

Images are published for every release tag (`ghcr.io/heiss/nova-imperium`,
CalVer like `26.11.0`). Pin a version in `.env` and pull it:

```bash
# NOVA_VERSION=26.11.0 in .env
docker compose pull
docker compose up -d
```

A rollback is the previous tag. Make a backup before an update: database
migrations run at the start and are not undone by an older image (an older
image refuses a newer database instead of damaging it).

## Hardening that is in place

- The game runs as uid 1000, not root; both containers have a read-only root
  file system, no Linux capabilities (Caddy only `NET_BIND_SERVICE`) and
  `no-new-privileges`.
- Only Caddy has a published port, bound to `127.0.0.1` by default.
- Content-Security-Policy without inline scripts or styles; no foreign sources.
- Passwords hashed with scrypt; session and invitation tokens are random and
  only their SHA-256 is stored; the invitation token travels in the URL
  fragment, so it is never sent to a server or logged.
- Cross-site requests are refused (JSON only, `Origin` must match).
- Rate limit on login, registration and invitation checks.
