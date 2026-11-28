#!/usr/bin/env bash
# The static QEMU binary for x86_64 of the runner, for the checks on a CPU
# without AVX (#449 in ci.yml, #456 in release.yml): one rule for both.
# Installs qemu-user-static (Ubuntu 24.04 and older; there qemu-user is
# dynamic) or else qemu-user (newer Ubuntu, where qemu-user-static is only a
# virtual package without an installation candidate and qemu-user ships the
# static binaries), and prints the path of the binary on stdout, the only thing it prints
# there. The binary must be static to run inside the image: ldd says
# „statically linked“ (static-pie, exit 0) or „not a dynamic executable“
# (exit 1), so its words are read, not its exit code. A binary that is not
# static fails with the reason on stderr.
set -euo pipefail
{
  sudo apt-get update -q || true
  sudo apt-get install -y -q --no-install-recommends qemu-user-static \
    || sudo apt-get install -y -q --no-install-recommends qemu-user
} >&2
if ! qemu=$(command -v qemu-x86_64-static || command -v qemu-x86_64); then
  echo "No QEMU binary for x86_64 after installing qemu-user-static or qemu-user." >&2
  exit 1
fi
# Matched in the shell, not by a pipe into grep -q: under pipefail its early
# exit could fail the pipe.
linked=$(ldd "$qemu" 2>&1 || true)
static='statically linked|not a dynamic executable'
if [[ ! "$linked" =~ $static ]]; then
  echo "$qemu is not a static binary: $linked" >&2
  exit 1
fi
printf '%s\n' "$qemu"
