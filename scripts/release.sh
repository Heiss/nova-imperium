#!/bin/sh
# Tags a release after a successful CI push run (called by tag.yml). Since
# 2026-11-12 only a merged release pull request is a release: the tag is the
# version in VERSION, and only a commit that changed VERSION is tagged.
# NOVA_RELEASE_BRANCH is main, or hotfix/<name> for a hotfix.
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
  fail 'Release tags are created by GitHub Actions after successful CI.'
release_branch=${NOVA_RELEASE_BRANCH:-main}
case "$release_branch" in
  main|hotfix/*) ;;
  *) fail "Releases come from main or hotfix/*, not $release_branch." ;;
esac

repo=Heiss/nova-imperium
origin_pattern='^(https://github[.]com/|git@github[.]com:|ssh://git@github[.]com/)heiss/nova-imperium([.]git)?/?$'
branch=$(git branch --show-current)
[ "$branch" = "$release_branch" ] || fail "Switch to $release_branch before creating a release."
changes=$(git status --porcelain)
[ -z "$changes" ] || fail 'Commit or stash local changes before creating a release.'
fetch_url=$(git remote get-url --all origin)
push_url=$(git remote get-url --push --all origin)
# Exactly one fetch URL and one push URL must match.
if ! printf '%s\n' "$fetch_url" "$push_url" |
  awk -v pattern="$origin_pattern" 'tolower($0) ~ pattern { valid++ } END { exit !(NR == 2 && valid == 2) }'; then
  fail "Set origin to the canonical GitHub repository ($repo)."
fi

git fetch --tags origin "$release_branch"
tip=$(git rev-parse 'FETCH_HEAD^{commit}')
commit=$(git rev-parse "$NOVA_RELEASE_EXPECTED_SHA^{commit}")
# The CI run's own commit is tagged, also when the branch has moved on since:
# a pull request merged right after the release must not drop its tag.
git merge-base --is-ancestor "$commit" "$tip" ||
  fail "$commit is not on $release_branch: no tag."
# Only the merge of a release pull request changes VERSION.
if git diff --quiet "$commit^" "$commit" -- VERSION; then
  printf '%s\n' 'VERSION is unchanged: no release pull request, no tag.'
  exit 0
fi
git merge-base --is-ancestor HEAD "$tip" ||
  fail "Local $release_branch has commits that are not on origin/$release_branch."

# Let GitHub filter by commit, workflow, branch, event and successful status.
api="https://api.github.com/repos/$repo/actions/workflows/ci.yml/runs"
set --
if [ -n "${NOVA_RELEASE_CI_TOKEN:-}" ]; then
  set -- --header "Authorization: Bearer $NOVA_RELEASE_CI_TOKEN"
fi
result=$(curl --fail --silent --show-error --max-time 15 "$@" \
  "$api?branch=$release_branch&event=push&head_sha=$commit&status=success&per_page=1") ||
  fail 'Could not check GitHub CI.'
successful_runs='^[[:space:]]*\{[[:space:]]*"total_count"[[:space:]]*:[[:space:]]*[1-9][0-9]*[[:space:]]*,'
short_commit=$(printf '%.7s' "$commit")
printf '%s' "$result" | tr '\r\n' '  ' | grep -Eq "$successful_runs" ||
  fail "Wait for successful CI on $release_branch at $short_commit. https://github.com/$repo/actions/workflows/ci.yml"

tag=$(git show "$commit:VERSION" | tr -d '[:space:]')
printf '%s' "$tag" | grep -Eq '^[0-9]{2}\.([1-9]|1[0-2])\.(0|[1-9][0-9]*)$' ||
  fail "VERSION holds \"$tag\", not CalVer YY.M.MICRO."
existing=''
if git rev-parse -q --verify "refs/tags/$tag" > /dev/null; then
  if [ "$(git rev-parse "$tag^{commit}")" = "$commit" ]; then
    existing=$tag
  elif git merge-base --is-ancestor "$tag^{commit}" "$commit"; then
    # A hotfix merged back into main carries the hotfix's VERSION.
    printf '%s\n' "$tag is the release of a merged-back hotfix: nothing to tag."
    exit 0
  else
    fail "$tag is already the tag of another release: this release is not tagged. Fix VERSION through a new release pull request."
  fi
fi

if "$dry_run"; then
  printf 'Would push %s for %.7s.\n' "$tag" "$commit"
  exit 0
fi

if [ -z "$existing" ]; then git tag -a "$tag" "$commit" -m "Release $tag"; fi
git push origin "refs/tags/$tag" ||
  fail "Could not push $tag. Retry with: git push origin refs/tags/$tag"
printf 'Release tag %s is on GitHub (%.7s).\n' "$tag" "$commit"
