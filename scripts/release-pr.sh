#!/bin/sh
# Builds the release pull request "Release <version>" from the branch BASE
# (main, or hotfix/<name>), or closes it when nothing is left to release
# (owner, 2026-11-12). Called by .github/workflows/release-pr.yml. The
# release pull request of main is created only on the owner's word: the loop
# starts the workflow by hand (EVENT workflow_dispatch); a push to main only
# rebuilds the one that is open (owner, 2026-11-23, #387). A hotfix branch
# exists to be released, so a push to it builds its release pull request as
# before [V]. The branch release/<BASE> is rebuilt from BASE each time: the
# fragments in changes/ become a section of CHANGELOG.md, VERSION holds the
# next CalVer version. The pull request changes nothing else, its CI runs no
# expensive job, and merging it is the release (#387). It is no draft, except
# while a released hotfix is not merged back or another release branch holds
# its version: a draft cannot be merged [V].
#
#   sh scripts/release-pr.sh check
#        the CI of a release head (release/<BASE>, every push to it): refuses
#        a version another release branch or a tag already holds, one not
#        newer than the newest tag (never retroactive, owner 2026-11-25,
#        108), and for main a released hotfix that is not merged back, so the CI Gate
#        itself refuses what the draft only marks (CodeRabbit on #395). It
#        reads the refs of the checkout and changes nothing.
set -eu

fail() {
  printf '%s\n' "$*" >&2
  exit 1
}

