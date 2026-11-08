#!/bin/sh
set -eu

fail() {
  printf '%s\n' "$*" >&2
  exit 1
}

dry_run=false
case "$#:${1:-}" in
  0:) ;;
  1:--dry-run) dry_run=true ;;
  *) fail 'Usage: sh scripts/release.sh [--dry-run]' ;;
esac

[ -n "${NOVA_RELEASE_EXPECTED_SHA:-}" ] ||
  fail 'Release tags are created by GitHub Actions after successful CI on main.'

repo=Heiss/nova-imperium
origin_pattern='^(https://github[.]com/|git@github[.]com:|ssh://git@github[.]com/)heiss/nova-imperium([.]git)?/?$'
branch=$(git branch --show-current)
[ "$branch" = main ] || fail 'Switch to main before creating a release.'
changes=$(git status --porcelain)
[ -z "$changes" ] || fail 'Commit or stash local changes before creating a release.'
fetch_url=$(git remote get-url --all origin)
push_url=$(git remote get-url --push --all origin)
# Exactly one fetch URL and one push URL must match.
if ! printf '%s\n' "$fetch_url" "$push_url" |
  awk -v pattern="$origin_pattern" 'tolower($0) ~ pattern { valid++ } END { exit !(NR == 2 && valid == 2) }'; then
  fail "Set origin to the canonical GitHub repository ($repo)."
fi

git fetch --tags origin main
commit=$(git rev-parse 'FETCH_HEAD^{commit}')
if [ "$commit" != "$NOVA_RELEASE_EXPECTED_SHA" ]; then
  printf '%s\n' 'Main has moved since this CI run. Skipping the automatic tag.'
  exit 0
fi
git merge-base --is-ancestor HEAD "$commit" ||
  fail 'Local main has commits that are not on origin/main.'

# Let GitHub filter by commit, workflow, branch, event and successful status.
api="https://api.github.com/repos/$repo/actions/workflows/ci.yml/runs"
set --
if [ -n "${NOVA_RELEASE_CI_TOKEN:-}" ]; then
  set -- --header "Authorization: Bearer $NOVA_RELEASE_CI_TOKEN"
fi
result=$(curl --fail --silent --show-error --max-time 15 "$@" \
  "$api?branch=main&event=push&head_sha=$commit&status=success&per_page=1") ||
  fail 'Could not check GitHub CI.'
successful_runs='^[[:space:]]*\{[[:space:]]*"total_count"[[:space:]]*:[[:space:]]*[1-9][0-9]*[[:space:]]*,'
short_commit=$(printf '%.7s' "$commit")
printf '%s' "$result" | tr '\r\n' '  ' | grep -Eq "$successful_runs" ||
  fail "Wait for successful CI on main at $short_commit. https://github.com/$repo/actions/workflows/ci.yml"

calendar=$(TZ=Europe/Berlin date '+%y.%m')
month=${calendar#*.}
prefix="${calendar%.*}.${month#0}"
tags=$(git tag --list --sort=-version:refname "$prefix.*")
on_commit=$(git tag --points-at "$commit")
existing=''
latest=''
while IFS= read -r candidate; do
  micro=${candidate#"$prefix."}
  case "$micro" in
    ''|*[!0-9]*|0?*) continue ;;
  esac
  [ -n "$latest" ] || latest=$micro
  if printf '%s\n' "$on_commit" | grep -Fqx "$candidate"; then
    existing=$candidate
    break
  fi
done <<TAGS
$tags
TAGS

tag=$existing
if [ -z "$tag" ]; then
  [ "${#latest}" -lt 19 ] || fail 'The latest CalVer number is too large.'
  next=0
  if [ -n "$latest" ]; then next=$((latest + 1)); fi
  tag="$prefix.$next"
fi

if "$dry_run"; then
  printf 'Would push %s for %.7s.\n' "$tag" "$commit"
  exit 0
fi

git merge --ff-only "$commit"
if [ -z "$existing" ]; then git tag -a "$tag" "$commit" -m "Release $tag"; fi
git push origin "refs/tags/$tag" ||
  fail "Could not push $tag. Retry with: git push origin refs/tags/$tag"
printf 'Release tag %s is on GitHub (%.7s).\n' "$tag" "$commit"
