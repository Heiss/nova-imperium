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

# The merge of a release pull request itself: tag.yml takes over.
if git rev-parse -q --verify HEAD^ > /dev/null &&
  ! git diff --quiet HEAD^ HEAD -- VERSION; then
  printf '%s\n' 'This push changed VERSION: a release is being tagged.'
  exit 0
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

version=$(node scripts/changelog.ts next-version)
git switch --quiet -C "$branch"
section=$(node scripts/changelog.ts release "$version")
git add -A CHANGELOG.md VERSION changes
git -c user.name='Nova Imperium Release' \
  -c user.email='nova-imperium-release@users.noreply.github.com' \
  commit --quiet -m "Release $version"
git push --quiet --force origin "HEAD:refs/heads/$branch"

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
} > release-body.md

if [ -n "$open" ]; then
  gh pr edit "$open" --title "Release $version" --body-file release-body.md
else
  gh pr create --base "$base" --head "$branch" \
    --title "Release $version" --body-file release-body.md
fi
printf 'Release pull request for %s is up to date.\n' "$version"
