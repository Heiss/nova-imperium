#!/bin/sh
# Builds the release pull request "Release <version>" from the branch BASE
# (main, or hotfix/<name>), or closes it when nothing is left to release
# (owner, 2026-11-12). Called by .github/workflows/release-pr.yml after every
# push to BASE. The branch release/<BASE> is rebuilt from BASE each time:
# the fragments in changes/ become a section of CHANGELOG.md, VERSION holds
# the next CalVer version. Merging the pull request is the release.
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
taken_by() {
  git fetch --quiet origin '+refs/heads/release/*:refs/remotes/origin/release/*'
  for ref in $(git for-each-ref --format='%(refname)' refs/remotes/origin/release/); do
    [ "$ref" = "refs/remotes/origin/$branch" ] && continue
    if [ "$(git show "$ref:VERSION" 2> /dev/null | tr -d '[:space:]')" = "$version" ]; then
      printf '%s\n' "${ref#refs/remotes/origin/}"
      return
    fi
  done
}
other=$(taken_by)
[ -z "$other" ] || fail "$other holds $version too: run this workflow again."
# A draft cannot be merged: the release pull request is a draft from before
# the push until the check after it passed, so a failed or cancelled run
# never leaves a duplicate version mergeable.
if [ -n "$open" ]; then gh pr ready --undo "$open"; fi
git push --quiet --force origin "HEAD:refs/heads/$branch"
other=$(taken_by)

# A released hotfix that is not merged back yet: releasing main now would
# drop its fix from stable (owner, 2026-11-12). The pull request stays a
# draft until the hotfix branch is merged into main.
unmerged=
if [ "$base" = main ]; then
  for ref in $(git for-each-ref --format='%(refname:short)' refs/remotes/origin/hotfix/); do
    t=$(git describe --tags --abbrev=0 --match '[0-9]*.[0-9]*.[0-9]*' "$ref" 2> /dev/null) || continue
    # Merged back: the tag is part of HEAD, or (squash merge) VERSION held it.
    git merge-base --is-ancestor "$t" HEAD && continue
    [ -n "$(git log -1 --format=%H -G "^$(printf '%s' "$t" | sed 's/[.]/[.]/g')\$" HEAD -- VERSION)" ] && continue
    unmerged="$unmerged ${ref#origin/}"
  done
fi

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
  printf -- '- [ ] Texts checked: German, match their pull requests, nothing internal or secret\n'
  printf -- '- [ ] CI Gate green: complete mutation run, image, Trivy, upgrade test, smoke test\n'
  printf -- '- [ ] The issues of this release are closed or moved to the next one\n\n'
  printf '_Rebuilt automatically after every push to `%s`; do not edit this branch._\n' "$base"
  if [ -n "$unmerged" ]; then
    printf '\n**Draft:** merge the released hotfix branch(es)%s back into `main` first; this release would drop their fixes from `stable`.\n' "$unmerged"
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
if [ -n "$other" ]; then
  fail "$other holds $version too: the release pull request stays a draft; run this workflow again."
fi
if [ -n "$unmerged" ]; then
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
