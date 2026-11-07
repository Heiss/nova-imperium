#!/usr/bin/env bash
set -euo pipefail

fail() {
  printf '%s\n' "$*" >&2
  exit 1
}

dry_run=false
case "$#:${1:-}" in
  0:) ;;
  1:--dry-run) dry_run=true ;;
  *) fail 'Usage: bash scripts/release.sh [--dry-run]' ;;
esac

repo=Heiss/nova-imperium
origin_pattern='^(https://github\.com/|git@github\.com:|ssh://git@github\.com/)heiss/nova-imperium(\.git)?/?$'
[[ $(git branch --show-current) == main ]] || fail 'Switch to main before creating a release.'
[[ -z $(git status --porcelain) ]] || fail 'Commit or stash local changes before creating a release.'
fetch_url=$(git remote get-url --all origin)
push_url=$(git remote get-url --push --all origin)
[[ ${fetch_url,,} =~ $origin_pattern && ${push_url,,} =~ $origin_pattern ]] ||
  fail "Set origin to the canonical GitHub repository ($repo)."

git fetch --tags origin main
commit=$(git rev-parse 'FETCH_HEAD^{commit}')
git merge-base --is-ancestor HEAD "$commit" ||
  fail 'Local main has commits that are not on origin/main.'

# Let GitHub filter by commit, workflow, branch, event and successful status.
api="https://api.github.com/repos/$repo/actions/workflows/ci.yml/runs"
result=$(curl --fail --silent --show-error --max-time 15 \
  "$api?branch=main&event=push&head_sha=$commit&status=success&per_page=1") ||
  fail 'Could not check GitHub CI.'
successful_runs='^[[:space:]]*\{[[:space:]]*"total_count"[[:space:]]*:[[:space:]]*[1-9][0-9]*[[:space:]]*,'
[[ $result =~ $successful_runs ]] ||
  fail "Wait for successful CI on main at ${commit:0:7}. https://github.com/$repo/actions/workflows/ci.yml"

calendar=$(TZ=Europe/Berlin date '+%y.%m')
month=${calendar#*.}
prefix="${calendar%.*}.${month#0}"
tag_pattern='^(0|[1-9][0-9]*)$'
tags=$(git tag --list --sort=-version:refname "$prefix.*")
on_commit=$(git tag --points-at "$commit")
existing=''
latest=''
while IFS= read -r candidate; do
  [[ ${candidate##*.} =~ $tag_pattern ]] || continue
  [[ -n $latest ]] || latest=${candidate##*.}
  if [[ $'\n'"$on_commit"$'\n' == *$'\n'"$candidate"$'\n'* ]]; then
    existing=$candidate
    break
  fi
done <<< "$tags"

tag=$existing
if [[ -z $tag ]]; then
  [[ ${#latest} -lt 19 ]] || fail 'The latest CalVer number is too large.'
  next=0
  if [[ -n $latest ]]; then next=$((latest + 1)); fi
  tag="$prefix.$next"
fi

if "$dry_run"; then
  printf 'Would push %s for %.7s.\n' "$tag" "$commit"
  exit 0
fi

git merge --ff-only "$commit"
if [[ -z $existing ]]; then git tag -a "$tag" "$commit" -m "Release $tag"; fi
git push origin "refs/tags/$tag" ||
  fail "Could not push $tag. Retry with: git push origin refs/tags/$tag"
printf 'Release tag %s is on GitHub (%.7s).\n' "$tag" "$commit"
