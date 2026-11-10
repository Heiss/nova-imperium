# Nova Imperium

A classic space strategy browser game for a group of friends, in the style of
the browser games of 2007/2008: mines, research, shipyard, defense, fleets,
espionage, battles and a highscore. No premium, no paid boosts. The interface
is German; every building, research, ship and defense has its own drawn art.

The server computes everything itself (production, building queues, flights,
battles), also while nobody is online. Players only need a browser.

## Quick start

```bash
git clone https://github.com/Heiss/nova-imperium.git && cd nova-imperium
docker/init-env.sh                     # creates .env and secrets/
$EDITOR .env                           # set NOVA_PUBLIC_URL (and SMTP if wanted)
docker compose up -d
docker compose exec app nova invite you@example.org   # prints your invitation link
docker compose exec app nova admin YourName           # after you registered
```

The game listens on `127.0.0.1:8080`; put your reverse proxy with HTTPS in
front. Just trying it out? `docker/init-env.sh --demo && docker compose up -d --build`
starts it on http://localhost:8080 with a local mail sink on
http://localhost:8025.

## Documentation

- [Getting started](docs/getting-started.md): installation, first admin, demo
- [Configuration](docs/configuration.md): every setting in `.env` and the secret files
- [Operations](docs/operations.md): reverse proxy, backup, updates, hardening
- [Development](docs/development.md): layout, commands, quality gates
- [Decisions](okf/index.md): why the project looks like this (OKF bundle)

## What is in it

- Players join only by invitation: the admin enters an e-mail address, the
  invitation goes out by mail (SMTP) or the admin copies the link. Links are
  single-use and expire after 7 days.
- Admins are made by the operator on the command line, never through the web.
- The admin panel changes speed, size and start values of the universe live,
  starts new rounds and manages invitations.
- All data lives in SQLite in a Docker volume and survives restarts and reboots.
- Settings through `.env`; secrets (the SMTP password) through files.
- Caddy in front with a strict Content-Security-Policy.

## Quality

Every pull request runs lint with complexity limits, type check, unit tests
with coverage (≥ 90 % lines, ≥ 85 % branches), mutation tests (score ≥ 80 %),
browser tests (desktop and phone, no CSP violations), the Docker image with a
Compose smoke test, gitleaks, `pnpm audit`, CodeQL, Trivy and a check that
released database migrations stay unchanged. One gate job
collects them; only a green gate goes to review. The rules of the game are
checked against the original version 1 to the last digit.

## License

MIT, see [LICENSE](LICENSE).
