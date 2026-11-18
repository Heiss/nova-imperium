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
   - Renovate's other open pull requests with their update type and CI,
     and the updates under „Pending Approval“ in the issue „Dependency
     Dashboard“ (major and 0.x minor updates get no pull request before
     the owner's tick there);
   - the open release pull request (`Release <version>`, branch
     `release/main`) with its CI and its release candidate image;
   - the open issues by their labels: `ready` (in the next release),
     `in progress` (you started it), `in review` (its pull request is
     ready and waits for CI or review), `in discussion` (planned for a
     later release); `feature` and `idea` give the kind.
2. Do the first step below that applies, and only that one.
3. When a step needs the owner, ask with the question tool inside the
   iteration: the iteration waits for the answer and goes on with it, so
   the loop never waits without a question on screen. A step that needs no
   decision, or only recommendations taken as [V] (step 4), asks nothing.
4. End the iteration: when the next step can start at once, wake up again
   in one to two minutes; while you wait on CI or a review, do not poll:
   GitHub events wake you, and one fallback wakeup in about 50 minutes.
5. Save usage: an event that needs nothing (a bot edited a comment,
   CodeRabbit skipped, your own reply) gets no tool call and at most one
   line. Large output (job logs, whole files, transcripts) is read by a
   subagent or with `grep`, never in this thread. Once a day, add the weekly
   usage you can see (a usage notice, or „not visible“) to the log entry
   of your next pull request; never open a pull request only for it.

## Steps, in this order

1. **Finish your open pull requests.** Red CI: find the root cause and fix
   it. Review findings: fix what is real, answer every thread, resolve.
   Merge `main` into a branch only when (a) it is the next one to merge
   (CI green on its head, every finding answered), (b) GitHub reports a
   conflict (no CI starts then), or (c) it needs code that just landed on
   `main`; otherwise leave it on its base, so a merge into `main` does not
   rerun CI on every open pull request. A red security pull request of
   Renovate (`[SECURITY]` at the end of its title) is handled like an own
   pull request: the loop finds the root cause and fixes it in its own
   `claude/…` pull request, never by a push to the Renovate branch; if it
   cannot, it asks the owner. That fix pull request does not count toward
   the limit of four open own pull requests (security first). Patch, pin
   and digest security updates merge themselves, minor ones from version
   1.0 on; a major one and a minor one below 1.0 wait for the owner.
   Merge under O4 (green CI Gate,
   no open security or critical finding, every finding answered). Up to four
   own pull requests may be open at a time: while they only wait for CI or
   a review, go on with the next step; a subagent builds an issue that
   doesn't depend on the open ones in its own git worktree, and you review
   its diff before you open its pull request. At most two subagents build
   at the same time. Two subagents always build: when one finishes, start the
   next issue with `ready` and a `Geklärt` comment that depends neither on
   the open pull requests nor on an issue being built, at once, also while
   you wait on CI or a review. Only you, the main agent, wait; you do not build yourself. Meanwhile you finish the open
   pull requests, clean up (worktrees, labels), look for new issues and
   pull requests, get the owner's decisions so that the next issues become
   `ready`, and do whatever else keeps both agents building
   (owner, 2026-11-16).
   Roles (owner, 2026-11-17): the subagents build; you, the main agent,
   merge, get the owner's decisions so that issues become ready for
   building, and structure the work. You see best where the code still
   causes merge conflicts or is hard to maintain (shared files that every
   pull request touches, modules that keep growing, missing extension
   points of the design patterns): give the subagents tasks to improve
   that, or file issues for it, and order the work so that subagents do not
   collide.
   Subagents run only the cheap local checks (owner, 2026-11-17):
   typecheck, eslint and the unit tests of the changed files, prettier,
   `checkLog` and `check:migrations`, and, for a change a player sees in
   the browser, a new E2E test once to show that it fails without the
   change; the full E2E suite, Stryker and the
   mutation gate run in the CI. They push and report at once instead of
   waiting for a free machine; a red CI goes back to a subagent.
   Small patches are slotted in between, so that none is left for the
   release (owner, 2026-11-16 and 2026-11-18): in every iteration in
   which no own pull request is the next one to merge, take the oldest
   open Renovate pull request with a patch or minor update of a version
   from 1.0 on that can go on, and bring it one step further; do not wait
   for a pause. One whose CI Gate is red on a head up to date with `main`
   cannot go on: skip it, it stays open and is named with the release.
   Renovate rebases it only on a conflict, so ask for the rebase when its
   head is behind `main`: tick the box „rebase/retry“ at the end of its
   description (the label `rebase` also works, but starts a CI run of its
   own), never „Update branch“ and never a push to its branch. Merge it
   when its CI Gate is green on a head up to date with `main` (O4). One at
   a time; a major update and a minor one below 1.0 wait for the owner.
   Also follow up GitHub's
   Dependabot alerts that have no Renovate security pull request; a small
   bug or cleanup issue (`bug`, `ready`, `Geklärt`) may be the next issue
   of a free subagent before the next feature.
2. **Make the release ready** when no open issue has the label `ready`,
   `in progress` or `in review` and the release pull request is open.
   First merge Renovate's ordinary pull requests with a patch or minor
   update of a version from 1.0 on (owner, 2026-11-16): one at a time,
   each under O4 on a head that is up to date with `main`; ask for the
   rebase of the next one as in step 1 and wait for its CI. A red one
   stays open and
   you name it in the message to the owner below. Major updates and minor
   updates below 1.0 wait for the owner: each gets one issue (find it, or
   open it with its entry in the Dependency Dashboard or its pull
   request's number, its breaking changes and, if it has a pull request,
   its CI, without a status label). Then go on with the release pull
   request. The release pull request is a draft after
   every rebuild: its cheap run checks only secrets, dependencies,
   migrations, workflows, CodeQL and the changelog, and its CI Gate is red
   on purpose (#147). Check its texts (German, matching their pull
   requests, one entry per feature, nothing internal, every new or
   changed admin setting or action named in the entry of its feature, with
   what the admin can now do) and its cheap jobs;
   then mark it „Ready for review“, which starts the full run. Do not mark
   it ready while its body says that a released hotfix is not merged back
   (the workflow „Release ready“ refuses it and sets it back to draft), or
   while the last run of the workflow „Release pull request“ failed, or
   while its run for the current `main` commit has not completed
   successfully: a rebuild that is still running pushes a new head after
   you marked the pull request ready.
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
   and green, only wait. After a restart of `/loop` you cannot know whether
   you told the owner already: tell them once more, then wait. When the
   loop is about to end (seven days, or the session) before the release is
   merged, tell the owner to start `/loop` again. Once the release pull
   request from `release/main` is merged, **stop the loop**.
3. **Plan the release** when no open issue has the label `ready`,
   `in progress` or `in review` and no release pull request is open. Ask
   the owner what the release should bring:
   - list the open issues, **infrastructure first** (CI, release, security,
     operation, for example SBOM), then features (for example late-game
     buildings, ships and research);
   - mention what the open release pull request already holds;
   - offer 3 to 5 bundles with a recommendation and the reason;
   - give the chosen issues the label `ready` (and remove
     `in discussion`). Wait for the answer; never pick on your own.
4. **Clarify the next open issue** with the label `ready` (infrastructure first,
   then the lowest number) while it has no comment that starts with
   `Geklärt`. Do not start while anything is unclear. Red-team your
   recommendation first; take it as [V] without asking where it is
   consistent with earlier decisions. Ask the owner with 3 to 5 options when
   unsure: no recommendation is clearly best, it conflicts with an earlier
   decision, it changes a rule of the project, or it concerns security,
   data loss or game values that no source gives (owner, 2026-11-15,
   `okf/ops/loop.md`).
   Record the decisions in the OKF bundle (E, V, U), then write one comment
   on the issue that starts with `Geklärt` and lists the decisions with a
   link to the OKF concept; list the recommendations taken as [V] apart,
   marked „taken as recommended“. That comment ends this step for the
   issue.
5. **Build the next open issue** with the label `ready` that has a
   `Geklärt` comment, in one pull request from `main` (branch `claude/…`).
   When you start it (also in a subagent), replace `ready` by
   `in progress`; when its pull request is marked ready and waits for CI
   or review, replace `in progress` by `in review`. A red CI or a review
   finding that needs a push sets it back to `in progress`. Build:
   code, tests (mutation floors, new files 80 %, security files 90 %), a
   German changelog fragment in `changes/` or the label `kein-changelog`
   (a new or changed admin setting or action is named in the fragment of
   its feature: what the admin can now do),
   OKF and docs, and the log entry as a new file
   `okf/log/<date>-<short-name>.md` with the UTC time in `date` (never an
   edit of another entry; the format is in `okf/ops/website.md`). Run the cheap local checks above
   before the push after which you mark it ready, and after a merge of
   `main` with a conflict in code; the full E2E suite and every other push
   of a draft rely on its CI. Open it as a draft, mark it ready when CI is green, subscribe to
   it. Write `Closes #<issue>` in the description.

## Never

- Merge a release pull request: the owner decides every release.
- Merge a design study (`docs/design/`): it stays on its branch and pull
  request. Its issue carries `idea` and no status label, and its pull
  request does not count toward the limit of open pull requests.
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
