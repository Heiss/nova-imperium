# Getting started

What you need: a Linux server with Docker and Docker Compose (v2), and a reverse
proxy with HTTPS for a domain (for example Caddy, nginx or Traefik). Without a
domain the game also runs on `http://localhost:8080` for a try.

## 1. Get the files

```bash
git clone https://github.com/Heiss/nova-imperium.git
cd nova-imperium
```

## 2. Settings

```bash
docker/init-env.sh
```

This creates `.env` from `.env.example` and the empty secret file
`secrets/smtp_password` (readable for uid 1000, the user of the game). Open
`.env` and set at least:

```dotenv
NOVA_PUBLIC_URL=https://nova.example.org
```

Mail for invitations (optional, otherwise you copy the links yourself):

```dotenv
SMTP_HOST=smtp.example.org
SMTP_PORT=465
SMTP_TLS=true
SMTP_USERNAME=nova@example.org
MAIL_FROM=nova@example.org
```

and write the SMTP password into the secret file, never into `.env`:

```bash
printf '%s' 'the-password' > secrets/smtp_password
```

All variables: [configuration.md](configuration.md).

## 3. Start

```bash
docker compose up -d
```

`docker compose ps` shows `app` and `web` as `healthy` after a few seconds.
The game listens on `127.0.0.1:8080`; point your reverse proxy there (examples
in [operations.md](operations.md)).

The game data is a SQLite database in the Docker volume `nova-imperium_data`.
It survives restarts, updates and reboots of the server.

## 4. The first player and admin

Nobody can register without an invitation, and nobody becomes admin through
the web. As the operator:

```bash
docker compose exec app nova invite you@example.org
```

The command prints the invitation link (and mails it if SMTP is set). Open the
link, choose a name and password. Then make yourself admin:

```bash
docker compose exec app nova admin YourName
```

Reload the page: the menu shows **Admin**. There you invite your friends by
e-mail, revoke open invitations, change the speed and size of the universe and
start a new round.

## Try it locally (demo)

```bash
docker/init-env.sh --demo
docker compose up -d --build
docker compose exec app nova invite me@example.org
```

Open http://localhost:8080 with the printed link. Invitation mails land in
Mailpit at http://localhost:8025; nothing leaves the machine.
