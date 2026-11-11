#!/bin/sh
# Upgrade test as on the server: the last release writes data, then the image
# under test starts on the same volume. The player and the admin right must
# survive, and a migration must leave a backup of the old schema version.
#   docker/upgrade.sh before [game-url]   with the last release running
#   docker/upgrade.sh after  [game-url]   with the new image running
set -eu
step="$1"
GAME="${2:-http://localhost:8080}"
who=upgrade
pass=upgrade-test-passphrase
state=upgrade-from.txt
fail=0
ok() { echo "ok    $1"; }
bad() { echo "FAIL  $1"; fail=1; }
status() { curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$@" || true; }
schema() {
  docker compose exec -T app node -e \
    "const D=require('better-sqlite3');const d=new D('/data/nova.sqlite',{readonly:true});console.log(d.pragma('user_version',{simple:true}))"
}
# The schema version the image under test migrates to.
expected() {
  docker compose exec -T app node -e \
    "import('/app/src/server/db/schema.ts').then((m) => console.log(m.MIGRATIONS.length))"
}

i=0
until [ "$(status "$GAME/healthz")" = "200" ] || [ $i -ge 60 ]; do i=$((i+1)); sleep 2; done
[ "$(status "$GAME/healthz")" = "200" ] && ok "game answers" || bad "game does not answer"

if [ "$step" = before ]; then
  link="$(docker compose exec -T app nova invite "$who@example.org" | grep '#invite=')"
  token="${link##*#invite=}"
  reg="$(curl -s -X POST -H 'content-type: application/json' \
    -d "{\"token\":\"$token\",\"name\":\"$who\",\"password\":\"$pass\",\"gal\":1}" "$GAME/api/register")"
  case "$reg" in *'"ok":true'*) ok "registered with the last release" ;; *) bad "registration: $reg" ;; esac
  docker compose exec -T app nova admin "$who" > /dev/null && ok "made admin" || bad "admin command"
  schema > "$state"
  echo "schema version of the last release: $(cat "$state")"
else
  from="$(cat "$state")"
  to="$(schema)"
  want="$(expected || true)"
  echo "schema version: $from -> $to (image: $want)"
  login="$(curl -s -X POST -H 'content-type: application/json' -d "{\"name\":\"$who\",\"password\":\"$pass\"}" "$GAME/api/login")"
  case "$login" in *'"admin":true'*) ok "player and admin right survive the upgrade" ;; *) bad "login after the upgrade: $login" ;; esac
  if [ -z "$want" ] || [ "$to" -ne "$want" ]; then
    bad "schema version $to, the image expects $want"
  elif [ "$to" -lt "$from" ]; then
    bad "schema version went down"
  elif [ "$to" -gt "$from" ]; then
    docker compose exec -T app test -s "/data/nova.sqlite.v$from.bak" &&
      ok "backup of schema version $from kept" || bad "no backup of schema version $from"
  else
    ok "same schema version, nothing to migrate"
  fi
fi
exit $fail
