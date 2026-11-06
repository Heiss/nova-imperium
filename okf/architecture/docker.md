---
type: Deployment
title: Docker operation
description: Services, volumes, secrets and hardening of the Compose setup.
tags: [docker, compose, caddy, operations]
status: draft
generated: { by: claude-code/web, at: 2026-11-06T21:00:00Z }
---

# Decisions

* **[E]** Delivery with Docker Compose, Caddy in front like in muffelblog.
  `compose.yaml` alone is the production setup behind the operator's reverse
  proxy; Caddy listens on `127.0.0.1:8080` (`NOVA_BIND`, `NOVA_HTTP_PORT`).
* **[E]** Settings from `.env` (`docker/init-env.sh` creates it from
  `.env.example`), secrets from files in `secrets/` as Compose secrets.
* **[E]** The SMTP password reaches the game only through the secret file;
  `compose.yaml` passes no `SMTP_PASSWORD` variable.
* **[E]** The database lives in the volume `data` and survives restarts,
  updates and reboots. The CI restarts the stack and logs in again to check it.
* **[E]** `compose.demo.yaml` adds Mailpit for the demo and the CI;
  `docker/init-env.sh --demo` sets it up.

# Services

| Service | Image | Role |
|---|---|---|
| `app` | `ghcr.io/heiss/nova-imperium` (built from `Dockerfile`, target `app`) | The game server, port 8080 in the Docker network only. |
| `web` | `caddy:2.11-alpine` | Headers, compression, `X-Real-IP`; the only published port. |
| `mailpit` | `axllent/mailpit:v1.33` | Demo and CI only: mail sink with a web interface on `127.0.0.1:8025`. |

# Image

* **[E]** Node 26 (`.node-version`), multi-stage: dependencies, client build,
  then a runtime stage with only the production dependencies, the built client
  and the server sources.
* **[V]** The runtime image holds no npm, pnpm, compiler or tests; the CI
  checks this. It runs as uid 1000 (`node`).
* **[V]** A build behind a TLS-inspecting proxy passes the CA as a build
  secret (`--secret id=ca,src=…`); without it nothing changes.
* **[U]** The arm64 image is built by the release workflow (QEMU) and was not
  started on real arm64 hardware.

# Hardening (proposals, in place)

* **[V]** Both containers: read-only root file system, `cap_drop: ALL`
  (Caddy keeps `NET_BIND_SERVICE`), `no-new-privileges`.
* **[V]** Caddy removes `Server` and `Via`, replaces the security headers of
  the game with the same values (a test keeps both equal) and sets
  `X-Real-IP` from `client_ip`; `NOVA_TRUSTED_PROXIES` names the proxies whose
  `X-Forwarded-For` is believed.
* **[V]** Health checks: `app` asks `/healthz` (database included), `web`
  answers on an internal port `:2020`.
