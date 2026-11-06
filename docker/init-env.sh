#!/bin/sh
# Creates .env from .env.example and the secret files in secrets/ (does not
# overwrite anything that exists).
#
#   docker/init-env.sh          production: fill in .env and secrets/ yourself
#   docker/init-env.sh --demo   local demo: mails go to Mailpit, nothing leaves the machine
set -eu
cd "$(dirname "$0")/.."
umask 077

# Secret files are read by the game as uid 1000 (user `node` in the image).
mkdir -p secrets
if [ ! -e secrets/smtp_password ]; then
  : > secrets/smtp_password
  if [ "$(id -u)" = 0 ]; then chown 1000:1000 secrets/smtp_password; fi
  echo "secrets/smtp_password created (empty: no SMTP login)"
fi
if [ "$(id -u)" != 0 ] && [ "$(id -u)" != 1000 ]; then
  echo "Note: the game runs as uid 1000 and must read secrets/smtp_password:"
  echo "  sudo chown 1000 secrets/smtp_password"
fi

if [ -e .env ]; then
  echo ".env exists, nothing changed"
  exit 0
fi
cp .env.example .env
if [ "${1:-}" = "--demo" ]; then
  sed -i.bak \
    -e 's|^NOVA_PUBLIC_URL=.*|NOVA_PUBLIC_URL=http://localhost:8080|' \
    -e 's|^SMTP_HOST=.*|SMTP_HOST=mailpit|' \
    -e 's|^SMTP_PORT=.*|SMTP_PORT=1025|' \
    -e 's|^SMTP_TLS=.*|SMTP_TLS=false|' \
    -e 's|^MAIL_FROM=.*|MAIL_FROM=nova@localhost|' \
    .env
  rm -f .env.bak
  printf '\n# Demo (docker/init-env.sh --demo)\nCOMPOSE_FILE=compose.yaml:compose.demo.yaml\n' >> .env
  echo ".env created for the demo: docker compose up -d --build"
else
  echo ".env created: set NOVA_PUBLIC_URL (and SMTP if wanted), then docker compose up -d"
fi
