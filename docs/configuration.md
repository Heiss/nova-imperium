# Configuration

All settings are environment variables. With Docker they come from `.env`
(created by `docker/init-env.sh` from `.env.example`); secrets come from files
in `secrets/`. An invalid value stops the start and every error is named at
once; nothing falls back to a default silently.

The source of truth is `src/server/config.ts`. A unit test
(`src/server/docs.test.ts`) checks that every variable of the server is in
this table and in `.env.example`, and that the defaults and ranges match.

## The game server

| Variable                   | Default      | Range                            | Meaning                                                                                                                        |
| -------------------------- | ------------ | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `NOVA_PUBLIC_URL`          | – (required) | `http(s)://host[:port]`, no path | The address players open. Used in invitation links; with `https://` the session cookie is `Secure`.                            |
| `NOVA_HOST`                | `127.0.0.1`  | address                          | Address the server listens on. The image sets `0.0.0.0` (only Caddy reaches it).                                               |
| `NOVA_PORT`                | `8080`       | 1 to 65535                       | Port of the server inside the container.                                                                                       |
| `NOVA_DATA_DIR`            | `./data`     | folder                           | Folder of the SQLite database `nova.sqlite`. The image uses the volume `/data`.                                                |
| `NOVA_TRUST_PROXY`         | `0`          | `0`, `1`                         | `1`: the client address is taken from `X-Real-IP` (set by Caddy). `compose.yaml` sets `1`. Never `1` without a proxy in front. |
| `NOVA_SESSION_DAYS`        | `30`         | 1 to 365                         | Days a login stays valid.                                                                                                      |
| `NOVA_INVITE_DAYS`         | `7`          | 1 to 30                          | Days an invitation link stays valid.                                                                                           |
| `NOVA_EMAIL_LOGIN_CODES`   | `0`          | `0`, `1`                         | Require a short-lived email code after password verification. Requires SMTP.                                                   |
| `NOVA_RATE_LIMIT_ATTEMPTS` | `20`         | 1 to 1000                        | Logins, registrations and invitation checks per client address and window.                                                     |
| `NOVA_RATE_LIMIT_MINUTES`  | `10`         | 1 to 1440                        | Length of that window in minutes.                                                                                              |

## Mail for invitations and account recovery

Optional. Without `SMTP_HOST` no mail is sent and the admin copies the
invitation link from the admin panel.

| Variable        | Default | Range                       | Meaning                                                                                                                                               |
| --------------- | ------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SMTP_HOST`     | –       | host name                   | Mail server. Setting it switches mail on.                                                                                                             |
| `SMTP_PORT`     | –       | 1 to 65535                  | Required with `SMTP_HOST`.                                                                                                                            |
| `SMTP_TLS`      | `true`  | `true`, `starttls`, `false` | `true`: TLS from the start (port 465). `starttls`: STARTTLS is required (port 587). `false`: no encryption, only for a mail sink on the same machine. |
| `SMTP_USERNAME` | –       | text                        | Login at the mail server; empty for a relay without login. Also as `SMTP_USERNAME_FILE`.                                                              |
| `SMTP_PASSWORD` | –       | text                        | Secret. With Compose only through the file `secrets/smtp_password` (`SMTP_PASSWORD_FILE`).                                                            |
| `MAIL_FROM`     | –       | address                     | Sender of the invitations. Required with `SMTP_HOST`.                                                                                                 |

## Secrets from files

Every secret can come from a file instead: `NAME_FILE=/path`. The file is read
once at the start, a trailing line break is removed. Setting both `NAME` and
`NAME_FILE` stops the start. Variables that support it: `SMTP_USERNAME`,
`SMTP_PASSWORD`.

`compose.yaml` mounts `secrets/smtp_password` as the Docker secret
`/run/secrets/smtp_password`. The file must be readable for uid 1000 (the user
`node` of the image); `docker/init-env.sh` creates it like that.

## Compose only

| Variable               | Default          | Meaning                                                                             |
| ---------------------- | ---------------- | ----------------------------------------------------------------------------------- |
| `NOVA_VERSION`         | `latest`         | Image tag, for example `26.11.0`.                                                   |
| `NOVA_BIND`            | `127.0.0.1`      | Address the port of Caddy listens on. Keep it for a reverse proxy on the same host. |
| `NOVA_HTTP_PORT`       | `8080`           | Port of the game on the host.                                                       |
| `NOVA_TRUSTED_PROXIES` | `private_ranges` | Addresses of your reverse proxy; Caddy believes their `X-Forwarded-For`.            |
| `NOVA_MAIL_PORT`       | `8025`           | Demo only: port of the Mailpit web interface.                                       |
| `COMPOSE_FILE`         | –                | The demo sets `compose.yaml:compose.demo.yaml`.                                     |

## Universe settings

Speed, size of the universe, storage and start resources are not environment
variables: the admin changes them in the admin panel of the game, live. The
size (galaxies, systems, positions) can only grow, never below a coordinate
where a planet lies. Ranges: `src/shared/universe.ts`.
