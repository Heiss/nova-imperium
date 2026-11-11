#!/bin/sh
# Smoke test of the running demo stack (compose.yaml + compose.demo.yaml):
# headers through Caddy, invitation by mail, registration, data after a restart,
# maintenance by command and the maintenance page when the game is down.
#   docker/smoke.sh [game-url] [mailpit-url]
set -eu
GAME="${1:-http://localhost:8080}"
MAIL="${2:-http://localhost:8025}"
fail=0
# Unique per run, so the test also runs against a stack that has data.
run="$(date +%s)"
who="smoke$run"
ok() { echo "ok    $1"; }
bad() { echo "FAIL  $1"; fail=1; }
check() { if [ "$2" = "$3" ]; then ok "$1"; else bad "$1: expected $2, got $3"; fi; }
status() { curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$@" || true; }

i=0
until [ "$(status "$GAME/healthz")" = "200" ] || [ $i -ge 60 ]; do i=$((i+1)); sleep 2; done
check "game answers through Caddy" 200 "$(status "$GAME/")"
check "health check" 200 "$(status "$GAME/healthz")"
headers="$(curl -sI --max-time 10 "$GAME/" | tr -d '\r' | tr '[:upper:]' '[:lower:]')"
case "$headers" in *"content-security-policy: default-src 'none'; script-src 'self'"*) ok "strict CSP" ;; *) bad "CSP missing" ;; esac
case "$headers" in *"x-frame-options: deny"*) ok "frame protection" ;; *) bad "X-Frame-Options missing" ;; esac
case "$headers" in *"server: "*|*"via: "*) bad "Server or Via header shown" ;; *) ok "no Server or Via header" ;; esac
check "cross-site post refused" 403 "$(status -X POST -H 'content-type: text/plain' -d x "$GAME/api/login")"

# The data folder belongs to the user of the game, not root.
check "game runs as uid 1000" 1000 "$(docker compose exec -T app id -u)"

# Invitation through the operator command; the mail lands in Mailpit.
curl -s -X DELETE "$MAIL/api/v1/messages" > /dev/null || true
link="$(docker compose exec -T app nova invite "$who@example.org" | grep '#invite=')"
[ -n "$link" ] && ok "invitation created" || bad "no invitation link"
i=0
until curl -s "$MAIL/api/v1/messages" | grep -q "$who@example.org" || [ $i -ge 15 ]; do i=$((i+1)); sleep 1; done
curl -s "$MAIL/api/v1/messages" | grep -q 'Einladung zu Nova Imperium' && ok "invitation mail sent" || bad "no invitation mail"

token="${link##*#invite=}"
reg="$(curl -s -X POST -H 'content-type: application/json' \
  -d "{\"token\":\"$token\",\"name\":\"$who\",\"password\":\"smoke-test-passphrase\",\"gal\":1}" "$GAME/api/register")"
case "$reg" in *'"ok":true'*) ok "registered with the invitation" ;; *) bad "registration: $reg" ;; esac
docker compose exec -T app nova admin "$who" > /dev/null && ok "made admin through the CLI" || bad "admin command"

# The SQLite database survives a restart of the whole stack.
docker compose restart app > /dev/null
i=0
until [ "$(status "$GAME/healthz")" = "200" ] || [ $i -ge 30 ]; do i=$((i+1)); sleep 2; done
login="$(curl -s -X POST -H 'content-type: application/json' -d "{\"name\":\"$who\",\"password\":\"smoke-test-passphrase\"}" "$GAME/api/login")"
case "$login" in *'"admin":true'*) ok "player and admin right survive a restart" ;; *) bad "login after restart: $login" ;; esac

# Maintenance by the operator: players get 503 „Wartung“, the health check stays good.
docker compose exec -T app nova maintenance on > /dev/null
check "maintenance keeps players out" 503 "$(status "$GAME/api/state")"
maint="$(curl -s -D - --max-time 10 "$GAME/api/state" | tr -d '\r' | tr '[:upper:]' '[:lower:]')"
case "$maint" in *"nova-maintenance: planned"*) ok "maintenance header" ;; *) bad "no maintenance header" ;; esac
check "health check during maintenance" 200 "$(status "$GAME/healthz")"
docker compose exec -T app nova maintenance off > /dev/null
check "maintenance off" 401 "$(status "$GAME/api/state")"

# The game is down: Caddy answers with its maintenance page, not 502.
docker compose stop app > /dev/null
check "maintenance page while the game is down" 503 "$(status "$GAME/")"
down="$(curl -s -D - --max-time 10 "$GAME/" | tr -d '\r')"
case "$down" in *"Nova Imperium ist gerade nicht erreichbar"*) ok "maintenance page text" ;; *) bad "maintenance page missing" ;; esac
case "$(printf '%s' "$down" | tr '[:upper:]' '[:lower:]')" in
  *"content-security-policy: default-src 'none'"*) ok "maintenance page with CSP" ;;
  *) bad "maintenance page without CSP" ;;
esac
docker compose start app > /dev/null
i=0
until [ "$(status "$GAME/healthz")" = "200" ] || [ $i -ge 30 ]; do i=$((i+1)); sleep 2; done
check "game back after the stop" 200 "$(status "$GAME/healthz")"

exit $fail
