# Sourced by docker/smoke.sh and docker/upgrade.sh: a sign-in with the
# password and, while the mail code is on (the default since #401, 94b), the
# code from the mail in Mailpit. Prints the last answer of the server.
#   signin <name> <password> <game-url> <mailpit-url>
signin() {
  curl -s -X DELETE "$4/api/v1/messages" > /dev/null || true
  reply="$(curl -s -X POST -H 'content-type: application/json' -H "origin: $3" \
    -d "{\"name\":\"$1\",\"password\":\"$2\"}" "$3/api/login")"
  case "$reply" in
    *'"challenge":"'*) ;;
    *) printf '%s' "$reply"; return 0 ;;
  esac
  challenge="$(printf '%s' "$reply" | sed -n 's/.*"challenge":"\([^"]*\)".*/\1/p')"
  code=''
  i=0
  # The mail goes in the background; the only mail is ours (deleted above).
  while [ -z "$code" ] && [ $i -lt 15 ]; do
    code="$(curl -s "$4/api/v1/messages" | grep -o 'Anmeldecode lautet [0-9]\{6\}' | head -n 1 | grep -o '[0-9]\{6\}' || true)"
    [ -n "$code" ] || { i=$((i+1)); sleep 1; }
  done
  curl -s -X POST -H 'content-type: application/json' -H "origin: $3" \
    -d "{\"challenge\":\"$challenge\",\"code\":\"$code\"}" "$3/api/login/code"
}
