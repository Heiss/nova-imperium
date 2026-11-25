#!/bin/sh
# The merge-back of a released hotfix into main (owner, 2026-11-25, 111a).
# The pull request does not come from the hotfix branch itself: the ruleset
# of hotfix/** lets nothing but a pull request change it, and the ruleset of
# main wants an up-to-date branch, so such a pull request could neither be
# updated nor merged once main moved (#402). It comes from a branch of its
# own, hotfix-back/<name>: the current main with the hotfix merged in. When
# main moves while that pull request is open, the branch is built again the
# same way. The hotfix branch itself is never changed.
#
#   sh scripts/hotfix-back.sh open <hotfix/name> <version>
#        after the release of the hotfix (tag.yml): builds the branch and
#        opens its pull request into main, unless one is open
#   sh scripts/hotfix-back.sh rebuild
#        after a push to main (release-pr.yml): builds the branch of every
#        open merge-back pull request again from the new main
#
# A conflict stops with an error that names the files; the branch and its
# pull request stay as they were. Needs gh and a token that may push.
set -eu

fail() {
  printf '::error::%s\n' "$*" >&2
  exit 1
}

# Builds hotfix-back/<name> from origin/main with origin/<hotfix> merged in
# and pushes it; the branch of the hotfix is only read.
build() {
  hotfix=$1
  back="hotfix-back/${hotfix#hotfix/}"
  git fetch --quiet origin main "$hotfix"
  git switch --quiet --detach origin/main
  if ! git merge --quiet --no-ff --no-edit \
    -m "Merge $hotfix back into main" "origin/$hotfix" > /dev/null 2>&1; then
    conflicts=$(git diff --name-only --diff-filter=U | tr '\n' ' ')
    git merge --abort
    fail "$hotfix does not merge into main cleanly: conflict in ${conflicts% }. $back and its pull request stay as they are; merge it by hand."
  fi
  git push --quiet --force origin "HEAD:refs/heads/$back"
  printf '%s\n' "$back"
}

case "${1:-}" in
  open)
    hotfix=${2:?the hotfix branch}
    version=${3:?its version}
    case "$hotfix" in hotfix/*) ;; *) fail "Not a hotfix branch: $hotfix." ;; esac
    back=$(build "$hotfix")
    open=$(gh pr list --head "$back" --base main --state open --json number --jq '.[0].number // empty')
    if [ -z "$open" ]; then
      gh pr create --base main --head "$back" \
        --title "Sicherheits-Hotfix $version zurück nach main" \
        --body "Release $version from \`$hotfix\` is published. Merge it back into main (owner); its version is not tagged again. This pull request comes from \`$back\`, the current main with \`$hotfix\` merged in, instead of the hotfix branch itself, which its ruleset keeps unchanged; it is built again whenever main moves."
    fi
    ;;
  rebuild)
    # Each branch on its own: a conflict in one leaves the others rebuilt.
    failed=
    for back in $(gh pr list --base main --state open --json headRefName \
      --jq '.[].headRefName | select(startswith("hotfix-back/"))'); do
      if (build "hotfix/${back#hotfix-back/}" > /dev/null); then
        printf 'Rebuilt %s from the new main.\n' "$back"
      else
        failed=1
      fi
    done
    [ -z "$failed" ] || exit 1
    ;;
  *) fail 'Usage: sh scripts/hotfix-back.sh open <hotfix/name> <version> | rebuild' ;;
esac
