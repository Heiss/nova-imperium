#!/usr/bin/env bash
# The pushed release image runs on a CPU without AVX (#456; owner,
# 2026-11-27, #449, 291a), the job "noavx" of .github/workflows/release.yml.
# The amd64 image, by digest, starts under QEMU in user mode with the CPU
# model Denverton (the entrypoint of compose.noavx.yaml) on a fresh data
# volume: the database is created and migrated, and /healthz must answer.
# A failure stops "latest" and "stable" from moving.
#   IMAGE   the image name, ghcr.io/<owner>/nova-imperium
#   DIGEST  the digest of the pushed image, sha256:…
#   TRIES   how often /healthz is asked, two seconds apart
set -euo pipefail
case "$DIGEST" in
  sha256:*) ;;
  *) echo "::error::No digest of the pushed release image."; exit 1 ;;
esac
# The static QEMU binary, by the same rule as the check of CI (#449).
if ! qemu=$("$(dirname "$0")/static-qemu.sh"); then
  echo "::error::No static QEMU binary for the check without AVX."; exit 1
fi
ref="$IMAGE@$DIGEST"
# The entrypoint of compose.noavx.yaml; -xsavec only silences a
# QEMU warning. An empty volume: the database is new. The check has no mail
# server, so the mail codes of the sign-in are off (NOVA_EMAIL_LOGIN_CODES is
# on by default and needs SMTP_HOST, or the server does not start). The
# hardening of the app in compose.yaml: read-only, no capabilities, no new
# privileges.
docker volume create nova-noavx-data > /dev/null
docker run --detach --name nova-noavx --platform linux/amd64 \
  --read-only --tmpfs /tmp --cap-drop ALL \
  --security-opt no-new-privileges:true -v nova-noavx-data:/data \
  -v "$qemu:/usr/local/bin/qemu-x86_64-static:ro" \
  -e NOVA_PUBLIC_URL=http://127.0.0.1:8080 -e NOVA_EMAIL_LOGIN_CODES=0 \
  -p 127.0.0.1:8080:8080 \
  --entrypoint /usr/local/bin/qemu-x86_64-static \
  "$ref" -cpu Denverton,-xsavec /usr/local/bin/node src/server/main.ts > /dev/null
ok=
for _ in $(seq 1 "$TRIES"); do
  if curl -fsS http://127.0.0.1:8080/healthz > /dev/null 2>&1; then ok=1; break; fi
  # A container that stopped (an instruction this CPU lacks) never answers.
  if [ "$(docker inspect -f '{{.State.Running}}' nova-noavx 2>/dev/null || true)" != true ]; then
    docker logs --tail 60 nova-noavx || true
    echo "::error::$ref stopped on a CPU without AVX."; exit 1
  fi
  sleep 2
done
if [ -z "$ok" ]; then
  docker logs --tail 60 nova-noavx || true
  echo "::error::$ref did not answer /healthz on a CPU without AVX."; exit 1
fi
# It really runs under QEMU; matched in the shell, not by a pipe into
# grep -q, whose early exit could fail the pipe under pipefail.
cmdline=$(docker exec nova-noavx sh -c 'tr "\0" " " < /proc/1/cmdline' || true)
if [[ "$cmdline" != *'qemu-x86_64-static -cpu Denverton'* ]]; then
  echo "PID 1 runs: $cmdline"
  docker logs --tail 60 nova-noavx || true
  echo "::error::$ref did not run under QEMU."; exit 1
fi
echo "$ref runs on a CPU without AVX."
