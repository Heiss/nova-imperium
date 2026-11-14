# Nova Imperium – release loop

You drive Nova Imperium from release to release, one small step per
iteration. Rules and decisions: `AGENTS.md`, the OKF bundle (`okf/index.md`,
`okf/ops/loop.md`, `okf/ops/branching-release.md`). Talk to the owner in
German; write code, commits, pull requests and OKF in English; the game
interface is German.

## Every iteration

1. Read the state from GitHub, never from memory:
   - your open pull requests (branches `claude/*`) with CI, review threads
     and merge conflicts;
   - Renovate's open security pull requests (`[SECURITY]` at the end of
     the title) with their CI;
   - the open release pull request (`Release <version>`, branch
     `release/main`) with its CI and its release candidate image;
   - the milestone `next release` with its open and closed issues.
2. Do the first step below that applies, and only that one.
3. Ask the owner with the question tool inside the iteration: the
   iteration waits for the answer and goes on with it, so the loop never
   waits without a question on screen.
4. End the iteration: when the next step can start at once, wake up again
   in one to two minutes; while you wait on CI or a review, in 20 to 30
   minutes (GitHub events wake you earlier).

## Steps, in this order

1. **Finish your open pull requests.** Red CI: find the root cause and fix
   it. Review findings: fix what is real, answer every thread, resolve.
   Conflict: merge `main` into the branch. A red security pull request of
   Renovate (`[SECURITY]` at the end of its title) is handled like an own
   pull request: the loop finds the root cause and fixes it in its own
   `claude/…` pull request, never by a push to the Renovate branch; if it
   cannot, it asks the owner. That fix pull request does not count toward
   the limit of two open own pull requests (security first). Patch, pin
   and digest security updates merge themselves, minor ones from version
   1.0 on; a major one and a minor one below 1.0 wait for the owner.
   Merge under O4 (green CI Gate,
   no open security or critical finding, every finding answered). Up to two
   own pull requests may be open at a time: while they only wait for CI or
   a review, go on with the next step; a subagent builds an issue that
   doesn't depend on the open ones in its own git worktree, and you review
   its diff before you open its pull request.
2. **Make the release ready** when the milestone `next release` is open and
   all its issues are closed. The release pull request is a draft after
   every rebuild: its cheap run checks only secrets, dependencies,
   migrations, workflows, CodeQL and the changelog, and its CI Gate is red
   on purpose (#147). Check its texts (German, matching their pull
   requests, one entry per feature, nothing internal) and its cheap jobs;
   then mark it „Ready for review“, which starts the full run. Do not mark
   it ready while its body says that a released hotfix is not merged back
   (the workflow „Release ready“ refuses it and sets it back to draft), or
   while the last run of the workflow „Release pull request“ failed.
   Wait until the CI Gate of the full run is green (complete mutation run,
   image, Trivy, upgrade test) and the candidate image `<version>-rc.<N>`
   is published; a push to `main` meanwhile sets it back to draft, so mark
   it ready again. Then tell the owner in
   German: version, what is in it, the staging image (`NOVA_VERSION=next`),
   and that merging the release pull request releases it.
   **Keep the loop running** until the owner has merged the release pull
   request (#149). There is no merge freeze: every merge into `main`
   (Renovate's security pull requests too) rebuilds it and sets it back to
   draft, and its last full run no longer counts. Then make it ready
   again as above (texts, cheap jobs, „Ready for review“, full run,
   candidate image) and tell the owner again, saying that `main` moved and
   the release pull request was rebuilt. That message is the only notice:
   no comment on the release pull request, no issue. While it stays ready
   and green, only wait. Once a release pull request from `release/main`
   is merged after the last issue of the milestone was closed, close the
   milestone and **stop the loop**.
3. **Plan the release** when there is no open milestone `next release`. Ask
   the owner what the release should bring:
   - list the open issues, **infrastructure first** (CI, release, security,
     operation, for example SBOM), then features (for example late-game
     buildings, ships and research);
   - mention what the open release pull request already holds;
   - offer 3 to 5 bundles with a recommendation and the reason;
   - create the milestone with the chosen issues. Wait for the answer;
     never pick on your own.
4. **Clarify the next open issue** of the milestone (infrastructure first,
   then the lowest number) while it has no comment that starts with
   `Geklärt`. Do not start while anything is unclear: ask the owner with 3
   to 5 options per decision, mark your recommendation, red-team it first.
   Record the decisions in the OKF bundle (E, V, U), then write one comment
   on the issue that starts with `Geklärt` and lists the decisions with a
   link to the OKF concept. That comment ends this step for the issue.
5. **Build the next open issue** that has a `Geklärt` comment, in one pull
   request from `main` (branch `claude/…`):
   code, tests (mutation floors, new files 80 %, security files 90 %), a
   German changelog fragment in `changes/` or the label `kein-changelog`,
   OKF and docs. Run `pnpm check` and the relevant E2E tests before every
   push. Open it as a draft, mark it ready when CI is green, subscribe to
   it. Write `Closes #<issue>` in the description.

## Never

- Merge a release pull request: the owner decides every release.
- Write the release pull request, `CHANGELOG.md` or `VERSION` by hand: the
  workflow „Release pull request“ (`scripts/release-pr.sh`) builds them
  from the fragments and the Git history. To refresh it, run that
  workflow; to change a text, fix its fragment in a pull request.
- Skip, weaken or delete a test, lower a mutation floor, or disable a check
  to get green.
- Push to `main` or a release branch, rewrite shared history, or change
  repository settings.
- Invent requirements or game values: ask.
- Continue after two failed attempts at the same problem: describe it to
  the owner with what you tried, and wait.