base=${BASE:?BASE is the branch to release}
case "$base" in
  main|hotfix/*) ;;
  *) fail "Releases come from main or hotfix/*, not $base." ;;
esac
branch="release/$base"

# Never a release after a newer one (owner, 2026-11-25, 108): gaps in the
# numbers are allowed, a version at or below the newest CalVer tag is not.
# The same two functions are in scripts/release-pr.sh and scripts/release.sh
# (each is tested alone, copied into a repository of its own).
calver_sort() { sort -t. -k1,1n -k2,2n -k3,3n; }
newest_tag() {
  git tag --list '[0-9]*.[0-9]*.[0-9]*' |
    grep -E '^[0-9]{2}\.([1-9]|1[0-2])\.(0|[1-9][0-9]*)$' | calver_sort | tail -n 1
}
# Whether CalVer $1 is strictly newer than CalVer $2, part by part as numbers.
newer_than() {
  [ "$1" != "$2" ] && [ "$(printf '%s\n%s\n' "$1" "$2" | calver_sort | tail -n 1)" = "$1" ]
}

# The release branch other than ours that holds <version> in its VERSION.
# A hotfix ignores the release pull request of main: the hotfix takes the
# version, and main moves up on its rebuild (owner, 2026-11-25, 108a), so in
# a collision main yields, never the hotfix (scripts/changelog.ts, heldBy).
taken_by() {
  for ref in $(git for-each-ref --format='%(refname)' refs/remotes/origin/release/); do
    [ "$ref" = "refs/remotes/origin/$branch" ] && continue
    case "$base" in
      hotfix/*) [ "$ref" = refs/remotes/origin/release/main ] && continue ;;
    esac
    if [ "$(git show "$ref:VERSION" 2> /dev/null | tr -d '[:space:]')" = "$1" ]; then
      printf '%s\n' "${ref#refs/remotes/origin/}"
      return
    fi
  done
}

# The released hotfix branches whose release is not in HEAD yet, for main:
# releasing main now would drop their fixes from stable (owner, 2026-11-12).
unmerged_hotfixes() {
  [ "$base" = main ] || return 0
  for ref in $(git for-each-ref --format='%(refname:short)' refs/remotes/origin/hotfix/); do
    t=$(git describe --tags --abbrev=0 --match '[0-9]*.[0-9]*.[0-9]*' "$ref" 2> /dev/null) || continue
    # Merged back: the tag is part of HEAD, or (squash merge) VERSION held it.
    git merge-base --is-ancestor "$t" HEAD && continue
    [ -n "$(git log -1 --format=%H -G "^$(printf '%s' "$t" | sed 's/[.]/[.]/g')\$" HEAD -- VERSION)" ] && continue
    printf ' %s' "${ref#origin/}"
  done
}

if [ "${1:-}" = check ]; then
  version=$(tr -d '[:space:]' < VERSION)
  refused=
  if [ -n "$(git tag --list "$version")" ]; then
    printf '::error::%s is a release already (tag %s).\n' "$version" "$version"
    refused=1
  fi
  other=$(taken_by "$version")
  if [ -n "$other" ]; then
    printf '::error::%s holds %s too.\n' "$other" "$version"
    refused=1
  fi
  unmerged=$(unmerged_hotfixes)
  if [ -n "$unmerged" ]; then
    printf '::error::Released hotfix not in %s yet:%s; this release would drop its fix from stable.\n' "$base" "$unmerged"
    refused=1
  fi
  newest=$(newest_tag)
  if [ -n "$newest" ] && ! newer_than "$version" "$newest"; then
    printf '::error::%s is not newer than the newest release %s: a release is never published after a newer one. Recovery: rebuild the release pull request from %s, which takes the next free version, or a new release pull request on the owner'"'"'s word.\n' "$version" "$newest" "$base"
    refused=1
  fi
  [ -z "$refused" ] || exit 1
  printf 'Release head of %s: %s is free and no released hotfix waits.\n' "$base" "$version"
  exit 0
fi

# The merge of a release pull request itself: tag.yml takes over. A hotfix
# merged back into main also changes VERSION, but to a version that is
# tagged already: then the release pull request of main is rebuilt.
if git rev-parse -q --verify HEAD^ > /dev/null &&
  ! git diff --quiet HEAD^ HEAD -- VERSION; then
  current=$(tr -d '[:space:]' < VERSION)
  if [ -z "$(git tag --list "$current")" ]; then
    printf 'This push released %s: tag.yml tags it.\n' "$current"
    exit 0
  fi
fi

last=$(git describe --tags --abbrev=0 --match '[0-9]*.[0-9]*.[0-9]*' HEAD 2> /dev/null || true)
if [ -n "$last" ]; then range="$last..HEAD"; else range=HEAD; fi
open=$(gh pr list --head "$branch" --base "$base" --state open \
  --json number --jq '.[0].number // empty')

# A push to main, and tag.yml after a hotfix release (REBUILD_ONLY), rebuild
# the open release pull request only: a new one is created on the owner's
# word (workflow_dispatch, #387).
if { [ "${EVENT:-}" = push ] || [ "${REBUILD_ONLY:-false}" = true ]; } &&
  [ "$base" = main ] && [ -z "$open" ]; then
  printf 'No release pull request is open: the loop starts one on the owner'"'"'s word.\n'
  exit 0
fi

if [ -z "$(git rev-list "$range")" ]; then
  if [ -n "$open" ]; then
    gh pr close "$open" --delete-branch \
      --comment "Nothing new since $last: no release needed."
  fi
  printf 'Nothing to release since %s.\n' "${last:-the start}"
  exit 0
fi

version=$(node scripts/changelog.ts next-version "$branch")
git switch --quiet -C "$branch"
section=$(node scripts/changelog.ts release "$version")
git add -A CHANGELOG.md VERSION changes
git -c user.name='Nova Imperium Release' \
  -c user.email='nova-imperium-release@users.noreply.github.com' \
  commit --quiet -m "Release $version"
# Release pull requests of main and of a hotfix are rebuilt by separate runs;
# two runs at the same moment could pick the same version. Checked before the
# push, and again after it for a run that pushed in between.
fetch_releases() {
  git fetch --quiet origin '+refs/heads/release/*:refs/remotes/origin/release/*'
}
fetch_releases
other=$(taken_by "$version")
[ -z "$other" ] || fail "$other holds $version too: run this workflow again."
# From the push on, a pull request that was ready gets the new head: when
# this run fails after it, the pull request goes back to draft, so it is not
# mergeable with a head the checks below did not pass (CodeRabbit on #395).
draft_on_failure() {
  status=$?
  if [ "$status" -ne 0 ] && [ -n "$open" ]; then
    gh pr ready --undo "$open" || true
  fi
  exit "$status"
}
trap draft_on_failure EXIT
git push --quiet --force origin "HEAD:refs/heads/$branch"
fetch_releases
other=$(taken_by "$version")

# A released hotfix that is not merged back yet: the pull request is a draft
# until the hotfix branch is merged into main [V]; the CI of the release head
# refuses it too (check above).
unmerged=$(unmerged_hotfixes)

# Written into the body while a released hotfix is not merged back.
unmerged_marker='<!-- release-pr: unmerged-hotfix -->'

# Squash merges end their subject with the pull request number.
pulls=$(git log --format='- %s' "$range" | grep -E '\(#[0-9]+\)$' || true)
{
  printf 'Merging this pull request releases **%s** from `%s`: tag.yml tags it after the CI push run, release.yml publishes the image and the GitHub release.\n\n' "$version" "$base"
  printf '## Neuigkeiten (CHANGELOG.md, German)\n\n'
  if [ -n "$section" ]; then
    printf '%s\n\n' "$section"
  else
    printf 'Keine für Spieler sichtbaren Änderungen.\n\n'
  fi
  printf '## Pull requests since %s\n\n%s\n\n' "${last:-the start}" "${pulls:-- (direct commits only)}"
  printf '## Before the merge\n\n'
  printf -- '- [ ] Texts checked: German, match their pull requests, one entry per feature, nothing internal or secret\n'
  printf -- '- [ ] CI Gate green: this pull request changes only `VERSION`, `CHANGELOG.md` and `changes/` and runs no expensive job; it relies on the results of `%s`\n' "$base"
  printf -- '- [ ] The issues of this release are closed or moved to the next one\n\n'
  printf '_Rebuilt automatically after every push to `%s` while it is open; do not edit this branch._\n' "$base"
  if [ -n "$unmerged" ]; then
    printf '\n%s\n' "$unmerged_marker"
    printf '**Draft:** merge the released hotfix branch(es)%s back into `main` first; this release would drop their fixes from `stable`. The next rebuild after that merge marks it ready.\n' "$unmerged"
  fi
} > release-body.md

if [ -n "$open" ]; then
  gh pr edit "$open" --title "Release $version" --body-file release-body.md
else
  gh pr create --draft --base "$base" --head "$branch" \
    --title "Release $version" --body-file release-body.md
  open=$(gh pr list --head "$branch" --base "$base" --state open \
    --json number --jq '.[0].number // empty')
fi
# Created as a draft, so it is never mergeable before the checks below; it
# stays one while another release branch holds its version or a released
# hotfix is not merged back, and is ready otherwise [V].
if [ -n "$other" ]; then
  gh pr ready --undo "$open"
  fail "$other holds $version too: the release pull request stays a draft; run this workflow again."
fi
if [ -n "$unmerged" ]; then
  gh pr ready --undo "$open"
  printf 'Released hotfix not in %s yet:%s. The release pull request stays a draft.\n' "$base" "$unmerged"
  exit 0
fi
gh pr ready "$open"
# A security hotfix releases itself when its CI is green (owner, 2026-11-12;
# .github/workflows/security-hotfix.yml). Every other release is the owner's.
case "$base" in
  hotfix/sec-*) gh pr merge --auto --squash "$open" ;;
esac
printf 'Release pull request for %s is up to date.\n' "$version"
